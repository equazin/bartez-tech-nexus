import { useEffect, useMemo, useState, type DependencyList, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, CreditCard, MessageCircle, Receipt, RotateCcw, Truck } from "lucide-react";
import { Tienda } from "@/components/tienda/Tienda";
import { Bloque, EncabezadoDeSeccion } from "@/components/tienda/Seccion";
import { ChipsDeDatos, EstadoDeStock, GrillaProductos, TarjetaProducto, agregarYAvisar } from "@/components/tienda/TarjetaProducto";
import { PreciosDelProducto } from "@/components/tienda/Precio";
import { TablaComparativa } from "@/components/tienda/TablaComparativa";
import {
  categoriasPlanas,
  encontrarCategoria,
  fotoDeCategoria,
  fotosPorCategoria,
  idsConDescendientes,
  imagenPrincipal,
  listarCategorias,
  listarDestacados,
  listarMarcasDeCategoria,
  listarProductos,
  listarProductosPorIds,
  precioDesde,
  rutaDelProducto,
  type CategoriaPublica,
  type ProductoPublico,
} from "@/lib/tienda/catalogo";
import { formatearPesos } from "@/lib/tienda/dinero";
import { datosClaveConEtiqueta, paresDeFicha } from "@/lib/tienda/ficha";
import { useContenidoLegal } from "@/lib/tienda/legal";
import { usarSeo } from "@/lib/tienda/seo";
import { chipsDeArmada } from "@/components/tienda/ArmadorPartes";
import { seleccionDe } from "@/lib/tienda/componentes";
import { listarPcArmadas } from "@/lib/tienda/pcArmadas";
import { nombreCortoDeMedio, precioConMedio, preciosDe } from "@/lib/tienda/precios";
import { useServicios } from "@/lib/tienda/servicios";
import { PASOS } from "@/lib/tienda/armador";
import { cn } from "@/lib/utils";

