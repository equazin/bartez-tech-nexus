import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, ChevronDown, Cpu, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Tienda } from "@/components/tienda/Tienda";
import { MigasDePan } from "@/components/tienda/MigasDePan";
import { ChipsDeDatos } from "@/components/tienda/TarjetaProducto";
import {
  PASOS,
  alternarYaTengo,
  cambiarCantidadDePieza,
  chequeosDelArmado,
  datosDeCompatibilidad,
  elegirPieza,
  evaluar,
  pasoDeCategoria,
  potenciaRecomendada,
  quitarPieza,
  useArmado,
  vaciarArmado,
  type Evaluacion,
  type IdDePaso,
  type Paso,
  type Seleccion,
} from "@/lib/tienda/armador";
import { agregarAlCarrito } from "@/lib/tienda/carrito";
import {
  encontrarCategoria,
  idsConDescendientes,
  imagenPrincipal,
  listarCategorias,
  listarProductos,
  rutaDelProducto,
  type ProductoPublico,
} from "@/lib/tienda/catalogo";
import { formatearPesos } from "@/lib/tienda/dinero";
import { datosClave } from "@/lib/tienda/ficha";
import { nombreCortoDeMedio, precioConMedio, preciosDe } from "@/lib/tienda/precios";
import { usarSeo } from "@/lib/tienda/seo";
import { cn } from "@/lib/utils";

const ORDEN_DE_ESTADO: Record<Evaluacion["estado"], number> = { compatible: 0, revisar: 1, incompatible: 2 };

function Insignia({ evaluacion }: { evaluacion: Evaluacion }) {
  if (evaluacion.estado === "compatible")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
        <Check className="h-3.5 w-3.5" aria-hidden />
        Compatible
      </span>
    );
  if (evaluacion.estado === "revisar")
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-primary" aria-hidden />
        {evaluacion.motivo}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
      <X className="h-3.5 w-3.5" aria-hidden />
      {evaluacion.motivo}
    </span>
  );
}

