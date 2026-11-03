import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CreditCard, Cpu, Minus, Plus, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tienda } from "@/components/tienda/Tienda";
import { MigasDePan, type Miga } from "@/components/tienda/MigasDePan";
import { NoEncontrado } from "@/components/tienda/NoEncontrado";
import { Galeria } from "@/components/tienda/Galeria";
import { FichaTecnica, parrafos } from "@/components/tienda/FichaTecnica";
import { PreciosDelProducto } from "@/components/tienda/Precio";
import { Bloque, EncabezadoDeSeccion } from "@/components/tienda/Seccion";
import { EstadoDeStock, GrillaProductos, agregarYAvisar, compararYAvisar } from "@/components/tienda/TarjetaProducto";
import { encontrarCategoria, imagenesDe, listarCategorias, obtenerProducto, rutaDeCategoria, type ProductoPublico } from "@/lib/tienda/catalogo";
import { useComparador } from "@/lib/tienda/comparador";
import { formatearPesos } from "@/lib/tienda/dinero";
import { cotizarEnvio, textoDeDemora, type CotizacionDeEnvio } from "@/lib/tienda/envios";
import { datosClaveConEtiqueta, esNotebook, paresDeFicha, valorDe } from "@/lib/tienda/ficha";
import { complementosDe, parecidosA } from "@/lib/tienda/sugerencias";
import { pasoDeCategoria } from "@/lib/tienda/armador";
import { usarSeo } from "@/lib/tienda/seo";
import { cn } from "@/lib/utils";

function CajaDeCompra({ producto }: { producto: ProductoPublico }) {
  const navigate = useNavigate();
  const [cantidad, setCantidad] = useState(1);
  const comparando = useComparador().some((p) => p.id === producto.id);
  const disponible = producto.hay_stock && producto.precio_final_ars !== null;

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-5">
      <PreciosDelProducto producto={producto} tamano="ficha" />
      <EstadoDeStock producto={producto} className="text-sm" />
      <div className="flex flex-wrap gap-2.5">
        <div className="flex h-12 items-center overflow-hidden rounded-xl border border-input">
          <button
            type="button"
            aria-label="Una unidad menos"
            onClick={() => setCantidad((c) => Math.max(1, c - 1))}
            className="flex h-12 w-11 items-center justify-center hover:bg-secondary"
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <span aria-live="polite" className="w-9 text-center font-bold tabular-nums">
            {cantidad}
          </span>
          <button
            type="button"
            aria-label="Una unidad más"
            onClick={() => setCantidad((c) => Math.min(9, c + 1))}
            className="flex h-12 w-11 items-center justify-center hover:bg-secondary"
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <button
          type="button"
          disabled={!disponible}
          onClick={() => agregarYAvisar(producto, cantidad)}
          className="h-12 flex-[1_1_180px] rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground"
        >
          Agregar al carrito
        </button>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          disabled={!disponible}
          onClick={() => {
            agregarYAvisar(producto, cantidad);
            navigate("/carrito");
          }}
          className="h-11 flex-[1_1_160px] rounded-xl border border-foreground text-sm font-bold hover:bg-secondary disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground"
        >
          Comprar ahora
        </button>
        <button
          type="button"
          aria-pressed={comparando}
          onClick={() => compararYAvisar(producto)}
          className={cn("h-11 flex-[1_1_160px] rounded-xl border border-input text-sm font-bold", comparando ? "bg-accent" : "hover:bg-secondary")}
        >
          {comparando ? "En el comparador" : "Sumar al comparador"}
        </button>
      </div>
    </div>
  );
}

function Envio({ producto }: { producto: ProductoPublico }) {
  const [cotizacion, setCotizacion] = useState<CotizacionDeEnvio | null>(null);
  useEffect(() => {
    let cancelado = false;
    cotizarEnvio([{ product_id: producto.id, cantidad: 1 }], producto.precio_final_ars ?? 0)
      .then((c) => {
        if (!cancelado) setCotizacion(c);
      })
      .catch(() => {
        if (!cancelado) setCotizacion(null);
      });
    return () => {
      cancelado = true;
    };
  }, [producto.id, producto.peso_kg, producto.precio_final_ars]);

  const precio = !cotizacion ? "Cotizando" : !cotizacion.disponible ? "A confirmar" : cotizacion.gratis ? "Sin cargo" : formatearPesos(cotizacion.precio ?? 0);
  const demora = cotizacion?.disponible ? textoDeDemora(cotizacion) : "";

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card px-5 py-[18px]">
      <div className="flex items-center gap-2.5">
        <Truck className="h-5 w-5" aria-hidden />
        <p className="text-[15px] font-bold">Envío a domicilio</p>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-background px-3.5 py-3 text-sm">
        <span>{demora ? `${demora} desde que se acredita el pago` : "Plazo a confirmar"}</span>
        <strong className="tabular-nums">{precio}</strong>
      </div>
      <p className="text-[13px] text-muted-foreground">El mismo precio y el mismo plazo en cualquier provincia.</p>
    </div>
  );
}

