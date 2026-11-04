import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tienda } from "@/components/tienda/Tienda";
import { useCarritoDetallado } from "@/lib/tienda/carritoDetallado";
import { vaciarCarrito } from "@/lib/tienda/carrito";
import { formatearPesos } from "@/lib/tienda/dinero";
import { PROVINCIAS, cotizarEnvioADestino, textoDeDemora, type OpcionDeEnvio } from "@/lib/tienda/envios";
import { MEDIOS_DE_PAGO, crearPedido, type MedioDePago, type MedioDisponible } from "@/lib/tienda/pedidos";
import { listarMedios } from "@/lib/tienda/pagos";
import { precioConMedio } from "@/lib/tienda/precios";
import { usarSeo } from "@/lib/tienda/seo";
import { cn } from "@/lib/utils";

const CLASE_SELECT =
  "flex h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Formulario {
  nombre: string;
  email: string;
  telefono: string;
  documento: string;
  calle: string;
  numero: string;
  piso: string;
  codigo_postal: string;
  localidad: string;
  provincia: string;
  opcion_envio: OpcionDeEnvio["id"];
  sucursal_id: string;
  medio_pago: MedioDePago;
  cupon: string;
  notas: string;
}

const VACIO: Formulario = {
  nombre: "",
  email: "",
  telefono: "",
  documento: "",
  calle: "",
  numero: "",
  piso: "",
  codigo_postal: "",
  localidad: "",
  provincia: "",
  opcion_envio: "domicilio",
  sucursal_id: "",
  medio_pago: "mercadopago",
  cupon: "",
  notas: "",
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validar(f: Formulario): Partial<Record<keyof Formulario, string>> {
  const errores: Partial<Record<keyof Formulario, string>> = {};
  if (f.nombre.trim().length < 3) errores.nombre = "Escribí tu nombre y apellido.";
  if (!EMAIL.test(f.email.trim())) errores.email = "Revisá el email: ahí te mandamos la compra.";
  if (f.telefono.replace(/\D/g, "").length < 8) errores.telefono = "Escribí un teléfono con código de área.";
  if (!/^\d{7,11}$/.test(f.documento.replace(/[.\- ]/g, ""))) errores.documento = "Escribí tu DNI o CUIT, sin puntos.";
  if (f.calle.trim().length < 2) errores.calle = "Falta la calle.";
  if (f.numero.trim().length < 1) errores.numero = "Falta el número.";
  if (!/^\d{4}$/.test(f.codigo_postal.trim())) errores.codigo_postal = "El código postal tiene cuatro números.";
  if (f.localidad.trim().length < 2) errores.localidad = "Falta la localidad.";
  if (!PROVINCIAS.includes(f.provincia as (typeof PROVINCIAS)[number])) errores.provincia = "Elegí la provincia.";
  return errores;
}

function Campo({ etiqueta, error, children }: { etiqueta: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{etiqueta}</span>
      {children}
      {error && <span className="block text-danger">{error}</span>}
    </label>
  );
}

export default function Checkout() {
  usarSeo("Finalizar la compra");
  const navigate = useNavigate();
  const [parametros] = useSearchParams();
  const { lineas, subtotal, subtotalPorMedio, serviciosElegidos, itemsDeEnvio, claveDeEnvio, cargando, listoParaComprar } = useCarritoDetallado();
  // El carrito deja elegir el medio antes de llegar acá; si viene en la URL, arranca elegido.
  const medioDelCarrito = parametros.get("medio");
  const [f, setF] = useState<Formulario>(() =>
    medioDelCarrito === "transferencia" || medioDelCarrito === "mercadopago" ? { ...VACIO, medio_pago: medioDelCarrito as MedioDePago } : VACIO,
  );
  const [errores, setErrores] = useState<Partial<Record<keyof Formulario, string>>>({});
  const [opciones, setOpciones] = useState<OpcionDeEnvio[] | null>(null);
  const [cotizando, setCotizando] = useState(false);
  const [errorDeEnvio, setErrorDeEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorDelServidor, setErrorDelServidor] = useState<string | null>(null);
  const [medios, setMedios] = useState<MedioDisponible[]>(MEDIOS_DE_PAGO);
  // Cada medio tiene su precio (recargo configurable); el servidor vuelve a calcularlo al confirmar.
  const subtotalDelMedio = subtotalPorMedio[f.medio_pago] ?? subtotal;

  useEffect(() => {
    let cancelado = false;
    listarMedios()
      .then((lista) => {
        if (cancelado || lista.length === 0) return;
        setMedios(lista);
        setF((previo) => (lista.some((m) => m.id === previo.medio_pago) ? previo : { ...previo, medio_pago: lista[0].id }));
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, []);

  // El envío depende del destino: se cotiza cuando están el código postal, la localidad y la provincia.
  const destinoCompleto =
    /^\d{4}$/.test(f.codigo_postal.trim()) && f.localidad.trim().length >= 2 && PROVINCIAS.includes(f.provincia as (typeof PROVINCIAS)[number]);
  useEffect(() => {
    if (lineas.length === 0 || cargando || !destinoCompleto) {
      setOpciones(null);
      setErrorDeEnvio(null);
      return;
    }
    let cancelado = false;
    setCotizando(true);
    const espera = window.setTimeout(() => {
      cotizarEnvioADestino(itemsDeEnvio, subtotalDelMedio, { codigo_postal: f.codigo_postal.trim(), localidad: f.localidad.trim(), provincia: f.provincia })
        .then(({ opciones: lista, error }) => {
          if (cancelado) return;
          setOpciones(lista);
          setErrorDeEnvio(lista.length === 0 ? (error ?? "No pudimos cotizar el envío a ese destino. Revisá el código postal.") : null);
          setF((previo) =>
            lista.some((o) => o.id === previo.opcion_envio) ? previo : { ...previo, opcion_envio: lista[0]?.id ?? "domicilio", sucursal_id: "" },
          );
        })
        .catch(() => {
          if (!cancelado) {
            setOpciones([]);
            setErrorDeEnvio("No pudimos cotizar el envío. Probá en un rato.");
          }
        })
        .finally(() => {
          if (!cancelado) setCotizando(false);
        });
    }, 500);
    return () => {
      cancelado = true;
      window.clearTimeout(espera);
    };
  }, [lineas.length, cargando, claveDeEnvio, subtotalDelMedio, destinoCompleto, f.codigo_postal, f.localidad, f.provincia]); // eslint-disable-line react-hooks/exhaustive-deps

  const elegida = opciones?.find((o) => o.id === f.opcion_envio) ?? null;
  const faltaSucursal = elegida?.id === "sucursal" && !f.sucursal_id;

  function cambiar<K extends keyof Formulario>(clave: K, valor: Formulario[K]) {
    setF((previo) => ({ ...previo, [clave]: valor }));
    setErrores((previos) => ({ ...previos, [clave]: undefined }));
  }

  async function confirmar(evento: FormEvent) {
    evento.preventDefault();
    const nuevosErrores = validar(f);
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0 || !listoParaComprar || !elegida || faltaSucursal) return;
    setEnviando(true);
    setErrorDelServidor(null);
    try {
      const creado = await crearPedido({
        items: lineas.map(({ linea }) => ({ product_id: linea.productoId, quantity: linea.cantidad })),
        servicios: serviciosElegidos.length > 0 ? serviciosElegidos.map((s) => s.id) : undefined,
        comprador: { nombre: f.nombre.trim(), email: f.email.trim(), telefono: f.telefono.trim(), documento: f.documento.replace(/[.\- ]/g, "") },
        envio: {
          calle: f.calle.trim(),
          numero: f.numero.trim(),
          piso: f.piso.trim() || undefined,
          codigo_postal: f.codigo_postal.trim(),
          localidad: f.localidad.trim(),
          provincia: f.provincia,
          opcion: elegida.id,
          sucursal_id: elegida.id === "sucursal" ? Number(f.sucursal_id) : undefined,
        },
        medio_pago: f.medio_pago,
        cupon: f.cupon.trim() || undefined,
        notas: f.notas.trim() || undefined,
      });
      vaciarCarrito();
      navigate(`/compra/${creado.id}?t=${creado.token}`, { replace: true });
    } catch (e: unknown) {
      setErrorDelServidor(e instanceof Error ? e.message : "No se pudo crear el pedido.");
    } finally {
      setEnviando(false);
    }
  }

  if (!cargando && lineas.length === 0) {
    return (
      <Tienda>
        <div className="container mx-auto flex flex-col items-start gap-4 px-4 py-24">
          <h1 className="text-[28px] font-bold leading-[34px]">No hay nada para comprar</h1>
          <Button asChild>
            <Link to="/">Ver la tienda</Link>
          </Button>
        </div>
      </Tienda>
    );
  }

  const costoEnvio = elegida?.precio ?? 0;
  const total = subtotalDelMedio + costoEnvio;

  return (
    <Tienda>
      <form onSubmit={confirmar} noValidate className="container mx-auto grid gap-8 px-4 py-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-10">
          <h1 className="text-[28px] font-bold leading-[34px] tracking-[-0.5px]">Finalizar la compra</h1>

          <section className="space-y-4">
            <h2 className="text-[20px] font-bold leading-[26px]">1. Tus datos</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Nombre y apellido" error={errores.nombre}>
                <Input value={f.nombre} onChange={(e) => cambiar("nombre", e.target.value)} autoComplete="name" />
              </Campo>
              <Campo etiqueta="Email" error={errores.email}>
                <Input type="email" value={f.email} onChange={(e) => cambiar("email", e.target.value)} autoComplete="email" />
              </Campo>
              <Campo etiqueta="Teléfono" error={errores.telefono}>
                <Input type="tel" value={f.telefono} onChange={(e) => cambiar("telefono", e.target.value)} autoComplete="tel" placeholder="Con código de área" />
              </Campo>
              <Campo etiqueta="DNI o CUIT (para el envío y la factura)" error={errores.documento}>
                <Input value={f.documento} onChange={(e) => cambiar("documento", e.target.value)} inputMode="numeric" />
              </Campo>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-[20px] font-bold leading-[26px]">2. Envío</h2>
            <p className="text-sm text-muted-foreground">Mandamos a todo el país. El costo depende del código postal y del tamaño del paquete.</p>
            <div className="grid gap-4 sm:grid-cols-6">
              <div className="sm:col-span-4">
                <Campo etiqueta="Calle" error={errores.calle}>
                  <Input value={f.calle} onChange={(e) => cambiar("calle", e.target.value)} autoComplete="address-line1" />
                </Campo>
              </div>
              <div className="sm:col-span-2">
                <Campo etiqueta="Número" error={errores.numero}>
                  <Input value={f.numero} onChange={(e) => cambiar("numero", e.target.value)} />
                </Campo>
              </div>
              <div className="sm:col-span-3">
                <Campo etiqueta="Piso y departamento (opcional)">
                  <Input value={f.piso} onChange={(e) => cambiar("piso", e.target.value)} autoComplete="address-line2" />
                </Campo>
              </div>
              <div className="sm:col-span-3">
                <Campo etiqueta="Código postal" error={errores.codigo_postal}>
                  <Input value={f.codigo_postal} onChange={(e) => cambiar("codigo_postal", e.target.value)} inputMode="numeric" maxLength={4} autoComplete="postal-code" />
                </Campo>
              </div>
              <div className="sm:col-span-3">
                <Campo etiqueta="Localidad" error={errores.localidad}>
                  <Input value={f.localidad} onChange={(e) => cambiar("localidad", e.target.value)} autoComplete="address-level2" />
                </Campo>
              </div>
              <div className="sm:col-span-3">
                <Campo etiqueta="Provincia" error={errores.provincia}>
                  <select value={f.provincia} onChange={(e) => cambiar("provincia", e.target.value)} className={CLASE_SELECT} autoComplete="address-level1">
                    <option value="">Elegí la provincia</option>
                    {PROVINCIAS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
            </div>

            <div className="space-y-3">
              {!destinoCompleto ? (
                <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Completá el código postal, la localidad y la provincia para ver cuánto sale el envío.
                </p>
              ) : cotizando && opciones === null ? (
                <p className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">Cotizando el envío</p>
              ) : errorDeEnvio ? (
                <p className="rounded-xl bg-error-fondo p-3 text-sm text-danger">{errorDeEnvio}</p>
              ) : (
                (opciones ?? []).map((opcion) => (
                  <label
                    key={opcion.id}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors",
                      f.opcion_envio === opcion.id ? "border-foreground bg-secondary" : "border-border bg-card hover:bg-secondary",
                    )}
                  >
                    <input
                      type="radio"
                      name="opcion_envio"
                      value={opcion.id}
                      checked={f.opcion_envio === opcion.id}
                      onChange={() => setF((previo) => ({ ...previo, opcion_envio: opcion.id, sucursal_id: "" }))}
                      className="mt-1"
                    />
                    <span className="flex-1 space-y-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-bold">{opcion.id === "domicilio" ? "A domicilio" : "Retiro en sucursal del transporte"}</span>
                        <span className="font-bold tabular-nums">{opcion.gratis ? "Sin cargo" : formatearPesos(opcion.precio)}</span>
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {[textoDeDemora(opcion), opcion.transporte ? `con ${opcion.transporte}` : ""].filter(Boolean).join(", ")}
                        {textoDeDemora(opcion) ? " desde que se acredita el pago." : ""}
                      </span>
                    </span>
                  </label>
                ))
              )}
              {elegida?.id === "sucursal" && (
                <Campo etiqueta="Sucursal donde retirás">
                  <select value={f.sucursal_id} onChange={(e) => setF((previo) => ({ ...previo, sucursal_id: e.target.value }))} className={CLASE_SELECT}>
                    <option value="">Elegí la sucursal</option>
                    {(elegida.sucursales ?? []).map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {`${s.nombre} · ${s.direccion}${s.horario ? ` · ${s.horario}` : ""}`}
                      </option>
                    ))}
                  </select>
                </Campo>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-[20px] font-bold leading-[26px]">3. Cómo pagás</h2>
            <div className="grid gap-3">
              {medios.map((medio) => (
                <label
                  key={medio.id}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors",
                    f.medio_pago === medio.id ? "border-foreground bg-secondary" : "border-border bg-card hover:bg-secondary",
                  )}
                >
                  <input type="radio" name="medio_pago" value={medio.id} checked={f.medio_pago === medio.id} onChange={() => cambiar("medio_pago", medio.id)} className="mt-1" />
                  <span className="flex-1 space-y-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-bold">{medio.nombre}</span>
                      <span className="font-bold tabular-nums">{formatearPesos((subtotalPorMedio[medio.id] ?? subtotal) + costoEnvio)}</span>
                    </span>
                    <span className="block text-sm text-muted-foreground">{medio.detalle}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Cupón (opcional)">
                <Input value={f.cupon} onChange={(e) => cambiar("cupon", e.target.value.toUpperCase())} autoComplete="off" />
              </Campo>
              <Campo etiqueta="Nota para el envío (opcional)">
                <Input value={f.notas} onChange={(e) => cambiar("notas", e.target.value)} maxLength={300} placeholder="Horarios, referencias, portero" />
              </Campo>
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-6">
            <h2 className="text-[20px] font-bold leading-[26px]">4. Confirmar</h2>
            <ul className="divide-y divide-border text-sm">
              {lineas.map(({ linea, producto }) => (
                <li key={linea.productoId} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">
                    {linea.cantidad} × {producto?.nombre ?? "Producto"}
                  </span>
                  <span className="shrink-0 tabular-nums">{producto && precioConMedio(producto, f.medio_pago) !== null ? formatearPesos((precioConMedio(producto, f.medio_pago) ?? 0) * linea.cantidad) : ""}</span>
                </li>
              ))}
              {serviciosElegidos.map((s) => (
                <li key={s.id} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">{s.nombre}</span>
                  <span className="shrink-0 tabular-nums">{precioConMedio(s, f.medio_pago) !== null ? formatearPesos(precioConMedio(s, f.medio_pago) ?? 0) : ""}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatearPesos(subtotalDelMedio)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Envío</span>
              <span className="tabular-nums">{!elegida ? (cotizando ? "Cotizando" : "A calcular") : elegida.gratis ? "Sin cargo" : formatearPesos(elegida.precio)}</span>
            </div>
            {elegida && textoDeDemora(elegida) && <p className="text-xs text-muted-foreground">{textoDeDemora(elegida)} desde que se acredita el pago.</p>}
            <div className="flex justify-between border-t border-border pt-3 text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatearPesos(total)}</span>
            </div>
            <p className="text-xs text-muted-foreground">Precios finales con IVA incluido. Si cargaste un cupón, el descuento se aplica al confirmar.</p>
            {errorDelServidor && <p className="rounded-xl bg-error-fondo p-3 text-sm text-danger">{errorDelServidor}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={enviando || !listoParaComprar || !elegida || faltaSucursal}>
              {enviando ? "Creando tu pedido" : "Confirmar la compra"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Al confirmar aceptás los <Link to="/terminos" className="underline">términos y condiciones</Link>. Podés arrepentirte dentro de los 10 días corridos de recibir el pedido.
            </p>
          </div>
        </aside>
      </form>
    </Tienda>
  );
}
