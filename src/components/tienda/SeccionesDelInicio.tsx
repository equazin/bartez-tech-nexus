/**
 * Las secciones del inicio. Cada una lee su configuración del panel (Marketing › Secciones del inicio);
 * el panel las usa también para la vista previa.
 */
import { useEffect, useMemo, useRef, useState, type DependencyList, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, CreditCard, MessageCircle, Receipt, RotateCcw, Truck } from "lucide-react";
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
import { PortadaDelInicio } from "@/components/tienda/PortadaDestacada";
import { CLAVES_PARA_COMPARAR, MAXIMO_EN_CARRUSEL, MAXIMO_EN_GRILLA, type ConfigDeSeccion, type SeccionDelInicio } from "@/lib/tienda/seccionesInicio";
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
  { icono: CreditCard, titulo: "3 cuotas sin interés", texto: "Con tarjeta de crédito por Mercado Pago, o contado por transferencia." },
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

export function Portada({ raices, fotos }: { raices: CategoriaPublica[] | null; fotos: Map<number, string> | null }) {
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
      <div className="flex flex-col gap-4">
        <PortadaDelInicio />
        {accesos.length > 0 && (
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {accesos.map((a) => (
              <Link
                key={a.clave}
                to={a.ruta}
                className="flex min-h-[170px] items-center gap-4 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-input"
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

function QueEstasBuscando({ raices, fotos, titulo, slugs }: { raices: CategoriaPublica[] | null; fotos: Map<number, string> | null; titulo: string; slugs?: string[] }) {
  const accesos = useMemo(() => {
    if (!raices) return [];
    const todas = categoriasPlanas(raices).filter((c) => c.cantidad > 0);
    // Elegidas en el panel, en ese orden; si no hay, las de siempre.
    if (slugs && slugs.length > 0) return slugs.map((slug) => todas.find((c) => c.slug === slug)).filter((c): c is (typeof todas)[number] => Boolean(c)).slice(0, 12);
    const hojas = todas.filter((c) => c.hijas.length === 0);
    const preferidas = ACCESOS_PREFERIDOS.map((slug) => hojas.find((c) => c.slug === slug)).filter((c): c is (typeof hojas)[number] => Boolean(c));
    const resto = hojas.filter((c) => !preferidas.includes(c)).sort((a, b) => b.cantidad - a.cantidad);
    return [...preferidas, ...resto].slice(0, 12);
  }, [raices, (slugs ?? []).join(",")]);

  if (accesos.length === 0) return null;

  return (
    <Bloque etiqueta="Categorías">
      <EncabezadoDeSeccion titulo={titulo} />
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

/** Los productos de una sección: elegidos a mano, los marcados como destacados o los de una categoría. */
function useProductosDeSeccion(raices: CategoriaPublica[] | null, config: ConfigDeSeccion, idsDeCategoria: number[] = []): ProductoPublico[] | null {
  const cantidad = Math.max(1, Math.min(config.cantidad ?? 6, config.formato === "carrusel" ? MAXIMO_EN_CARRUSEL : MAXIMO_EN_GRILLA));
  const fuente = config.fuente ?? "destacados";
  const idsCategoria = fuente === "categoria" ? idsDe(raices, config.categoria ?? "") : idsDeCategoria;
  const elegidos = (config.ids ?? []).slice(0, MAXIMO_EN_CARRUSEL);
  return useCarga(async () => {
    if (fuente === "mano") {
      const lista = await listarProductosPorIds(elegidos);
      const porId = new Map(lista.map((p) => [p.id, p]));
      return elegidos.map((id) => porId.get(id)).filter((p): p is ProductoPublico => Boolean(p) && Boolean(p?.hay_stock)).slice(0, cantidad);
    }
    if (fuente === "categoria" && idsCategoria.length === 0) return [];
    const r = await listarProductos({ categoriaIds: idsCategoria, orden: fuente === "destacados" ? "destacados" : (config.orden ?? "destacados"), porPagina: cantidad, soloConStock: true });
    return r.productos;
  }, [fuente, idsCategoria.join(","), elegidos.join(","), cantidad, config.orden ?? ""]);
}

/** Una fila que se desliza: flechas en la computadora, arrastre con el dedo en el celular. */
function CarruselDeProductos({ productos, cargando }: { productos: ProductoPublico[]; cargando: boolean }) {
  const pista = useRef<HTMLDivElement>(null);
  const mover = (sentido: -1 | 1) => pista.current?.scrollBy({ left: sentido * pista.current.clientWidth * 0.9, behavior: "smooth" });
  if (cargando && productos.length === 0) return <GrillaProductos productos={[]} cargando cantidadEsqueletos={5} columnas="cinco" />;
  return (
    <div className="relative">
      <div ref={pista} className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {productos.map((p) => (
          <div key={p.id} className="w-[220px] shrink-0 snap-start sm:w-[240px]">
            <TarjetaProducto producto={p} />
          </div>
        ))}
      </div>
      {productos.length > 4 && (
        <>
          <button type="button" onClick={() => mover(-1)} aria-label="Ver los anteriores" className="absolute -left-3 top-1/3 hidden h-11 w-11 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-secondary md:flex">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <button type="button" onClick={() => mover(1)} aria-label="Ver más" className="absolute -right-3 top-1/3 hidden h-11 w-11 items-center justify-center rounded-full border border-border bg-card shadow-md hover:bg-secondary md:flex">
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}

function ProductosDeSeccion({ productos, config }: { productos: ProductoPublico[] | null; config: ConfigDeSeccion }) {
  if (config.formato === "carrusel") return <CarruselDeProductos productos={productos ?? []} cargando={productos === null} />;
  const cantidad = Math.min(config.cantidad ?? 6, MAXIMO_EN_GRILLA);
  return <GrillaProductos productos={productos ?? []} cargando={productos === null} cantidadEsqueletos={cantidad} columnas={cantidad <= 4 ? "cuatro" : cantidad === 5 ? "cinco" : "seis"} />;
}

function SeccionDeProductos({ raices, seccion }: { raices: CategoriaPublica[] | null; seccion: SeccionDelInicio }) {
  const config = seccion.config;
  const conPestanas = config.fuente === "destacados" && config.pestanas;
  const pestanas = useMemo(() => {
    const raicesConProductos = (raices ?? []).filter((c) => c.cantidad > 0);
    const elegidas = ["monitores", "notebooks", "perifericos", "pc-y-componentes"]
      .map((slug) => raicesConProductos.find((c) => c.slug === slug))
      .filter((c): c is CategoriaPublica => Boolean(c));
    return [{ id: "todo", nombre: "Todo", ids: [] as number[] }, ...elegidas.map((c) => ({ id: c.slug, nombre: c.nombre, ids: idsConDescendientes(c) }))];
  }, [raices]);
  const [actual, setActual] = useState("todo");
  const pestana = pestanas.find((p) => p.id === actual) ?? pestanas[0];
  const productos = useProductosDeSeccion(raices, config, conPestanas ? pestana.ids : []);
  const nodo = config.fuente === "categoria" && raices ? encontrarCategoria(raices, config.categoria ?? "") : null;
  if (config.fuente === "categoria" && raices && (!nodo || nodo.cantidad === 0)) return null;
  if (productos && productos.length === 0 && !conPestanas) return null;

  return (
    <Bloque etiqueta={seccion.titulo}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <EncabezadoDeSeccion
          titulo={seccion.titulo}
          bajada={seccion.bajada || undefined}
          enlace={nodo ? { texto: nodo.cantidad === 1 ? "Ver el producto" : `Ver los ${nodo.cantidad}`, ruta: `/${nodo.slug}` } : undefined}
        />
        {conPestanas && (
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
        )}
      </div>
      <ProductosDeSeccion productos={productos} config={config} />
    </Bloque>
  );
}

function ElegidoDeLaSemana({ titulo, productoId }: { titulo: string; productoId?: number | null }) {
  const elegido = useCarga(
    () => (productoId ? listarProductosPorIds([productoId]).then((lista) => lista[0] ?? null) : listarDestacados(1).then((lista) => lista[0] ?? null)),
    [productoId ?? 0],
  );
  if (!elegido || elegido.precio_final_ars === null) return null;
  const foto = imagenPrincipal(elegido);
  const datos = datosClaveConEtiqueta(elegido, 5);
  const puntos = paresDeFicha(elegido)
    .filter((p) => !/color|peso|ean/i.test(p.clave))
    .slice(0, 3);

  return (
    <Bloque etiqueta={titulo}>
      <div className="flex flex-wrap items-stretch gap-8 rounded-2xl border border-border bg-card p-6">
        <Link to={rutaDelProducto(elegido)} className="relative flex min-h-[320px] min-w-0 flex-[1_1_340px] items-center justify-center rounded-xl bg-placa-foto">
          <span className="absolute left-4 top-4 rounded-chip bg-primary px-3 py-1.5 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-primary-foreground">
            {titulo}
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

function BloqueDeComponentes({ raices, seccion }: { raices: CategoriaPublica[] | null; seccion: SeccionDelInicio }) {
  const nodo = raices ? encontrarCategoria(raices, seccion.config.categoria || "pc-y-componentes") : null;
  const ids = nodo ? idsConDescendientes(nodo) : [];
  const productos = useProductosDeSeccion(raices, { ...seccion.config, fuente: seccion.config.fuente === "mano" ? "mano" : "categoria", categoria: nodo?.slug ?? "" });
  if (!nodo || nodo.cantidad === 0) return null;
  const hijas = nodo.hijas.filter((h) => h.cantidad > 0);

  return (
    <Bloque etiqueta={nodo.nombre}>
      <EncabezadoDeSeccion titulo={seccion.titulo || nodo.nombre} bajada={seccion.bajada || undefined} enlace={{ texto: `Ver los ${nodo.cantidad} productos`, ruta: `/${nodo.slug}` }} />
      <div className="flex flex-wrap items-stretch gap-3">
        <nav aria-label={`Categorías de ${nodo.nombre}`} className="flex max-w-full flex-[1_1_260px] flex-col rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex flex-col gap-2 rounded-xl bg-background p-4">
            <p className="font-display text-xl font-bold uppercase leading-none">Armá tu PC</p>
            <p className="text-sm leading-relaxed text-muted-foreground">Elegí pieza por pieza y te mostramos solo lo compatible: socket, memoria, formato y potencia.</p>
            <Link to="/arma-tu-pc" className="flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90">
              Empezar a armar
            </Link>
          </div>
          <p className="pb-2.5 text-sm leading-relaxed text-muted-foreground">O mirá cada categoría:</p>
          <ul className="flex flex-wrap gap-2">
            {hijas.map((h) => (
              <li key={h.id}>
                <Link to={`/${h.slug}`} className="flex h-9 items-center gap-1.5 rounded-chip border border-border px-3 text-[13px] font-medium transition-colors hover:border-input hover:bg-secondary">
                  {h.nombre}
                  <span className="tabular-nums text-muted-foreground">{h.cantidad}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 flex-[3_1_600px]">
          <ProductosDeSeccion productos={productos} config={{ ...seccion.config, cantidad: seccion.config.cantidad ?? 4 }} />
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


function Comparador({ raices, seccion }: { raices: CategoriaPublica[] | null; seccion: SeccionDelInicio }) {
  const slug = seccion.config.categoria || "monitores-para-jugar";
  const nodo = raices ? encontrarCategoria(raices, slug) : null;
  const ids = idsDe(raices, slug);
  const elegidos = (seccion.config.ids ?? []).slice(0, 3);
  const productos = useCarga(async () => {
    if (elegidos.length >= 2) {
      const lista = await listarProductosPorIds(elegidos);
      const porId = new Map(lista.map((p) => [p.id, p]));
      return elegidos.map((id) => porId.get(id)).filter((p): p is ProductoPublico => Boolean(p));
    }
    return ids.length ? (await listarProductos({ categoriaIds: ids, orden: "destacados", porPagina: 3, soloConStock: true })).productos : [];
  }, [ids.join(","), elegidos.join(",")]);
  if (!nodo || !productos || productos.length < 2) return null;
  const claves = CLAVES_PARA_COMPARAR.find((c) => c.patron.test(slug))?.claves;
  return (
    <Bloque etiqueta="Comparador">
      <div className="flex flex-wrap gap-8 rounded-2xl border border-border bg-card p-7">
        <div className="flex flex-[1_1_280px] flex-col justify-center gap-3">
          <p className="font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Comparador</p>
          <h2 className="font-display text-[30px] font-bold uppercase leading-[1.05]">{seccion.titulo || `Tres ${nodo.nombre.toLowerCase()}, lado a lado.`}</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {seccion.bajada || "Marcá hasta tres productos en cualquier lista y te mostramos qué cambia de verdad. Lo que mejora queda resaltado."}
          </p>
          <Link to={`/${nodo.slug}`} className="flex h-11 items-center self-start rounded-xl bg-primary px-5 text-[15px] font-bold text-primary-foreground hover:bg-primary/90">
            Ver {nodo.nombre.toLowerCase()}
          </Link>
        </div>
        <TablaComparativa productos={productos} claves={claves} cortos className="min-w-0 flex-[2_1_560px]" />
      </div>
    </Bloque>
  );
}

function Marcas({ titulo }: { titulo: string }) {
  const marcas = useCarga(() => listarMarcasDeCategoria([]), []);
  if (!marcas || marcas.length === 0) return null;
  return (
    <Bloque etiqueta="Marcas">
      <EncabezadoDeSeccion titulo={titulo} />
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


function PorUso({ raices, fotos }: { raices: CategoriaPublica[] | null; fotos: Map<number, string> | null }) {
  const paraTrabajar = raices ? encontrarCategoria(raices, "monitores-para-trabajar-y-estudiar") : null;
  const notebooks = raices ? encontrarCategoria(raices, "notebooks") : null;
  if ((paraTrabajar?.cantidad ?? 0) + (notebooks?.cantidad ?? 0) === 0) return null;
  return (
    <Bloque etiqueta="Por uso">
      <div className="flex flex-wrap gap-4">
        {paraTrabajar && paraTrabajar.cantidad > 0 && <AccesoPorUso nodo={paraTrabajar} titulo="Para trabajar y estudiar" fotos={fotos} />}
        {notebooks && notebooks.cantidad > 0 && <AccesoPorUso nodo={notebooks} titulo="Notebooks de fábrica" fotos={fotos} />}
      </div>
    </Bloque>
  );
}

/** Una sección del inicio según su tipo y su configuración del panel. */
export function SeccionDelInicioVista({ seccion, raices, fotos }: { seccion: SeccionDelInicio; raices: CategoriaPublica[] | null; fotos: Map<number, string> | null }) {
  switch (seccion.tipo) {
    case "portada":
      return <Portada raices={raices} fotos={fotos} />;
    case "categorias":
      return <QueEstasBuscando raices={raices} fotos={fotos} titulo={seccion.titulo || "Qué estás buscando"} slugs={seccion.config.slugs} />;
    case "productos":
      return <SeccionDeProductos raices={raices} seccion={seccion} />;
    case "elegido":
      return <ElegidoDeLaSemana titulo={seccion.titulo || "Elegido de la semana"} productoId={seccion.config.producto_id} />;
    case "componentes":
      return <BloqueDeComponentes raices={raices} seccion={seccion} />;
    case "comparador":
      return <Comparador raices={raices} seccion={seccion} />;
    case "por_uso":
      return <PorUso raices={raices} fotos={fotos} />;
    case "marcas":
      return <Marcas titulo={seccion.titulo || "Marcas"} />;
    case "ayuda":
      return <Ayuda />;
    default:
      return null;
  }
}
