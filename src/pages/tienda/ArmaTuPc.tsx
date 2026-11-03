import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, Check, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Tienda } from "@/components/tienda/Tienda";
import { MigasDePan } from "@/components/tienda/MigasDePan";
import { ChipsDeDatos } from "@/components/tienda/TarjetaProducto";
import { FilaDeOpcion, FilaDeServicio, TarjetaDeArmada, chipsDeArmada, nombreCorto, type EstadoDeArmada } from "@/components/tienda/ArmadorPartes";
import {
  PASOS,
  alternarServicioDelArmado,
  alternarYaTengo,
  cambiarCantidadDePieza,
  cargarArmada,
  chequeosDelArmado,
  datosDeCompatibilidad,
  elegirPieza,
  evaluar,
  pasoDeCategoria,
  potenciaRecomendada,
  quitarPieza,
  siguientePaso,
  useArmado,
  vaciarArmado,
  type Armado,
  type Evaluacion,
  type IdDePaso,
  type Paso,
  type Seleccion,
} from "@/lib/tienda/armador";
import { agregarAlCarrito, sumarServicios } from "@/lib/tienda/carrito";
import { imagenPrincipal, type ProductoPublico } from "@/lib/tienda/catalogo";
import { agruparPorPaso, listarComponentes, seleccionDe } from "@/lib/tienda/componentes";
import { formatearPesos } from "@/lib/tienda/dinero";
import { datosClave } from "@/lib/tienda/ficha";
import { listarPcArmadas, type PcArmadaPublica } from "@/lib/tienda/pcArmadas";
import { nombreCortoDeMedio, precioConMedio, preciosDe } from "@/lib/tienda/precios";
import { usarSeo } from "@/lib/tienda/seo";
import { useServicios } from "@/lib/tienda/servicios";
import { cn } from "@/lib/utils";

/**
 * Armá tu PC: todas las piezas en una lista. Se puede arrancar de una PC armada (panel › Armá tu PC) o de cero;
 * al tocar una fila se abren sus opciones, primero las compatibles, y al elegir una pasa sola a la que falta.
 */

const ORDEN_DE_ESTADO: Record<Evaluacion["estado"], number> = { compatible: 0, revisar: 1, incompatible: 2 };

const nombreDePaso = (id: IdDePaso) => PASOS.find((p) => p.id === id)?.nombre ?? "";

function mismasPiezas(a: Armado["piezas"], b: Armado["piezas"]): boolean {
  return PASOS.every((p) => (a[p.id]?.id ?? null) === (b[p.id]?.id ?? null) && (a[p.id]?.cantidad ?? 1) === (b[p.id]?.cantidad ?? 1));
}

function Dato({ titulo, valor, detalle, tono }: { titulo: string; valor: string; detalle: string; tono?: "bien" | "mal" }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card px-4 py-3.5">
      <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{titulo}</span>
      <span className={cn("text-xl font-bold tabular-nums", tono === "bien" && "text-success", tono === "mal" && "text-danger")}>{valor}</span>
      <span className="text-[13px] text-muted-foreground">{detalle}</span>
    </div>
  );
}

