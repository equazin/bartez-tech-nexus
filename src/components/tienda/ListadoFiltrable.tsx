import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { GrillaProductos } from "@/components/tienda/TarjetaProducto";
import { ORDENES, POR_PAGINA, type OrdenDelCatalogo, type ProductoPublico } from "@/lib/tienda/catalogo";
import { formatearPesos } from "@/lib/tienda/dinero";
import {
  SIN_FILTROS,
  aplicarFiltros,
  cantidadDeFiltros,
  escribirSeleccion,
  facetasDe,
  leerSeleccion,
  marcasDe,
  ordenarProductos,
  type Faceta,
  type OpcionDeFiltro,
  type SeleccionDeFiltros,
} from "@/lib/tienda/filtros";
import { cn } from "@/lib/utils";

function esOrden(valor: string | null): valor is OrdenDelCatalogo {
  return ORDENES.some((o) => o.valor === valor);
}

function alternar(lista: string[], valor: string): string[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

function GrupoDeOpciones({ titulo, opciones, elegidas, onAlternar }: { titulo: string; opciones: OpcionDeFiltro[]; elegidas: string[]; onAlternar: (valor: string) => void }) {
  return (
    <fieldset className="flex flex-col gap-1 border-b border-border py-3.5">
      <legend className="float-left w-full pb-2 pt-3.5 font-display text-sm font-bold uppercase tracking-[0.08em]">{titulo}</legend>
      {opciones.map((o) => (
        <label key={o.valor} className="flex min-h-[34px] cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" checked={elegidas.includes(o.valor)} onChange={() => onAlternar(o.valor)} className="h-[18px] w-[18px] accent-primary" />
          <span className="flex-1">{o.valor}</span>
          <span className="text-[13px] tabular-nums text-muted-foreground">{o.cantidad}</span>
        </label>
      ))}
    </fieldset>
  );
}

function FiltroDePrecio({ seleccion, onCambiar }: { seleccion: SeleccionDeFiltros; onCambiar: (s: SeleccionDeFiltros) => void }) {
  const [desde, setDesde] = useState(seleccion.min ? String(seleccion.min) : "");
  const [hasta, setHasta] = useState(seleccion.max ? String(seleccion.max) : "");

  useEffect(() => {
    setDesde(seleccion.min ? String(seleccion.min) : "");
    setHasta(seleccion.max ? String(seleccion.max) : "");
  }, [seleccion.min, seleccion.max]);

  function aplicar(evento: FormEvent) {
    evento.preventDefault();
    const leer = (texto: string) => {
      const n = Number(texto.replace(/\D/g, ""));
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    onCambiar({ ...seleccion, min: leer(desde), max: leer(hasta) });
  }

  const campo = "h-10 min-w-0 rounded-xl border border-input bg-background px-2.5 text-sm text-foreground";
  return (
    <form onSubmit={aplicar} className="flex flex-col gap-2.5 pt-3.5">
      <p className="font-display text-sm font-bold uppercase tracking-[0.08em]">Precio</p>
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Desde
          <input inputMode="numeric" value={desde} onChange={(e) => setDesde(e.target.value)} placeholder="$" className={campo} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Hasta
          <input inputMode="numeric" value={hasta} onChange={(e) => setHasta(e.target.value)} placeholder="$" className={campo} />
        </label>
      </div>
      <button type="submit" className="h-11 rounded-xl border border-foreground text-sm font-bold hover:bg-secondary">
        Aplicar
      </button>
    </form>
  );
}

interface PropsDePanel {
  seleccion: SeleccionDeFiltros;
  marcas: OpcionDeFiltro[];
  facetas: Faceta[];
  onCambiar: (s: SeleccionDeFiltros) => void;
}

function PanelDeFiltros({ seleccion, marcas, facetas, onCambiar }: PropsDePanel) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card px-[18px] pb-[18px] pt-1">
      {marcas.length > 1 && (
        <GrupoDeOpciones titulo="Marca" opciones={marcas} elegidas={seleccion.marcas} onAlternar={(v) => onCambiar({ ...seleccion, marcas: alternar(seleccion.marcas, v) })} />
      )}
      {facetas.map((f) => (
        <GrupoDeOpciones
          key={f.clave}
          titulo={f.clave}
          opciones={f.opciones}
          elegidas={seleccion.facetas[f.clave] ?? []}
          onAlternar={(v) => onCambiar({ ...seleccion, facetas: { ...seleccion.facetas, [f.clave]: alternar(seleccion.facetas[f.clave] ?? [], v) } })}
        />
      ))}
      <fieldset className="flex flex-col border-b border-border py-3.5">
        <legend className="float-left w-full pb-2 pt-3.5 font-display text-sm font-bold uppercase tracking-[0.08em]">Disponibilidad</legend>
        <label className="flex min-h-[34px] cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" checked={seleccion.soloStock} onChange={() => onCambiar({ ...seleccion, soloStock: !seleccion.soloStock })} className="h-[18px] w-[18px] accent-primary" />
          Solo con stock
        </label>
      </fieldset>
      <FiltroDePrecio seleccion={seleccion} onCambiar={onCambiar} />
    </div>
  );
}