/** Carga asíncrona con cancelación: el valor queda en null mientras carga o si falla. */
function useCarga<T>(cargar: () => Promise<T>, dependencias: DependencyList): T | null {
  const [valor, setValor] = useState<T | null>(null);
  useEffect(() => {
    let cancelado = false;
    setValor(null);
    cargar()
      .then((v) => {
        if (!cancelado) setValor(v);
      })
      .catch(() => {
        if (!cancelado) setValor(null);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);
  return valor;
}

const PROMESAS = [
  { icono: Truck, titulo: "Envío a todo el país", texto: "Mismo precio y plazo en cualquier provincia." },
  { icono: Receipt, titulo: "Precio final", texto: "Con IVA incluido, sin sorpresas al pagar." },
  { icono: CreditCard, titulo: "Cuotas con Mercado Pago", texto: "O contado por transferencia bancaria." },
  { icono: RotateCcw, titulo: "10 días para arrepentirte", texto: "Desde que lo recibís, sin registrarte." },
];

/** Las subcategorías que van primero en "Qué estás buscando"; el resto completa hasta doce. */
const ACCESOS_PREFERIDOS = [
  "notebooks-para-estudiar-y-trabajar",
  "notebooks-gamer",
  "monitores-para-jugar",
  "monitores-para-trabajar-y-estudiar",
  "teclados",
  "mouse",
  "auriculares",
  "placas-de-video",
  "procesadores",
  "memorias-ram",
  "discos-internos",
  "routers-y-wifi",
];

function idsDe(raices: CategoriaPublica[] | null, slug: string): number[] {
  if (!raices) return [];
  const nodo = encontrarCategoria(raices, slug);
  return nodo ? idsConDescendientes(nodo) : [];
}

/** La primera PC armada del panel con sus piezas: la portada la muestra en lugar de una foto de ambiente. */
function usePcDePortada() {
  return useCarga(async () => {
    const [primera] = await listarPcArmadas();
    if (!primera) return null;
    const ids = PASOS.map((p) => primera.piezas[p.id]?.id).filter((id): id is number => typeof id === "number");
    const productos = await listarProductosPorIds(ids);
    const seleccion = seleccionDe(primera.piezas, new Map(productos.map((p) => [p.id, p])));
    const conPiezas = PASOS.filter((p) => seleccion[p.id]);
    if (conPiezas.length === 0) return null;
    const medios = preciosDe(seleccion[conPiezas[0].id] as ProductoPublico);
    const totales = medios.map((m) => ({
      medio: m,
      total: conPiezas.reduce((suma, p) => suma + (precioConMedio(seleccion[p.id] as ProductoPublico, m.id) ?? 0) * (primera.piezas[p.id]?.cantidad ?? 1), 0),
    }));
    return { armada: primera, seleccion, chips: chipsDeArmada(seleccion, primera.piezas), totales };
  }, []);
}

function PortadaDeProducto() {
  const pc = usePcDePortada();
  const servicios = useServicios();
  const conArmado = servicios.some((s) => /armado/i.test(s.nombre));

  if (!pc) {
    return (
      <div className="flex min-h-[460px] min-w-0 flex-[2_1_560px] flex-col justify-center gap-4 rounded-2xl bg-placa-foto p-7 text-texto-placa md:p-12">
        <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-primary">Notebooks · Gaming · Monitores · Componentes</p>
        <h1 className="font-display text-[48px] font-extrabold uppercase leading-[0.95] md:text-[68px]">Subí tu mundo.</h1>
        <p className="max-w-[520px] text-lg leading-relaxed">Equipos de fábrica, elegidos y explicados, con el precio final a la vista y envío al mismo precio en todo el país.</p>
      </div>
    );
  }

  const { armada, seleccion, chips, totales } = pc;
  const gabinete = seleccion.gabinete ? imagenPrincipal(seleccion.gabinete) : null;
  const miniaturas = [seleccion.video, seleccion.procesador].filter((p): p is ProductoPublico => Boolean(p)).map(imagenPrincipal).filter((f): f is string => Boolean(f));
  return (
    <div className="grid min-h-[460px] min-w-0 flex-[2_1_560px] overflow-hidden rounded-2xl bg-placa-foto text-texto-placa md:grid-cols-[1.05fr_1fr]">
      <div className="flex flex-col justify-center gap-4 p-7 md:p-11">
        <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-primary">PC armadas</p>
        <h1 className="font-display text-[44px] font-extrabold uppercase leading-[0.95] md:text-[58px]">{armada.nombre}, compatible pieza por pieza</h1>
        <p className="text-base leading-relaxed opacity-80">
          {chips.join(" · ")}.{conArmado ? " La armamos, la probamos y te llega lista para enchufar." : " Todas las piezas compatibles entre sí."}
        </p>
        {totales[0] && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[34px] font-extrabold tabular-nums tracking-[-0.02em]">
              {formatearPesos(totales[0].total)}{" "}
              <span className="text-[15px] font-medium tracking-normal opacity-80">con {nombreCortoDeMedio(totales[0].medio).toLowerCase()}</span>
            </span>
            {totales[1] && (
              <span className="text-sm tabular-nums opacity-80">
                {formatearPesos(totales[1].total)} con {nombreCortoDeMedio(totales[1].medio)}
              </span>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2.5 pt-1">
          <Link to={`/arma-tu-pc?armada=${armada.id}`} className="flex h-12 items-center rounded-xl bg-primary px-6 font-bold text-primary-foreground hover:bg-primary/90">
            Ver la PC
          </Link>
          <Link to="/arma-tu-pc" className="flex h-12 items-center rounded-xl border border-texto-placa px-6 font-bold hover:bg-white/40">
            Armá la tuya
          </Link>
        </div>
      </div>
      <div className="relative flex min-h-[300px] items-center justify-center bg-placa-foto-2">
        {gabinete && <img src={gabinete} alt="" className="max-h-[340px] max-w-[62%] object-contain mix-blend-multiply" />}
        {miniaturas.length > 0 && (
          <span className="absolute bottom-6 left-6 flex gap-2.5">
            {miniaturas.map((foto) => (
              <span key={foto} className="flex h-[84px] w-[84px] items-center justify-center rounded-2xl bg-white shadow-[0_6px_20px_-12px_rgba(0,0,0,0.4)]">
                <img src={foto} alt="" className="max-h-[66px] max-w-[66px] object-contain" />
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

function Portada({ raices, fotos }: { raices: CategoriaPublica[] | null; fotos: Map<number, string> | null }) {
  const jugar = raices ? encontrarCategoria(raices, "monitores-para-jugar") : null;
  const componentes = raices ? encontrarCategoria(raices, "pc-y-componentes") : null;
  const desdeJugar = useCarga(() => (jugar ? precioDesde(idsConDescendientes(jugar)) : Promise.resolve(null)), [jugar?.id]);

  const accesos = [
    jugar && {
      clave: "jugar",
      rotulo: "Gaming",
      titulo: (
        <>
          Más FPS. <span className="text-primary">Menos excusas.</span>
        </>
      ),
      texto: desdeJugar ? `Monitores para jugar desde ${formatearPesos(desdeJugar)}.` : "Monitores para jugar, con el dato que importa a la vista.",
      enlace: "Ver monitores para jugar",
      ruta: `/${jugar.slug}`,
      foto: fotos ? fotoDeCategoria(jugar, fotos) : null,
    },
    componentes && {
      clave: "componentes",
      rotulo: "Nuevo en Teqo",
      titulo: <>PC y componentes</>,
      texto: "Placas de video, procesadores, memorias, discos, fuentes y gabinetes.",
      enlace: "Ver componentes",
      ruta: `/${componentes.slug}`,
      foto: fotos ? fotoDeCategoria(componentes, fotos) : null,
    },
  ].filter(Boolean) as Array<{ clave: string; rotulo: string; titulo: ReactNode; texto: string; enlace: string; ruta: string; foto: string | null }>;

  return (
    <Bloque className="pt-6" etiqueta="Portada">
      <div className="flex flex-wrap gap-4">
        <PortadaDeProducto />
        {accesos.length > 0 && (
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            {accesos.map((a) => (
              <Link
                key={a.clave}
                to={a.ruta}
                className="flex min-h-[200px] flex-1 items-center gap-4 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-input"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{a.rotulo}</span>
                  <span className="font-display text-[28px] font-bold uppercase leading-none">{a.titulo}</span>
                  <span className="text-sm leading-snug text-muted-foreground">{a.texto}</span>
                  <span className="text-sm font-bold">{a.enlace} →</span>
                </div>
                {a.foto && (
                  <span className="flex h-[140px] w-[140px] shrink-0 items-center justify-center rounded-xl bg-placa-foto">
                    <img src={a.foto} alt="" className="max-h-[120px] max-w-[120px] object-contain mix-blend-multiply" />
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
      <ul className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        {PROMESAS.map(({ icono: Icono, titulo, texto }) => (
          <li key={titulo} className="flex items-center gap-3.5 bg-card px-5 py-[18px]">
            <Icono className="h-7 w-7 shrink-0" strokeWidth={1.8} aria-hidden />
            <div>
              <p className="text-[15px] font-bold">{titulo}</p>
              <p className="text-[13px] text-muted-foreground">{texto}</p>
            </div>
          </li>
        ))}
      </ul>
    </Bloque>
  );
}

function QueEstasBuscando({ raices, fotos }: { raices: CategoriaPublica[] | null; fotos: Map<number, string> | null }) {
  const accesos = useMemo(() => {
    if (!raices) return [];
    const hojas = categoriasPlanas(raices).filter((c) => c.hijas.length === 0 && c.cantidad > 0);
    const preferidas = ACCESOS_PREFERIDOS.map((slug) => hojas.find((c) => c.slug === slug)).filter((c): c is (typeof hojas)[number] => Boolean(c));
    const resto = hojas.filter((c) => !preferidas.includes(c)).sort((a, b) => b.cantidad - a.cantidad);
    return [...preferidas, ...resto].slice(0, 12);
  }, [raices]);

  if (accesos.length === 0) return null;

  return (
    <Bloque etiqueta="Categorías">
      <EncabezadoDeSeccion titulo="Qué estás buscando" />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {accesos.map((c) => {
          const foto = fotos ? fotoDeCategoria(c, fotos) : null;
          return (
            <li key={c.id}>
              <Link to={`/${c.slug}`} className="flex h-full flex-col gap-2.5 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-input">
                <span className="flex h-[120px] items-center justify-center rounded-xl bg-placa-foto">
                  {foto && <img src={foto} alt="" loading="lazy" className="max-h-[100px] max-w-[82%] object-contain mix-blend-multiply" />}
                </span>
                <span className="flex flex-col gap-0.5 px-1 pb-1">
                  <span className="text-[15px] font-bold leading-tight">{c.nombre}</span>
                  <span className="text-[13px] text-muted-foreground">{c.cantidad === 1 ? "1 producto" : `${c.cantidad} productos`}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Bloque>
  );
}

function Destacados({ raices }: { raices: CategoriaPublica[] | null }) {
  const pestanas = useMemo(() => {
    const raicesConProductos = (raices ?? []).filter((c) => c.cantidad > 0);
    const elegidas = ["monitores", "notebooks", "perifericos", "pc-y-componentes"]
      .map((slug) => raicesConProductos.find((c) => c.slug === slug))
      .filter((c): c is CategoriaPublica => Boolean(c));
    return [{ id: "todo", nombre: "Todo", ids: [] as number[] }, ...elegidas.map((c) => ({ id: c.slug, nombre: c.nombre, ids: idsConDescendientes(c) }))];
  }, [raices]);
  const [actual, setActual] = useState("todo");
  const pestana = pestanas.find((p) => p.id === actual) ?? pestanas[0];
  const productos = useCarga(
    () => listarProductos({ categoriaIds: pestana.ids, orden: "destacados", porPagina: 6, soloConStock: true }).then((r) => r.productos),
    [pestana.id, pestana.ids.join(",")],
  );

  return (
    <Bloque etiqueta="Destacados">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <EncabezadoDeSeccion titulo="Destacados" bajada="Elegidos por el equipo de Teqo esta semana." />
        <div role="tablist" aria-label="Filtrar destacados" className="flex flex-wrap gap-2">
          {pestanas.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={p.id === pestana.id}
              onClick={() => setActual(p.id)}
              className={cn(
                "h-10 rounded-chip border px-4 text-sm font-bold transition-colors",
                p.id === pestana.id ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:border-input",
              )}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      </div>
      <GrillaProductos productos={productos ?? []} cargando={productos === null} cantidadEsqueletos={6} columnas="seis" />
    </Bloque>
  );
}

function ElegidoDeLaSemana() {
  const elegido = useCarga(() => listarDestacados(1).then((lista) => lista[0] ?? null), []);
  if (!elegido || elegido.precio_final_ars === null) return null;
  const foto = imagenPrincipal(elegido);
  const datos = datosClaveConEtiqueta(elegido, 5);
  const puntos = paresDeFicha(elegido)
    .filter((p) => !/color|peso|ean/i.test(p.clave))
    .slice(0, 3);

  return (
    <Bloque etiqueta="Elegido de la semana">
      <div className="flex flex-wrap items-stretch gap-8 rounded-2xl border border-border bg-card p-6">
        <Link to={rutaDelProducto(elegido)} className="relative flex min-h-[320px] min-w-0 flex-[1_1_340px] items-center justify-center rounded-xl bg-placa-foto">
          <span className="absolute left-4 top-4 rounded-chip bg-primary px-3 py-1.5 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-primary-foreground">
            Elegido de la semana
          </span>
          {foto && <img src={foto} alt={elegido.nombre} className="max-h-[280px] max-w-[82%] object-contain mix-blend-multiply" />}
        </Link>
        <div className="flex min-w-0 flex-[1.2_1_360px] flex-col justify-center gap-4">
          <p className="font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {[elegido.marca, elegido.categoria_nombre].filter(Boolean).join(" · ")}
          </p>
          <h2 className="text-[26px] font-bold leading-tight md:text-[30px]">
            <Link to={rutaDelProducto(elegido)} className="hover:underline">
              {elegido.nombre}
            </Link>
          </h2>
          <ChipsDeDatos datos={datos.map((d) => d.valor)} className="[&>li]:px-3 [&>li]:py-1.5 [&>li]:text-sm" />
          {puntos.length > 0 && (
            <ul className="flex flex-col gap-2.5">
              {puntos.map((p) => (
                <li key={p.clave} className="flex items-start gap-2.5 text-[15px] leading-snug text-muted-foreground">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
                  <span>
                    <span className="text-foreground">{p.clave}:</span> {p.valor}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex min-w-[240px] flex-[0_1_280px] flex-col justify-center gap-3 rounded-2xl border border-border bg-background p-5">
          <PreciosDelProducto producto={elegido} tamano="destacado" />
          <EstadoDeStock producto={elegido} />
          <button
            type="button"
            disabled={!elegido.hay_stock}
            onClick={() => agregarYAvisar(elegido)}
            className="h-12 rounded-xl bg-primary font-bold text-primary-foreground hover:bg-primary/90 disabled:bg-secondary disabled:text-muted-foreground"
          >
            Agregar al carrito
          </button>
          <Link to={rutaDelProducto(elegido)} className="flex h-11 items-center justify-center rounded-xl border border-input text-sm font-bold hover:bg-secondary">
            Ver la ficha completa
          </Link>
        </div>
      </div>
    </Bloque>
  );
}

function BloqueDeComponentes({ raices }: { raices: CategoriaPublica[] | null }) {
  const nodo = raices ? encontrarCategoria(raices, "pc-y-componentes") : null;
  const ids = nodo ? idsConDescendientes(nodo) : [];
  const productos = useCarga(
    () => (ids.length ? listarProductos({ categoriaIds: ids, orden: "destacados", porPagina: 4, soloConStock: true }).then((r) => r.productos) : Promise.resolve([])),
    [ids.join(",")],
  );
  if (!nodo || nodo.cantidad === 0) return null;
  const hijas = nodo.hijas.filter((h) => h.cantidad > 0);

  return (
    <Bloque etiqueta={nodo.nombre}>
      <EncabezadoDeSeccion titulo={nodo.nombre} enlace={{ texto: `Ver los ${nodo.cantidad} productos`, ruta: `/${nodo.slug}` }} />
      <div className="flex flex-wrap items-stretch gap-3">
        <nav aria-label={`Categorías de ${nodo.nombre}`} className="flex max-w-full flex-[1_1_260px] flex-col rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex flex-col gap-2 rounded-xl bg-background p-4">
            <p className="font-display text-xl font-bold uppercase leading-none">Armá tu PC</p>
            <p className="text-sm leading-relaxed text-muted-foreground">Elegí pieza por pieza y te mostramos solo lo compatible: socket, memoria, formato y potencia.</p>
            <Link to="/arma-tu-pc" className="flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90">
              Empezar a armar
            </Link>
          </div>
          <p className="pb-2 text-sm leading-relaxed text-muted-foreground">O mirá cada categoría:</p>
          {hijas.map((h) => (
            <Link key={h.id} to={`/${h.slug}`} className="flex min-h-11 items-center justify-between border-t border-border text-[15px] font-medium hover:underline">
              <span>{h.nombre}</span>
              <span className="text-[13px] tabular-nums text-muted-foreground">{h.cantidad}</span>
            </Link>
          ))}
        </nav>
        <div className="grid min-w-0 flex-[3_1_600px] grid-cols-2 gap-3 lg:grid-cols-4">
          {(productos ?? []).map((p) => (
            <TarjetaProducto key={p.id} producto={p} />
          ))}
        </div>
      </div>
    </Bloque>
  );
}

function AccesoPorUso({ nodo, titulo, fotos }: { nodo: CategoriaPublica; titulo: string; fotos: Map<number, string> | null }) {
  const desde = useCarga(() => precioDesde(idsConDescendientes(nodo)), [nodo.id]);
  const foto = fotos ? fotoDeCategoria(nodo, fotos) : null;
  return (
    <Link to={`/${nodo.slug}`} className="flex min-w-0 flex-[1_1_420px] items-center gap-5 rounded-2xl border border-border bg-card p-7 transition-colors hover:border-input">
      <div className="flex flex-1 flex-col gap-2">
        <span className="font-display text-[26px] font-bold uppercase leading-none">{titulo}</span>
        <span className="text-[15px] leading-snug text-muted-foreground">
          {nodo.descripcion ?? `${nodo.nombre}.`}
          {desde ? ` Desde ${formatearPesos(desde)}.` : ""}
        </span>
        <span className="text-sm font-bold">Ver {nodo.nombre.toLowerCase()} →</span>
      </div>
      {foto && (
        <span className="flex h-[130px] w-[150px] shrink-0 items-center justify-center rounded-xl bg-placa-foto">
          <img src={foto} alt="" loading="lazy" className="max-h-[110px] max-w-[130px] object-contain mix-blend-multiply" />
        </span>
      )}
    </Link>
  );
}

function FilaDeCategoria({ raices, slug, columnas = "cinco", cantidad = 5 }: { raices: CategoriaPublica[] | null; slug: string; columnas?: "cinco" | "seis"; cantidad?: number }) {
  const nodo = raices ? encontrarCategoria(raices, slug) : null;
  const ids = nodo ? idsConDescendientes(nodo) : [];
  const productos = useCarga(
    () => (ids.length ? listarProductos({ categoriaIds: ids, orden: "destacados", porPagina: cantidad, soloConStock: true }).then((r) => r.productos) : Promise.resolve([])),
    [ids.join(",")],
  );
  if (!nodo || nodo.cantidad === 0) return null;
  return (
    <Bloque etiqueta={nodo.nombre}>
      <EncabezadoDeSeccion titulo={nodo.nombre} enlace={{ texto: nodo.cantidad === 1 ? "Ver el producto" : `Ver los ${nodo.cantidad}`, ruta: `/${nodo.slug}` }} />
      <GrillaProductos productos={productos ?? []} cargando={productos === null} cantidadEsqueletos={cantidad} columnas={columnas} />
    </Bloque>
  );
}

function Comparador({ raices }: { raices: CategoriaPublica[] | null }) {
  const ids = idsDe(raices, "monitores-para-jugar");
  const monitores = useCarga(
    () => (ids.length ? listarProductos({ categoriaIds: ids, orden: "destacados", porPagina: 3, soloConStock: true }).then((r) => r.productos) : Promise.resolve([])),
    [ids.join(",")],
  );
  if (!monitores || monitores.length < 2) return null;
  return (
    <Bloque etiqueta="Comparador">
      <div className="flex flex-wrap gap-8 rounded-2xl border border-border bg-card p-7">
        <div className="flex flex-[1_1_280px] flex-col justify-center gap-3">
          <p className="font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Comparador</p>
          <h2 className="font-display text-[30px] font-bold uppercase leading-[1.05]">Tres monitores, lado a lado.</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            Marcá hasta tres productos en cualquier lista y te mostramos qué cambia de verdad. Lo que mejora queda resaltado.
          </p>
          <Link to="/monitores-para-jugar" className="flex h-11 items-center self-start rounded-xl bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90">
            Elegir monitores
          </Link>
        </div>
        <TablaComparativa
          productos={monitores}
          claves={["Pantalla", "Panel", "Resolución", "Frecuencia", "Tiempo de respuesta"]}
          cortos
          className="min-w-0 flex-[2_1_560px]"
        />
      </div>
    </Bloque>
  );
}

function Marcas() {
  const marcas = useCarga(() => listarMarcasDeCategoria([]), []);
  if (!marcas || marcas.length === 0) return null;
  return (
    <Bloque etiqueta="Marcas">
      <EncabezadoDeSeccion titulo="Marcas" />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {marcas.slice(0, 14).map((m) => (
          <li key={m.id}>
            <Link
              to={`/buscar?q=${encodeURIComponent(m.nombre)}`}
              className="flex h-16 items-center justify-center rounded-xl border border-border bg-card px-2 text-center font-display text-[17px] font-bold tracking-[0.04em] transition-colors hover:border-input"
            >
              {m.nombre}
            </Link>
          </li>
        ))}
      </ul>
    </Bloque>
  );
}

function Ayuda() {
  const { datos_legales: datos } = useContenidoLegal();
  const numero = datos.telefono?.replace(/\D/g, "") ?? "";
  return (
    <Bloque etiqueta="Ayuda">
      <div className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-border bg-card px-7 py-6">
        <div className="flex min-w-0 flex-[1_1_420px] items-center gap-4">
          <MessageCircle className="h-9 w-9 shrink-0" strokeWidth={1.8} aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-lg font-bold">¿Dudás entre dos modelos?</p>
            <p className="text-[15px] text-muted-foreground">
              {numero ? `Escribinos por WhatsApp al ${datos.telefono}. Te contestamos con la ficha en la mano.` : "Mirá cómo comprar, pagar y recibir, o escribinos y te contestamos con la ficha en la mano."}
            </p>
          </div>
        </div>
        {numero ? (
          <a href={`https://wa.me/${numero}`} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center rounded-xl border border-foreground px-5 text-[15px] font-bold hover:bg-secondary">
            Escribinos
          </a>
        ) : (
          <Link to="/ayuda" className="flex h-11 items-center rounded-xl border border-foreground px-5 text-[15px] font-bold hover:bg-secondary">
            Ver la ayuda
          </Link>
        )}
      </div>
    </Bloque>
  );
}

export default function Inicio() {
  usarSeo("Notebooks, gaming, monitores, periféricos y componentes", "Tecnología para trabajar, crear y jugar, con envío a todo el país y precios finales con IVA incluido.");

  const raices = useCarga(() => listarCategorias(), []);
  const fotos = useCarga(() => fotosPorCategoria(), []);
  const paraTrabajar = raices ? encontrarCategoria(raices, "monitores-para-trabajar-y-estudiar") : null;
  const notebooks = raices ? encontrarCategoria(raices, "notebooks") : null;

  return (
    <Tienda>
      <div className="flex flex-col gap-14 pb-4">
        <Portada raices={raices} fotos={fotos} />
        <QueEstasBuscando raices={raices} fotos={fotos} />
        <Destacados raices={raices} />
        <ElegidoDeLaSemana />
        <BloqueDeComponentes raices={raices} />
        {(paraTrabajar?.cantidad ?? 0) + (notebooks?.cantidad ?? 0) > 0 && (
          <Bloque etiqueta="Por uso">
            <div className="flex flex-wrap gap-4">
              {paraTrabajar && paraTrabajar.cantidad > 0 && <AccesoPorUso nodo={paraTrabajar} titulo="Para trabajar y estudiar" fotos={fotos} />}
              {notebooks && notebooks.cantidad > 0 && <AccesoPorUso nodo={notebooks} titulo="Notebooks de fábrica" fotos={fotos} />}
            </div>
          </Bloque>
        )}
        <FilaDeCategoria raices={raices} slug="notebooks" />
        <Comparador raices={raices} />
        <FilaDeCategoria raices={raices} slug="perifericos" columnas="seis" cantidad={6} />
        <Marcas />
        <Ayuda />
      </div>
    </Tienda>
  );
}