function useLista(cargar: () => Promise<ProductoPublico[]>, clave: string): ProductoPublico[] | null {
  const [lista, setLista] = useState<ProductoPublico[] | null>(null);
  useEffect(() => {
    let cancelado = false;
    setLista(null);
    cargar()
      .then((l) => {
        if (!cancelado) setLista(l);
      })
      .catch(() => {
        if (!cancelado) setLista([]);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  return lista;
}

function Sugerencias({ producto }: { producto: ProductoPublico }) {
  const complementos = useLista(() => complementosDe([producto], 4), `c-${producto.id}`);
  const parecidos = useLista(() => parecidosA(producto, 5), `p-${producto.id}`);
  return (
    <>
      {complementos && complementos.length > 0 && (
        <Bloque etiqueta="Completá el setup" className="px-0">
          <EncabezadoDeSeccion titulo="Completá el setup" bajada="Van bien con este producto." />
          <GrillaProductos productos={complementos} columnas="cuatro" />
        </Bloque>
      )}
      {parecidos && parecidos.length > 0 && (
        <Bloque etiqueta="También podés mirar" className="px-0">
          <EncabezadoDeSeccion titulo="También podés mirar" bajada="De la misma categoría y con un precio parecido." />
          <GrillaProductos productos={parecidos} columnas="cinco" />
        </Bloque>
      )}
    </>
  );
}

export default function Producto() {
  const { producto: slug = "" } = useParams<{ producto: string }>();
  const [producto, setProducto] = useState<ProductoPublico | null>(null);
  const [migas, setMigas] = useState<Miga[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(null);
    obtenerProducto(slug)
      .then((p) => {
        if (!cancelado) setProducto(p);
      })
      .catch((e: unknown) => {
        if (!cancelado) setError(e instanceof Error ? e.message : "No se pudo cargar el producto.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!producto?.categoria_slug) {
      setMigas(producto ? [{ nombre: producto.nombre }] : []);
      return;
    }
    let cancelado = false;
    listarCategorias()
      .then((raices) => {
        if (cancelado) return;
        const nodo = encontrarCategoria(raices, producto.categoria_slug ?? "");
        const cadena = nodo ? rutaDeCategoria(raices, nodo.id) : [];
        setMigas([...cadena.map((c) => ({ nombre: c.nombre, ruta: `/${c.slug}` })), { nombre: producto.nombre }]);
      })
      .catch(() => {
        if (!cancelado) setMigas([{ nombre: producto.nombre }]);
      });
    return () => {
      cancelado = true;
    };
  }, [producto]);

  usarSeo(producto?.nombre ?? null, producto?.descripcion_corta ?? (producto ? `${producto.nombre} con envío a todo el país y precio final con IVA incluido.` : null));

  if (cargando) {
    return (
      <Tienda>
        <div className="container mx-auto flex flex-wrap gap-8 px-4 py-8">
          <Skeleton className="h-[clamp(320px,42vw,540px)] min-w-0 flex-[1.15_1_480px] rounded-2xl" />
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
        </div>
      </Tienda>
    );
  }

  if (error) {
    return (
      <Tienda>
        <NoEncontrado titulo="No pudimos cargar el producto" detalle={error} />
      </Tienda>
    );
  }

  if (!producto) {
    return (
      <Tienda>
        <NoEncontrado titulo="No encontramos este producto" />
      </Tienda>
    );
  }

  const datos = datosClaveConEtiqueta(producto, 4);
  const garantia = valorDe(paresDeFicha(producto), "Garantía");
  const descripcion = parrafos(producto.descripcion);
  const secciones = [
    { id: "especificaciones", nombre: "Especificaciones", hay: paresDeFicha(producto).length > 0 },
    { id: "descripcion", nombre: "Descripción", hay: descripcion.length > 0 },
    { id: "envio-y-garantia", nombre: "Envío y garantía", hay: true },
  ].filter((s) => s.hay);

  return (
    <Tienda>
      <div className="container mx-auto flex flex-col gap-10 px-4 pb-6 pt-5">
        <MigasDePan migas={migas.length > 0 ? migas : [{ nombre: producto.nombre }]} />

        <section className="-mt-4 flex flex-wrap items-start gap-8">
          <div className="min-w-0 flex-[1.15_1_480px]">
            <Galeria imagenes={imagenesDe(producto)} nombre={producto.nombre} />
          </div>

          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-[18px]">
            <div className="flex flex-wrap items-center gap-2.5">
              {producto.marca && (
                <Link
                  to={`/buscar?q=${encodeURIComponent(producto.marca)}`}
                  className="rounded-chip bg-foreground px-3 py-1 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-background"
                >
                  {producto.marca}
                </Link>
              )}
              {producto.categoria_nombre && producto.categoria_slug && (
                <Link to={`/${producto.categoria_slug}`} className="text-sm text-muted-foreground hover:underline">
                  {producto.categoria_nombre}
                </Link>
              )}
              {producto.oferta && <span className="rounded-chip bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">Oferta</span>}
            </div>
            <div className="flex flex-col gap-1">
              <h1 className="text-[26px] font-bold leading-tight md:text-[30px]">{producto.nombre}</h1>
              {producto.sku && <p className="text-[13px] text-muted-foreground">Código {producto.sku}</p>}
            </div>
            {producto.descripcion_corta && <p className="text-base leading-relaxed text-muted-foreground">{producto.descripcion_corta}</p>}

            {datos.length > 0 && (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {datos.map((d) => (
                  <li key={d.etiqueta} className="flex flex-col gap-0.5 rounded-xl border border-border bg-card px-2.5 py-3">
                    <span className="truncate text-lg font-bold">{d.valor}</span>
                    <span className="truncate text-xs text-muted-foreground">{d.etiqueta}</span>
                  </li>
                ))}
              </ul>
            )}

            <CajaDeCompra producto={producto} />
            {pasoDeCategoria(producto.categoria_slug) && (
              <Link
                to={`/arma-tu-pc?agregar=${producto.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-input"
              >
                <span className="flex items-center gap-3">
                  <Cpu className="h-6 w-6 shrink-0 text-primary" aria-hidden />
                  <span className="flex flex-col">
                    <span className="text-[15px] font-bold">Sumalo a Armá tu PC</span>
                    <span className="text-[13px] text-muted-foreground">Elegí el resto de las piezas y te mostramos solo las compatibles.</span>
                  </span>
                </span>
                <span className="text-sm font-bold">→</span>
              </Link>
            )}
            <Envio producto={producto} />

            <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                {garantia ? `${garantia} de garantía.` : "Garantía oficial del fabricante."}
              </li>
              <li className="flex items-center gap-2.5">
                <RotateCcw className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                10 días para arrepentirte desde que lo recibís.
              </li>
              <li className="flex items-center gap-2.5">
                <CreditCard className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
                No vemos ni guardamos los datos de tu tarjeta.
              </li>
              {esNotebook(producto.categoria_slug) && <li className="pl-[30px]">Configuración de fábrica: sin ampliaciones de memoria ni de disco.</li>}
            </ul>
          </div>
        </section>

        {secciones.length > 1 && (
          <nav aria-label="Secciones del producto" className="flex flex-wrap gap-1 border-b border-border">
            {secciones.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="flex h-12 items-center px-4 text-[15px] text-muted-foreground hover:text-foreground">
                {s.nombre}
              </a>
            ))}
          </nav>
        )}

        <FichaTecnica producto={producto} />

        {descripcion.length > 0 && (
          <section id="descripcion" className="flex scroll-mt-6 flex-col gap-3">
            <h2 className="font-display text-[26px] font-bold uppercase">Descripción</h2>
            <div className="flex max-w-3xl flex-col gap-3 text-base leading-relaxed text-muted-foreground">
              {descripcion.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        )}

        <section id="envio-y-garantia" className="grid scroll-mt-6 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
            <p className="font-display text-[15px] font-bold uppercase tracking-[0.08em]">Envío a todo el país</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Llega a tu domicilio con el mismo precio y el mismo plazo en cualquier provincia. Te mandamos el seguimiento por mail.
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
            <p className="font-display text-[15px] font-bold uppercase tracking-[0.08em]">{garantia ? `Garantía de ${garantia}` : "Garantía"}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Desde la entrega. Si falla, te acompañamos en el trámite.{" "}
              <Link to="/garantias" className="text-foreground underline">
                Cómo funciona
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
            <p className="font-display text-[15px] font-bold uppercase tracking-[0.08em]">Arrepentimiento</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Diez días corridos desde que lo recibís, sin registrarte, desde el{" "}
              <Link to="/arrepentimiento" className="text-foreground underline">
                botón de arrepentimiento
              </Link>
              .
            </p>
          </div>
        </section>

        <Sugerencias producto={producto} />
      </div>
    </Tienda>
  );
}