function ChipsActivos({ seleccion, onCambiar }: { seleccion: SeleccionDeFiltros; onCambiar: (s: SeleccionDeFiltros) => void }) {
  const chips: Array<{ clave: string; texto: string; quitar: () => SeleccionDeFiltros }> = [
    ...seleccion.marcas.map((m) => ({ clave: `m-${m}`, texto: m, quitar: () => ({ ...seleccion, marcas: seleccion.marcas.filter((x) => x !== m) }) })),
    ...Object.entries(seleccion.facetas).flatMap(([clave, valores]) =>
      valores.map((v) => ({
        clave: `f-${clave}-${v}`,
        texto: `${clave}: ${v}`,
        quitar: () => ({ ...seleccion, facetas: { ...seleccion.facetas, [clave]: valores.filter((x) => x !== v) } }),
      })),
    ),
    ...(seleccion.min !== null ? [{ clave: "min", texto: `Desde ${formatearPesos(seleccion.min)}`, quitar: () => ({ ...seleccion, min: null }) }] : []),
    ...(seleccion.max !== null ? [{ clave: "max", texto: `Hasta ${formatearPesos(seleccion.max)}`, quitar: () => ({ ...seleccion, max: null }) }] : []),
    ...(seleccion.soloStock ? [{ clave: "stock", texto: "Solo con stock", quitar: () => ({ ...seleccion, soloStock: false }) }] : []),
  ];
  if (chips.length === 0) return null;
  return (
    <>
      {chips.map((c) => (
        <button
          key={c.clave}
          type="button"
          onClick={() => onCambiar(c.quitar())}
          className="flex h-8 items-center gap-2 rounded-chip border border-input bg-secondary px-3 text-[13px] hover:bg-accent"
        >
          {c.texto}
          <X className="h-3.5 w-3.5" aria-hidden />
          <span className="sr-only">Quitar filtro</span>
        </button>
      ))}
      <button type="button" onClick={() => onCambiar(SIN_FILTROS)} className="h-8 px-2 text-[13px] font-bold underline">
        Limpiar filtros
      </button>
    </>
  );
}

interface Props {
  productos: ProductoPublico[];
  cargando: boolean;
  error?: string | null;
  textoVacio?: string;
  /** El orden cuando la URL no dice otro: "nuevos" en Nuevos ingresos, "destacados" en el resto. */
  ordenInicial?: OrdenDelCatalogo;
}

/** Filtros a la izquierda, barra con orden y filtros activos, grilla con comparador y "Ver más". */
export function ListadoFiltrable({ productos, cargando, error, textoVacio = "Todavía no hay productos acá.", ordenInicial = "destacados" }: Props) {
  const [parametros, setParametros] = useSearchParams();
  const seleccion = useMemo(() => leerSeleccion(parametros), [parametros]);
  const ordenParametro = parametros.get("orden");
  const orden: OrdenDelCatalogo = esOrden(ordenParametro) ? ordenParametro : ordenInicial;
  const marcas = useMemo(() => marcasDe(productos), [productos]);
  const facetas = useMemo(() => facetasDe(productos), [productos]);
  const filtrados = useMemo(() => ordenarProductos(aplicarFiltros(productos, seleccion), orden), [productos, seleccion, orden]);
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const [verFiltros, setVerFiltros] = useState(false);
  const activos = cantidadDeFiltros(seleccion);

  useEffect(() => {
    setVisibles(POR_PAGINA);
  }, [parametros]);

  function cambiar(nueva: SeleccionDeFiltros) {
    setParametros(escribirSeleccion(parametros, nueva), { replace: true });
  }

  function cambiarOrden(valor: string) {
    const siguiente = new URLSearchParams(parametros);
    if (valor && valor !== ordenInicial) siguiente.set("orden", valor);
    else siguiente.delete("orden");
    setParametros(siguiente, { replace: true });
  }

  if (error) return <p className="rounded-xl bg-error-fondo p-4 text-sm text-danger">{error}</p>;
  if (!cargando && productos.length === 0) return <p className="py-12 text-muted-foreground">{textoVacio}</p>;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <button
        type="button"
        onClick={() => setVerFiltros((v) => !v)}
        aria-expanded={verFiltros}
        className="flex h-11 items-center justify-center gap-2 rounded-xl border border-input text-sm font-bold lg:hidden"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        {verFiltros ? "Ocultar filtros" : activos > 0 ? `Filtros (${activos})` : "Filtros"}
      </button>
      <aside aria-label="Filtros" className={cn("w-full lg:block lg:w-[260px] lg:shrink-0", verFiltros ? "block" : "hidden")}>
        <PanelDeFiltros seleccion={seleccion} marcas={marcas} facetas={facetas} onCambiar={cambiar} />
      </aside>

      <section aria-label="Resultados" className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3.5 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">{cargando ? "Cargando" : filtrados.length === 1 ? "1 producto" : `${filtrados.length} productos`}</span>
            <ChipsActivos seleccion={seleccion} onCambiar={cambiar} />
          </div>
          <label className="flex items-center gap-2.5 text-sm text-muted-foreground">
            Ordenar por
            <select
              value={orden}
              onChange={(e) => cambiarOrden(e.target.value)}
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ORDENES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!cargando && filtrados.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-8">
            <p className="text-lg font-bold">No encontramos esa combinación</p>
            <p className="text-sm text-muted-foreground">Probá quitar un filtro o ampliar el rango de precio.</p>
            <button type="button" onClick={() => cambiar(SIN_FILTROS)} className="h-11 rounded-xl border border-foreground px-5 text-sm font-bold hover:bg-secondary">
              Quitar los filtros
            </button>
          </div>
        ) : (
          <GrillaProductos productos={filtrados.slice(0, visibles)} cargando={cargando} cantidadEsqueletos={8} columnas="con-filtros" conComparar />
        )}

        {filtrados.length > visibles && (
          <div className="flex flex-col items-center gap-2 pt-2">
            <span className="text-sm text-muted-foreground">
              Mostrando {visibles} de {filtrados.length}
            </span>
            <button type="button" onClick={() => setVisibles((v) => v + POR_PAGINA)} className="h-11 rounded-xl border border-foreground px-6 text-sm font-bold hover:bg-secondary">
              Ver más productos
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