function FilaDePieza({
  paso,
  producto,
  cantidad,
  tenida,
  abierta,
  textoVacio,
  onAbrir,
  onQuitar,
  onYaTengo,
  onCantidad,
  children,
}: {
  paso: Paso;
  producto: ProductoPublico | null;
  cantidad: number;
  tenida: boolean;
  abierta: boolean;
  textoVacio: string;
  onAbrir: () => void;
  onQuitar: () => void;
  onYaTengo: () => void;
  onCantidad: (cantidad: number) => void;
  children?: ReactNode;
}) {
  const hecho = Boolean(producto) || tenida;
  const foto = producto ? imagenPrincipal(producto) : null;
  const precio = producto?.precio_final_ars ?? null;
  const precioMp = producto ? precioConMedio(producto, "mercadopago") : null;
  return (
    <li className={cn("rounded-2xl border px-3.5 py-3", abierta ? "border-foreground bg-secondary" : "border-border bg-card")}>
      <div className="flex flex-wrap items-center gap-3.5">
        <span className="flex w-[124px] shrink-0 flex-col gap-1">
          <span
            className={cn(
              "flex h-[22px] w-[22px] items-center justify-center rounded-md",
              hecho ? "bg-success text-background" : abierta ? "bg-primary text-primary-foreground" : "bg-accent text-foreground",
            )}
            aria-hidden
          >
            {hecho ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
          </span>
          <span className="text-sm font-bold">{paso.nombre}</span>
          <span className="text-xs text-muted-foreground">{paso.necesaria ? "Necesaria" : paso.id === "video" ? "Para jugar" : "Opcional"}</span>
        </span>

        {producto && (
          <div className="flex min-w-0 flex-[1_1_320px] flex-wrap items-center gap-3.5">
            <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-lg bg-placa-foto">
              {foto && <img src={foto} alt="" className="max-h-[50px] max-w-[50px] object-contain mix-blend-multiply" />}
            </span>
            <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-1.5">
              <span className="text-sm font-medium leading-snug">{producto.nombre}</span>
              <ChipsDeDatos datos={datosClave(producto, 3)} />
            </span>
            {paso.id === "memoria" && (
              <span className="flex h-9 items-center rounded-xl border border-input">
                <button type="button" onClick={() => onCantidad(cantidad - 1)} disabled={cantidad <= 1} aria-label="Una menos" className="px-2.5 disabled:opacity-40">
                  <Minus className="h-4 w-4" aria-hidden />
                </button>
                <span className="min-w-6 text-center text-sm font-bold tabular-nums">{cantidad}</span>
                <button type="button" onClick={() => onCantidad(cantidad + 1)} disabled={cantidad >= 4} aria-label="Una más" className="px-2.5 disabled:opacity-40">
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              </span>
            )}
            <span className="flex min-w-[112px] flex-col items-end">
              <span className="font-bold tabular-nums">{precio !== null ? formatearPesos(precio * cantidad) : ""}</span>
              {precioMp !== null && precioMp !== precio && <span className="text-xs tabular-nums text-muted-foreground">{formatearPesos(precioMp * cantidad)} con MP</span>}
            </span>
            <span className="flex flex-col items-start gap-1">
              <button type="button" onClick={onAbrir} className="text-[13px] font-bold underline">
                Cambiar
              </button>
              <button type="button" onClick={onQuitar} className="text-[13px] text-muted-foreground underline">
                Quitar
              </button>
            </span>
          </div>
        )}

        {!producto && tenida && (
          <div className="flex min-w-0 flex-[1_1_320px] items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Ya la tenés: no la sumamos al total.</span>
            <button type="button" onClick={onYaTengo} className="text-[13px] font-bold underline">
              Deshacer
            </button>
          </div>
        )}

        {!producto && !tenida && (
          <div className="flex min-w-0 flex-[1_1_320px] flex-wrap items-center justify-between gap-2.5 rounded-xl border border-dashed border-border px-3.5 py-3">
            <span className="text-sm text-muted-foreground">{abierta ? "Elegí una en las opciones." : textoVacio}</span>
            <span className="flex gap-2">
              <button type="button" onClick={onYaTengo} className="h-[38px] rounded-xl border border-input px-3 text-[13px] font-bold hover:bg-background">
                Ya la tengo
              </button>
              <button
                type="button"
                onClick={onAbrir}
                className={cn("h-[38px] rounded-xl px-4 text-[13px] font-bold", abierta ? "bg-foreground text-background" : "bg-primary text-primary-foreground hover:bg-primary/90")}
              >
                {abierta ? "Abierta" : "Elegir"}
              </button>
            </span>
          </div>
        )}
      </div>
      {children}
    </li>
  );
}

function PanelDeOpciones({
  paso,
  opciones,
  verTodas,
  onVerTodas,
  elegidoId,
  aviso,
  ayuda,
  onElegir,
  onYaTengo,
  onSaltar,
  onCerrar,
}: {
  paso: Paso;
  opciones: Array<{ producto: ProductoPublico; evaluacion: Evaluacion }>;
  verTodas: boolean;
  onVerTodas: (valor: boolean) => void;
  elegidoId: number | null;
  aviso: string | null;
  ayuda: string;
  onElegir: (producto: ProductoPublico) => void;
  onYaTengo: () => void;
  onSaltar: () => void;
  onCerrar: () => void;
}) {
  const compatibles = opciones.filter((o) => o.evaluacion.estado !== "incompatible");
  const visibles = verTodas ? opciones : compatibles;
  return (
    <div className="flex flex-col gap-3.5">
      {aviso && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-background px-3 py-2.5 text-[13px]">
          <Check className="h-4 w-4 shrink-0 text-success" aria-hidden />
          {aviso}
        </p>
      )}
      <div className="flex items-start justify-between gap-3">
        <span className="flex flex-col gap-1">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Elegí</span>
          <span className="font-display text-2xl font-bold uppercase leading-none">{paso.nombre}</span>
        </span>
        <button type="button" onClick={onCerrar} aria-label="Cerrar las opciones" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border hover:bg-secondary">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{ayuda}</p>
      {opciones.length > 0 && (
        <div className="flex gap-1.5">
          {[false, true].map((todas) => (
            <button
              key={String(todas)}
              type="button"
              onClick={() => onVerTodas(todas)}
              aria-pressed={verTodas === todas}
              className={cn("h-8 rounded-chip border px-3 text-[13px] font-bold", verTodas === todas ? "border-foreground bg-foreground text-background" : "border-input")}
            >
              {todas ? `Todas · ${opciones.length}` : `Compatibles · ${compatibles.length}`}
            </button>
          ))}
        </div>
      )}
      {opciones.length === 0 ? (
        <p className="rounded-xl bg-background p-3.5 text-sm text-muted-foreground">Todavía no hay productos con stock en esta categoría.</p>
      ) : visibles.length === 0 ? (
        <p className="rounded-xl bg-background p-3.5 text-sm text-muted-foreground">Ninguna es compatible con lo que ya elegiste. Tocá Todas para ver por qué.</p>
      ) : (
        <ul className="flex max-h-[640px] flex-col gap-2 overflow-y-auto pr-1">
          {visibles.map(({ producto, evaluacion }) => (
            <FilaDeOpcion key={producto.id} producto={producto} evaluacion={evaluacion} elegido={elegidoId === producto.id} onElegir={() => onElegir(producto)} />
          ))}
        </ul>
      )}
      <div className="flex gap-2 border-t border-border pt-3">
        <button type="button" onClick={onYaTengo} className="h-10 flex-1 rounded-xl border border-input text-[13px] font-bold hover:bg-secondary">
          Ya la tengo
        </button>
        <button type="button" onClick={onSaltar} className="h-10 flex-1 rounded-xl border border-input text-[13px] font-bold hover:bg-secondary">
          Saltear →
        </button>
      </div>
    </div>
  );
}