function FilaDeOpcion({
  producto,
  evaluacion,
  elegido,
  onElegir,
}: {
  producto: ProductoPublico;
  evaluacion: Evaluacion;
  elegido: boolean;
  onElegir: () => void;
}) {
  const foto = imagenPrincipal(producto);
  const precioMp = precioConMedio(producto, "mercadopago");
  return (
    <li className={cn("flex flex-wrap items-center gap-3 rounded-xl border bg-background p-3", elegido ? "border-foreground" : "border-border")}>
      <Link to={rutaDelProducto(producto)} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-placa-foto" aria-label={`Ver la ficha de ${producto.nombre}`}>
        {foto && <img src={foto} alt="" loading="lazy" className="max-h-14 max-w-14 object-contain mix-blend-multiply" />}
      </Link>
      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1">
        <Link to={rutaDelProducto(producto)} className="line-clamp-2 text-sm font-medium leading-snug hover:underline">
          {producto.nombre}
        </Link>
        <ChipsDeDatos datos={datosClave(producto, 3)} />
        <Insignia evaluacion={evaluacion} />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex min-w-[110px] flex-col items-end">
          <span className="font-bold tabular-nums">{producto.precio_final_ars !== null ? formatearPesos(producto.precio_final_ars) : "A confirmar"}</span>
          {precioMp !== null && precioMp !== producto.precio_final_ars && (
            <span className="text-xs tabular-nums text-muted-foreground">{formatearPesos(precioMp)} con Mercado Pago</span>
          )}
          {!producto.hay_stock && <span className="text-xs text-muted-foreground">Sin stock</span>}
        </div>
        <button
          type="button"
          onClick={onElegir}
          disabled={!producto.hay_stock || producto.precio_final_ars === null}
          aria-pressed={elegido}
          className={cn(
            "h-10 min-w-[84px] rounded-xl px-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground",
            elegido ? "bg-foreground text-background" : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {elegido ? "Elegido" : "Elegir"}
        </button>
      </div>
    </li>
  );
}

function PasoDelArmado({
  paso,
  numero,
  abierto,
  onAlternar,
  opciones,
  seleccion,
  cantidad,
  yaTengo,
}: {
  paso: Paso;
  numero: number;
  abierto: boolean;
  onAlternar: () => void;
  opciones: ProductoPublico[];
  seleccion: Seleccion;
  cantidad: number;
  yaTengo: boolean;
}) {
  const [verIncompatibles, setVerIncompatibles] = useState(false);
  const elegido = seleccion[paso.id] ?? null;
  const evaluadas = useMemo(
    () =>
      opciones
        .map((p) => ({ producto: p, evaluacion: evaluar(paso.id, p, seleccion) }))
        .sort(
          (a, b) =>
            ORDEN_DE_ESTADO[a.evaluacion.estado] - ORDEN_DE_ESTADO[b.evaluacion.estado] ||
            Number(b.producto.hay_stock) - Number(a.producto.hay_stock) ||
            (a.producto.precio_final_ars ?? Infinity) - (b.producto.precio_final_ars ?? Infinity),
        ),
    [opciones, paso.id, seleccion],
  );
  const visibles = evaluadas.filter((o) => o.evaluacion.estado !== "incompatible");
  const incompatibles = evaluadas.filter((o) => o.evaluacion.estado === "incompatible");
  const evaluacionDelElegido = elegido ? evaluar(paso.id, elegido, seleccion) : null;
  const slots = seleccion.motherboard ? datosDeCompatibilidad(seleccion.motherboard).slotsDeMemoria : null;
  const maximoDeUnidades = paso.id === "memoria" ? Math.max(1, slots ?? 4) : paso.id === "almacenamiento" ? 4 : 1;

  return (
    <section aria-label={paso.nombre} className={cn("rounded-2xl border bg-card", abierto ? "border-input" : "border-border")}>
      <button type="button" onClick={onAlternar} aria-expanded={abierto} className="flex w-full items-center gap-3.5 p-4 text-left">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            elegido || yaTengo ? "bg-foreground text-background" : "border border-input",
          )}
        >
          {elegido || yaTengo ? <Check className="h-4 w-4" aria-hidden /> : numero}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2 font-display text-[15px] font-bold uppercase tracking-[0.06em]">
            {paso.nombre}
            {!paso.necesaria && <span className="font-sans text-xs font-medium normal-case tracking-normal text-muted-foreground">opcional</span>}
          </span>
          <span className="truncate text-sm text-muted-foreground">
            {elegido ? `${cantidad > 1 ? `${cantidad} × ` : ""}${elegido.nombre}` : yaTengo ? "Ya la tenés" : paso.ayuda}
          </span>
          {evaluacionDelElegido && evaluacionDelElegido.estado !== "compatible" && <Insignia evaluacion={evaluacionDelElegido} />}
        </span>
        {elegido?.precio_final_ars != null && <span className="hidden font-bold tabular-nums sm:block">{formatearPesos(elegido.precio_final_ars * cantidad)}</span>}
        <ChevronDown className={cn("h-5 w-5 shrink-0 transition-transform", abierto && "rotate-180")} aria-hidden />
      </button>

      {abierto && (
        <div className="flex flex-col gap-3 border-t border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{paso.ayuda}</p>
            <div className="flex flex-wrap items-center gap-2">
              {elegido && maximoDeUnidades > 1 && (
                <div className="flex h-9 items-center overflow-hidden rounded-xl border border-input" aria-label="Cantidad">
                  <button type="button" aria-label="Una menos" onClick={() => cambiarCantidadDePieza(paso.id, cantidad - 1)} className="flex h-9 w-9 items-center justify-center hover:bg-secondary">
                    <Minus className="h-4 w-4" aria-hidden />
                  </button>
                  <span className="w-7 text-center text-sm font-bold tabular-nums">{cantidad}</span>
                  <button
                    type="button"
                    aria-label="Una más"
                    onClick={() => cambiarCantidadDePieza(paso.id, Math.min(maximoDeUnidades, cantidad + 1))}
                    className="flex h-9 w-9 items-center justify-center hover:bg-secondary"
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )}
              {elegido && (
                <button type="button" onClick={() => quitarPieza(paso.id)} className="h-9 rounded-xl border border-input px-3 text-sm font-bold hover:bg-secondary">
                  Quitar
                </button>
              )}
              <button
                type="button"
                onClick={() => alternarYaTengo(paso.id)}
                aria-pressed={yaTengo}
                className={cn("h-9 rounded-xl border border-input px-3 text-sm font-bold", yaTengo ? "bg-accent" : "hover:bg-secondary")}
              >
                {yaTengo ? "La voy a comprar" : "Ya tengo esta pieza"}
              </button>
            </div>
          </div>

          {!yaTengo &&
            (opciones.length === 0 ? (
              <p className="rounded-xl bg-background p-4 text-sm text-muted-foreground">Todavía no hay productos en esta categoría.</p>
            ) : (
              <>
                {visibles.length === 0 && <p className="rounded-xl bg-background p-4 text-sm text-muted-foreground">Con lo que elegiste no hay opciones compatibles. Cambiá una pieza anterior o mirá las no compatibles.</p>}
                <ul className="flex flex-col gap-2">
                  {visibles.map(({ producto, evaluacion }) => (
                    <FilaDeOpcion
                      key={producto.id}
                      producto={producto}
                      evaluacion={evaluacion}
                      elegido={elegido?.id === producto.id}
                      onElegir={() => elegirPieza(paso.id, producto.id, 1)}
                    />
                  ))}
                </ul>
                {incompatibles.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <button type="button" onClick={() => setVerIncompatibles((v) => !v)} className="self-start text-sm font-bold underline">
                      {verIncompatibles ? "Ocultar las no compatibles" : `Ver las ${incompatibles.length} no compatibles`}
                    </button>
                    {verIncompatibles && (
                      <ul className="flex flex-col gap-2 opacity-70">
                        {incompatibles.map(({ producto, evaluacion }) => (
                          <FilaDeOpcion
                            key={producto.id}
                            producto={producto}
                            evaluacion={evaluacion}
                            elegido={elegido?.id === producto.id}
                            onElegir={() => elegirPieza(paso.id, producto.id, 1)}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            ))}
        </div>
      )}
    </section>
  );
}

export default function ArmaTuPc() {
  usarSeo("Armá tu PC", "Elegí procesador, motherboard, memoria, disco, placa de video, fuente y gabinete, y te mostramos solo lo compatible.");
  const navigate = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const armado = useArmado();
  const [productos, setProductos] = useState<ProductoPublico[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<IdDePaso | null>(null);

  useEffect(() => {
    let cancelado = false;
    listarCategorias()
      .then((raices) => {
        const nodo = encontrarCategoria(raices, "pc-y-componentes");
        if (!nodo) return { productos: [] as ProductoPublico[], total: 0 };
        return listarProductos({ categoriaIds: idsConDescendientes(nodo), porPagina: 1000 });
      })
      .then((r) => {
        if (!cancelado) setProductos(r.productos);
      })
      .catch((e: unknown) => {
        if (!cancelado) setError(e instanceof Error ? e.message : "No se pudieron cargar los componentes.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const porPaso = useMemo(() => {
    const grupos: Record<IdDePaso, ProductoPublico[]> = {
      procesador: [],
      motherboard: [],
      memoria: [],
      almacenamiento: [],
      video: [],
      fuente: [],
      gabinete: [],
      cooler: [],
    };
    for (const p of productos) {
      const paso = pasoDeCategoria(p.categoria_slug);
      if (paso) grupos[paso].push(p);
    }
    return grupos;
  }, [productos]);

  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);

  const seleccion = useMemo<Seleccion>(() => {
    const s: Seleccion = {};
    for (const paso of PASOS) {
      const pieza = armado.piezas[paso.id];
      const producto = pieza ? porId.get(pieza.id) : undefined;
      if (producto) s[paso.id] = producto;
    }
    return s;
  }, [armado, porId]);

  // "Sumalo a Armá tu PC" desde la ficha: /arma-tu-pc?agregar=<id>
  useEffect(() => {
    const agregar = Number(parametros.get("agregar"));
    if (!agregar || productos.length === 0) return;
    const producto = porId.get(agregar);
    const paso = producto ? pasoDeCategoria(producto.categoria_slug) : null;
    if (producto && paso) {
      elegirPieza(paso, producto.id, 1);
      setAbierto(PASOS.find((p) => !armado.piezas[p.id] && p.id !== paso && !armado.yaTengo.includes(p.id))?.id ?? null);
    }
    const siguientes = new URLSearchParams(parametros);
    siguientes.delete("agregar");
    setParametros(siguientes, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parametros, productos.length]);

  // Abre el primer paso sin resolver al llegar.
  useEffect(() => {
    if (cargando || abierto !== null) return;
    setAbierto(PASOS.find((p) => !armado.piezas[p.id] && !armado.yaTengo.includes(p.id))?.id ?? "procesador");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando]);

  const chequeos = chequeosDelArmado(seleccion, armado.yaTengo);
  const hayIncompatibles = chequeos.some((c) => c.estado === "incompatible");
  const elegidos = PASOS.filter((p) => seleccion[p.id]);
  const cantidadDe = (paso: IdDePaso) => armado.piezas[paso]?.cantidad ?? 1;
  const medios = elegidos.length > 0 ? preciosDe(seleccion[elegidos[0].id] as ProductoPublico) : [];
  const totales = medios.map((m) => ({
    medio: m,
    total: elegidos.reduce((suma, paso) => suma + (precioConMedio(seleccion[paso.id] as ProductoPublico, m.id) ?? 0) * cantidadDe(paso.id), 0),
  }));
  const recomendada = potenciaRecomendada(seleccion);

  function agregarTodo() {
    for (const paso of elegidos) {
      const p = seleccion[paso.id] as ProductoPublico;
      agregarAlCarrito(p.id, p.slug, cantidadDe(paso.id));
    }
    toast.success("Tu PC está en el carrito", { description: `${elegidos.length} ${elegidos.length === 1 ? "pieza" : "piezas"} agregadas.` });
    navigate("/carrito");
  }

  return (
    <Tienda>
      <div className="container mx-auto flex flex-col gap-6 px-4 pb-6 pt-5">
        <MigasDePan migas={[{ nombre: "PC y componentes", ruta: "/pc-y-componentes" }, { nombre: "Armá tu PC" }]} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-[760px] flex-col gap-2">
            <h1 className="flex items-center gap-3 font-display text-[36px] font-bold uppercase leading-none md:text-[44px]">
              <Cpu className="h-9 w-9 text-primary" aria-hidden />
              Armá tu PC
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground">
              Elegí pieza por pieza. Te mostramos primero lo que es compatible con lo que ya elegiste: socket, memoria, formato de la motherboard y potencia
              de la fuente. Si ya tenés una pieza, marcala y seguimos.
            </p>
          </div>
          {elegidos.length + armado.yaTengo.length > 0 && (
            <button type="button" onClick={vaciarArmado} className="h-11 rounded-xl border border-input px-4 text-sm font-bold hover:bg-secondary">
              Empezar de nuevo
            </button>
          )}
        </div>

        {error ? (
          <p className="rounded-xl bg-error-fondo p-4 text-sm text-danger">{error}</p>
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {cargando && <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Cargando los componentes</p>}
              {!cargando &&
                PASOS.map((paso, i) => (
                  <PasoDelArmado
                    key={paso.id}
                    paso={paso}
                    numero={i + 1}
                    abierto={abierto === paso.id}
                    onAlternar={() => setAbierto((a) => (a === paso.id ? null : paso.id))}
                    opciones={porPaso[paso.id]}
                    seleccion={seleccion}
                    cantidad={cantidadDe(paso.id)}
                    yaTengo={armado.yaTengo.includes(paso.id)}
                  />
                ))}
            </div>

            <aside aria-label="Tu PC" className="flex w-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-6 lg:w-[380px] lg:shrink-0">
              <p className="font-display text-lg font-bold uppercase tracking-[0.06em]">Tu PC</p>
              {elegidos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todavía no elegiste piezas. Empezá por el procesador.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {elegidos.map((paso) => {
                    const p = seleccion[paso.id] as ProductoPublico;
                    return (
                      <li key={paso.id} className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-xs text-muted-foreground">{paso.nombre}</span>
                          <span className="line-clamp-2">
                            {cantidadDe(paso.id) > 1 ? `${cantidadDe(paso.id)} × ` : ""}
                            {p.nombre}
                          </span>
                        </span>
                        <span className="shrink-0 font-bold tabular-nums">{p.precio_final_ars !== null ? formatearPesos(p.precio_final_ars * cantidadDe(paso.id)) : ""}</span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {(seleccion.procesador || seleccion.video) && (
                <p className="rounded-xl bg-background px-3.5 py-3 text-sm">
                  Potencia de fuente recomendada: <strong>{recomendada} W</strong>
                  <span className="block text-xs text-muted-foreground">Estimada con el consumo del procesador y la placa de video, con margen.</span>
                </p>
              )}

              {chequeos.length > 0 && (
                <ul className="flex flex-col gap-1.5 text-sm" aria-label="Compatibilidad">
                  {chequeos.map((c) => (
                    <li key={c.id} className="flex items-start gap-2">
                      {c.estado === "compatible" ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                      ) : c.estado === "incompatible" ? (
                        <X className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                      )}
                      <span className={cn(c.estado === "incompatible" && "text-danger")}>{c.texto}</span>
                    </li>
                  ))}
                </ul>
              )}

              {totales.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-border pt-3.5">
                  {totales.map(({ medio, total }, i) => (
                    <div key={medio.id} className="flex items-baseline justify-between gap-3">
                      <span className={cn(i === 0 ? "font-bold" : "text-sm text-muted-foreground")}>
                        {totales.length > 1 ? `Con ${nombreCortoDeMedio(medio).toLowerCase()}` : "Total"}
                      </span>
                      <span className={cn("tabular-nums", i === 0 ? "text-[26px] font-bold tracking-[-0.02em]" : "text-base font-bold")}>{formatearPesos(total)}</span>
                    </div>
                  ))}
                  <span className="text-xs text-muted-foreground">Precios finales con IVA incluido. El envío se calcula en el carrito.</span>
                </div>
              )}

              <button
                type="button"
                onClick={agregarTodo}
                disabled={elegidos.length === 0 || hayIncompatibles}
                className="h-[52px] rounded-xl bg-primary text-base font-bold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground"
              >
                Agregar todo al carrito
              </button>
              {hayIncompatibles && <p className="text-xs text-danger">Hay piezas que no son compatibles entre sí. Cambiá las que están marcadas para seguir.</p>}
              <p className="text-xs text-muted-foreground">
                Cada pieza es de fábrica y tiene su garantía. ¿Dudas con una combinación? <Link to="/ayuda" className="underline">Escribinos</Link>.
              </p>
            </aside>
          </div>
        )}
      </div>
    </Tienda>
  );
}