export default function ArmaTuPc() {
  usarSeo("Armá tu PC", "Arrancá de una PC armada o elegí pieza por pieza: te mostramos solo lo compatible, con el precio de cada medio de pago.");
  const navigate = useNavigate();
  const [parametros, setParametros] = useSearchParams();
  const armado = useArmado();
  const servicios = useServicios();
  const [productos, setProductos] = useState<ProductoPublico[]>([]);
  const [armadas, setArmadas] = useState<PcArmadaPublica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<IdDePaso | null>(null);
  const [verTodas, setVerTodas] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    Promise.all([listarComponentes(), listarPcArmadas().catch(() => [] as PcArmadaPublica[])])
      .then(([componentes, lista]) => {
        if (cancelado) return;
        setProductos(componentes);
        setArmadas(lista);
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

  const porPaso = useMemo(() => agruparPorPaso(productos), [productos]);
  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const seleccion = useMemo<Seleccion>(() => seleccionDe(armado.piezas, porId), [armado, porId]);

  function abrir(paso: IdDePaso | null, texto: string | null = null) {
    setAbierto(paso);
    setVerTodas(false);
    setAviso(texto);
  }

  function avanzar(desde: IdDePaso, siguiente: Armado, texto: (proximo: IdDePaso) => string) {
    const proximo = siguientePaso(desde, siguiente, seleccionDe(siguiente.piezas, porId));
    abrir(proximo, proximo ? texto(proximo) : null);
  }

  function elegir(paso: IdDePaso, producto: ProductoPublico) {
    const cantidad = armado.piezas[paso]?.cantidad ?? 1;
    elegirPieza(paso, producto.id, cantidad);
    const piezas = { ...armado.piezas, [paso]: { id: producto.id, cantidad } };
    avanzar(paso, { ...armado, piezas, yaTengo: armado.yaTengo.filter((p) => p !== paso) }, (p) => `Elegiste ${nombreCorto(producto)}. Seguimos con ${nombreDePaso(p).toLowerCase()}.`);
  }

  function tenerla(paso: IdDePaso) {
    if (!armado.yaTengo.includes(paso)) alternarYaTengo(paso);
    const piezas = Object.fromEntries(Object.entries(armado.piezas).filter(([id]) => id !== paso)) as Armado["piezas"];
    avanzar(paso, { ...armado, piezas, yaTengo: [...armado.yaTengo, paso] }, (p) => `Anotamos que ya tenés ${nombreDePaso(paso).toLowerCase()}. Seguimos con ${nombreDePaso(p).toLowerCase()}.`);
  }

  function saltar(paso: IdDePaso) {
    // Para la recorrida cuenta como resuelto; la pieza sigue faltando en el resumen.
    avanzar(paso, { ...armado, yaTengo: [...armado.yaTengo, paso] }, (p) => `Seguimos con ${nombreDePaso(p).toLowerCase()}.`);
  }

  // "Sumalo a Armá tu PC" desde la ficha: /arma-tu-pc?agregar=<id>
  useEffect(() => {
    const agregar = Number(parametros.get("agregar"));
    if (!agregar || productos.length === 0) return;
    const producto = porId.get(agregar);
    const paso = producto ? pasoDeCategoria(producto.categoria_slug) : null;
    if (producto && paso) elegir(paso, producto);
    const siguientes = new URLSearchParams(parametros);
    siguientes.delete("agregar");
    setParametros(siguientes, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parametros, productos.length]);

  // Al llegar con un armado a medias, abre la primera pieza sin resolver.
  useEffect(() => {
    if (cargando) return;
    const resuelto = (p: Paso) => Boolean(armado.piezas[p.id]) || armado.yaTengo.includes(p.id);
    const vacio = PASOS.every((p) => !resuelto(p));
    if (!vacio && !armado.origen) setAbierto(PASOS.find((p) => p.necesaria && !resuelto(p))?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando]);

  const cpu = seleccion.procesador ? datosDeCompatibilidad(seleccion.procesador) : null;
  const chequeos = chequeosDelArmado(seleccion, armado.yaTengo);
  const problemas = chequeos.filter((c) => c.estado === "incompatible");
  const faltan = chequeos.filter((c) => c.estado === "falta");
  const elegidos = PASOS.filter((p) => seleccion[p.id]);
  const cantidadDe = (paso: IdDePaso) => armado.piezas[paso]?.cantidad ?? 1;
  const necesarias = PASOS.filter((p) => p.necesaria || (p.id === "video" && cpu?.graficosIntegrados === false) || (p.id === "cooler" && cpu?.coolerIncluido === false));
  const resueltas = necesarias.filter((p) => seleccion[p.id] || armado.yaTengo.includes(p.id)).length;
  const recomendada = potenciaRecomendada(seleccion);
  const potenciaDeLaFuente = seleccion.fuente ? datosDeCompatibilidad(seleccion.fuente).potencia : null;
  const serviciosElegidos = servicios.filter((s) => armado.servicios.includes(s.id));
  const completa = elegidos.length > 0 && faltan.length === 0 && problemas.length === 0;

  const medios = elegidos.length > 0 ? preciosDe(seleccion[elegidos[0].id] as ProductoPublico) : [];
  const totales = medios.map((m) => ({
    medio: m,
    total:
      elegidos.reduce((suma, paso) => suma + (precioConMedio(seleccion[paso.id] as ProductoPublico, m.id) ?? 0) * cantidadDe(paso.id), 0) +
      serviciosElegidos.reduce((suma, s) => suma + (precioConMedio(s, m.id) ?? 0), 0),
  }));

  const origen = armadas.find((a) => a.id === armado.origen) ?? null;
  const modificada = Boolean(origen) && (!mismasPiezas(armado.piezas, (origen as PcArmadaPublica).piezas) || armado.yaTengo.length > 0);
  const armadasConPiezas = armadas.filter((a) => PASOS.every((p) => !a.piezas[p.id] || porId.has((a.piezas[p.id] as { id: number }).id)));

  const pasoAbierto = abierto ? (PASOS.find((p) => p.id === abierto) ?? null) : null;
  const opciones = pasoAbierto
    ? porPaso[pasoAbierto.id]
        .map((producto) => ({ producto, evaluacion: evaluar(pasoAbierto.id, producto, seleccion) }))
        .sort(
          (a, b) =>
            ORDEN_DE_ESTADO[a.evaluacion.estado] - ORDEN_DE_ESTADO[b.evaluacion.estado] ||
            Number(b.producto.hay_stock) - Number(a.producto.hay_stock) ||
            (a.producto.precio_final_ars ?? Infinity) - (b.producto.precio_final_ars ?? Infinity),
        )
    : [];
  const ayudaDe = (paso: Paso): string => {
    if (paso.id === "fuente") return `Para lo que elegiste recomendamos ${recomendada} W o más.`;
    if (paso.id === "video" && cpu?.graficosIntegrados) return "El procesador tiene gráficos integrados: la placa de video es para jugar o editar video.";
    if (paso.id === "cooler" && cpu?.coolerIncluido) return "El procesador ya trae cooler: este paso es opcional.";
    return paso.ayuda;
  };
  const textoVacioDe = (paso: Paso): string => {
    if (paso.id === "video" && cpu?.graficosIntegrados) return "Opcional: el procesador tiene gráficos integrados.";
    if (paso.id === "cooler" && cpu?.coolerIncluido) return "Opcional: el procesador trae cooler.";
    return `Todavía no elegiste ${paso.nombre.toLowerCase()}.`;
  };

  const panel = pasoAbierto ? (
    <PanelDeOpciones
      paso={pasoAbierto}
      opciones={opciones}
      verTodas={verTodas}
      onVerTodas={setVerTodas}
      elegidoId={armado.piezas[pasoAbierto.id]?.id ?? null}
      aviso={aviso}
      ayuda={ayudaDe(pasoAbierto)}
      onElegir={(producto) => elegir(pasoAbierto.id, producto)}
      onYaTengo={() => tenerla(pasoAbierto.id)}
      onSaltar={() => saltar(pasoAbierto.id)}
      onCerrar={() => abrir(null)}
    />
  ) : null;

  function agregarTodo() {
    for (const paso of elegidos) {
      const p = seleccion[paso.id] as ProductoPublico;
      agregarAlCarrito(p.id, p.slug, cantidadDe(paso.id));
    }
    if (serviciosElegidos.length > 0) sumarServicios(serviciosElegidos.map((s) => s.id));
    toast.success("Tu PC está en el carrito", { description: `${elegidos.length} ${elegidos.length === 1 ? "pieza" : "piezas"} agregadas.` });
    navigate("/carrito");
  }

  const botonAgregar = (
    <button
      type="button"
      onClick={agregarTodo}
      disabled={elegidos.length === 0 || problemas.length > 0}
      className="h-[50px] rounded-xl bg-primary px-6 text-[15px] font-bold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground"
    >
      Agregar todo al carrito
    </button>
  );

  return (
    <Tienda>
      <div className="container mx-auto flex flex-col gap-5 px-4 pb-6 pt-5">
        <MigasDePan migas={[{ nombre: "PC y componentes", ruta: "/pc-y-componentes" }, { nombre: "Armá tu PC" }]} />
        <div className="flex max-w-[760px] flex-col gap-2">
          <h1 className="font-display text-[36px] font-bold uppercase leading-none md:text-[44px]">Armá tu PC</h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Arrancá de una PC armada o elegí pieza por pieza. Tocá una fila, elegí en las opciones y pasamos solos a la que falta.
          </p>
        </div>

        {error && <p className="rounded-xl bg-error-fondo p-4 text-sm text-danger">{error}</p>}
        {cargando && <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Cargando los componentes</p>}

        {!cargando && !error && (
          <>
            {armadasConPiezas.length > 0 && (
              <section aria-labelledby="titulo-armadas" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 id="titulo-armadas" className="font-display text-[22px] font-bold uppercase">
                    Arrancá de una armada
                  </h2>
                  <span className="text-sm text-muted-foreground">Ya son compatibles. La cargás en la lista y cambiás lo que quieras.</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {armadasConPiezas.map((a) => {
                    const sel = seleccionDe(a.piezas, porId);
                    const conPiezas = PASOS.filter((p) => sel[p.id]);
                    const lista = conPiezas.length > 0 ? preciosDe(sel[conPiezas[0].id] as ProductoPublico) : [];
                    const totalesDeArmada = lista.map((m) => ({
                      id: m.id,
                      nombre: nombreCortoDeMedio(m),
                      total: conPiezas.reduce((suma, p) => suma + (precioConMedio(sel[p.id] as ProductoPublico, m.id) ?? 0) * (a.piezas[p.id]?.cantidad ?? 1), 0),
                    }));
                    const estado: EstadoDeArmada = armado.origen !== a.id ? "libre" : modificada ? "modificada" : "cargada";
                    return (
                      <TarjetaDeArmada
                        key={a.id}
                        nombre={a.nombre}
                        texto={a.texto}
                        chips={chipsDeArmada(sel, a.piezas)}
                        foto={sel.gabinete ? imagenPrincipal(sel.gabinete) : null}
                        totales={totalesDeArmada}
                        estado={estado}
                        onCargar={() => {
                          cargarArmada(a.id, a.piezas);
                          abrir(null);
                        }}
                      />
                    );
                  })}
                  <article className="flex flex-col justify-between gap-2.5 rounded-2xl border border-dashed border-input p-4">
                    <span className="flex flex-col gap-1.5">
                      <span className="font-display text-lg font-bold uppercase">Desde cero</span>
                      <span className="text-xs leading-snug text-muted-foreground">Elegís cada pieza y te mostramos solo lo compatible con lo que ya elegiste.</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        vaciarArmado();
                        abrir("procesador");
                      }}
                      className="h-10 w-full rounded-xl border border-input px-3.5 text-[13px] font-bold hover:bg-secondary"
                    >
                      Empezar de cero
                    </button>
                  </article>
                </div>
              </section>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Dato
                titulo="Compatibilidad"
                valor={elegidos.length === 0 ? "Sin piezas" : problemas.length === 0 ? "Todo compatible" : problemas.length === 1 ? "1 problema" : `${problemas.length} problemas`}
                detalle={problemas[0]?.texto ?? "Revisamos socket, memoria, formato y potencia"}
                tono={elegidos.length === 0 ? undefined : problemas.length === 0 ? "bien" : "mal"}
              />
              <Dato
                titulo="Potencia"
                valor={`${recomendada} W recomendados`}
                detalle={
                  potenciaDeLaFuente
                    ? `Tu fuente: ${potenciaDeLaFuente} W${potenciaDeLaFuente >= recomendada ? ", alcanza" : ", queda corta"}`
                    : seleccion.fuente
                      ? "Confirmá la potencia en la ficha"
                      : "Falta elegir la fuente"
                }
                tono={potenciaDeLaFuente !== null && potenciaDeLaFuente < recomendada ? "mal" : undefined}
              />
              <Dato
                titulo="Piezas"
                valor={`${resueltas} de ${necesarias.length}`}
                detalle={faltan.length === 0 ? "No falta ninguna" : `Faltan: ${necesarias.filter((p) => !seleccion[p.id] && !armado.yaTengo.includes(p.id)).map((p) => p.nombre.toLowerCase()).join(", ")}`}
              />
              <div className="flex flex-col gap-1 rounded-2xl border border-input bg-card px-4 py-3.5">
                <span className="font-display text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {totales[0] ? `Con ${nombreCortoDeMedio(totales[0].medio).toLowerCase()}` : "Total"}
                </span>
                <span className="text-2xl font-bold tabular-nums">{formatearPesos(totales[0]?.total ?? 0)}</span>
                <span className="text-[13px] tabular-nums text-muted-foreground">
                  {totales[1] ? `${formatearPesos(totales[1].total)} con ${nombreCortoDeMedio(totales[1].medio)}` : "Precios finales con IVA"}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <section aria-label="Piezas" className="flex min-w-0 flex-1 flex-col gap-2.5">
                <ul className="flex flex-col gap-2.5">
                  {PASOS.map((paso) => (
                    <FilaDePieza
                      key={paso.id}
                      paso={paso}
                      producto={seleccion[paso.id] ?? null}
                      cantidad={cantidadDe(paso.id)}
                      tenida={armado.yaTengo.includes(paso.id)}
                      abierta={abierto === paso.id}
                      textoVacio={textoVacioDe(paso)}
                      onAbrir={() => abrir(paso.id)}
                      onQuitar={() => {
                        quitarPieza(paso.id);
                        abrir(paso.id);
                      }}
                      onYaTengo={() => (armado.yaTengo.includes(paso.id) ? alternarYaTengo(paso.id) : tenerla(paso.id))}
                      onCantidad={(n) => cambiarCantidadDePieza(paso.id, Math.max(1, Math.min(4, n)))}
                    >
                      {abierto === paso.id && <div className="mt-3 border-t border-border pt-3 lg:hidden">{panel}</div>}
                    </FilaDePieza>
                  ))}
                </ul>

                {servicios.length > 0 && (
                  <>
                    <div className="mt-2.5 flex flex-col gap-1">
                      <h2 className="font-display text-[22px] font-bold uppercase">Servicios</h2>
                      <p className="text-sm text-muted-foreground">Sumalos si querés que la PC te llegue armada y lista para usar.</p>
                    </div>
                    <ul className="flex flex-col gap-2.5">
                      {servicios.map((s) => (
                        <FilaDeServicio key={s.id} servicio={s} elegido={armado.servicios.includes(s.id)} onAlternar={() => alternarServicioDelArmado(s.id)} />
                      ))}
                    </ul>
                  </>
                )}

                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-4">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[13px] text-muted-foreground">{totales[0] ? `Total con ${nombreCortoDeMedio(totales[0].medio).toLowerCase()}` : "Total"}</span>
                    <span className="text-[26px] font-bold tabular-nums">{formatearPesos(totales[0]?.total ?? 0)}</span>
                    <span className="text-[13px] text-muted-foreground">
                      {totales[1] ? `${formatearPesos(totales[1].total)} con ${nombreCortoDeMedio(totales[1].medio)} · ` : ""}
                      Precios finales con IVA; el envío se calcula en el carrito.
                    </span>
                  </span>
                  {botonAgregar}
                </div>
                {problemas.length > 0 && <p className="text-xs text-danger">Hay piezas que no son compatibles entre sí. Cambiá las que están marcadas para seguir.</p>}
              </section>

              <aside
                aria-label="Opciones de la pieza"
                className={cn(
                  "w-full flex-col gap-4 rounded-2xl border bg-card p-5 lg:sticky lg:top-6 lg:w-[400px] lg:shrink-0",
                  pasoAbierto ? "hidden border-foreground lg:flex" : "flex border-border",
                )}
              >
                {panel}
                {!pasoAbierto && completa && (
                  <>
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success text-background">
                      <Check className="h-6 w-6" aria-hidden />
                    </span>
                    <span className="font-display text-2xl font-bold uppercase leading-none">Tu PC está completa</span>
                    {origen && (
                      <span className="text-[13px] leading-relaxed text-muted-foreground">
                        {modificada ? `Partiste de la ${origen.nombre} y le cambiaste piezas: volvimos a revisar la compatibilidad.` : `Es la ${origen.nombre}, tal como la armamos.`}
                      </span>
                    )}
                    <ul className="flex flex-col gap-1.5 text-[13px]" aria-label="Compatibilidad">
                      {chequeos.map((c) => (
                        <li key={c.id} className="flex items-start gap-2">
                          {c.estado === "compatible" ? (
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                          ) : (
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                          )}
                          <span>{c.texto}</span>
                        </li>
                      ))}
                      {serviciosElegidos.map((s) => (
                        <li key={s.id} className="flex items-start gap-2">
                          <Plus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          <span>{s.nombre}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-col gap-1 border-t border-border pt-3">
                      {totales.map(({ medio, total }, i) => (
                        <div key={medio.id} className="flex items-baseline justify-between gap-3">
                          <span className={cn(i === 0 ? "font-bold" : "text-sm text-muted-foreground")}>Con {nombreCortoDeMedio(medio).toLowerCase()}</span>
                          <span className={cn("font-bold tabular-nums", i === 0 ? "text-2xl" : "text-sm")}>{formatearPesos(total)}</span>
                        </div>
                      ))}
                    </div>
                    {botonAgregar}
                  </>
                )}
                {!pasoAbierto && !completa && (
                  <>
                    <span className="font-display text-[22px] font-bold uppercase leading-none">
                      {elegidos.length === 0 ? "Elegí por dónde empezar" : faltan.length === 1 ? "Te falta 1 pieza" : `Te faltan ${faltan.length} piezas`}
                    </span>
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {problemas.length > 0 ? "Hay piezas incompatibles: cambiá las marcadas en la lista." : "Tocá una fila para ver las opciones compatibles con lo que ya elegiste."}
                    </span>
                    {necesarias
                      .filter((p) => !seleccion[p.id] && !armado.yaTengo.includes(p.id))
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => abrir(p.id)}
                          className="flex h-11 items-center justify-between rounded-xl border border-border bg-background px-3.5 text-sm font-bold hover:border-input"
                        >
                          {p.nombre}
                          <span aria-hidden>→</span>
                        </button>
                      ))}
                  </>
                )}
                <p className="text-xs text-muted-foreground">
                  Cada pieza es de fábrica y tiene su garantía. ¿Dudas con una combinación? <Link to="/ayuda" className="underline">Escribinos</Link>.
                </p>
              </aside>
            </div>
          </>
        )}
      </div>
    </Tienda>
  );
}
