import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SurfaceCard } from "@/components/ui/surface-card";
import { SeccionDelInicioVista } from "@/components/tienda/SeccionesDelInicio";
import { supabase } from "@/lib/supabase";
import {
  buscarProductos,
  categoriasPlanas,
  fotosPorCategoria,
  imagenPrincipal,
  listarCategorias,
  listarProductosPorIds,
  type CategoriaPublica,
  type ProductoPublico,
} from "@/lib/tienda/catalogo";
import {
  MAXIMO_EN_CARRUSEL,
  MAXIMO_EN_GRILLA,
  NOMBRES_DE_TIPO,
  type ConfigDeSeccion,
  type FormatoDeFila,
  type FuenteDeProductos,
  type TipoDeSeccion,
} from "@/lib/tienda/seccionesInicio";
import { cn } from "@/lib/utils";

/**
 * Marketing › Secciones del inicio: qué se muestra en el inicio, en qué orden y con qué productos.
 * La vista previa usa las mismas secciones de la tienda.
 */

interface Seccion {
  id: string | null;
  clave: string;
  tipo: TipoDeSeccion;
  titulo: string;
  bajada: string;
  activa: boolean;
  orden: number;
  config: ConfigDeSeccion;
}

const FUENTES: Array<{ id: FuenteDeProductos; nombre: string }> = [
  { id: "mano", nombre: "Elegidos a mano" },
  { id: "destacados", nombre: "Marcados como destacados" },
  { id: "categoria", nombre: "De una categoría" },
];

const ORDENES: Array<{ id: NonNullable<ConfigDeSeccion["orden"]>; nombre: string }> = [
  { id: "destacados", nombre: "Destacados" },
  { id: "precio_asc", nombre: "Menor precio" },
  { id: "nuevos", nombre: "Nuevos" },
];

const AGREGABLES: Array<{ tipo: TipoDeSeccion; nombre: string; config: ConfigDeSeccion }> = [
  { tipo: "productos", nombre: "Fila de productos", config: { fuente: "categoria", categoria: "", orden: "destacados", formato: "carrusel", cantidad: 10 } },
  { tipo: "comparador", nombre: "Comparador", config: { categoria: "" } },
];

const chip = (activo: boolean) => cn("h-8 rounded-chip border px-3 text-xs font-bold", activo ? "border-foreground bg-foreground text-background" : "border-border hover:border-input");

async function leerSecciones(): Promise<Seccion[]> {
  const { data, error } = await supabase.from("secciones_inicio").select("id, tipo, titulo, bajada, activa, orden, config").order("orden").order("creada_en");
  if (error) throw new Error(`No se pudieron leer las secciones: ${error.message}`);
  return ((data ?? []) as Array<Omit<Seccion, "clave">>).map((s) => ({ ...s, clave: s.id as string, bajada: s.bajada ?? "", config: s.config ?? {} }));
}

function detalleDe(s: Seccion, categorias: Map<string, string>): string {
  const c = s.config;
  if (s.tipo === "productos" || s.tipo === "componentes") {
    const fuente = c.fuente === "mano" ? `${(c.ids ?? []).length} elegidos a mano` : c.fuente === "categoria" ? (categorias.get(c.categoria ?? "") ?? "Sin categoría") : "Destacados";
    return `${fuente} · ${c.formato === "carrusel" ? "carrusel" : "grilla"} de ${c.cantidad ?? 6}`;
  }
  if (s.tipo === "comparador") return `Compara ${(categorias.get(c.categoria ?? "") ?? "sin categoría").toLowerCase()}`;
  if (s.tipo === "categorias") return (c.slugs ?? []).length > 0 ? `${(c.slugs ?? []).length} categorías` : "Las de siempre";
  if (s.tipo === "elegido") return c.producto_id ? "Producto elegido" : "El primero destacado";
  if (s.tipo === "portada") return "Se arma en Portada del inicio";
  return NOMBRES_DE_TIPO[s.tipo];
}

export function SeccionesInicioTab() {
  const [secciones, setSecciones] = useState<Seccion[] | null>(null);
  const [borrador, setBorrador] = useState<Seccion | null>(null);
  const [raices, setRaices] = useState<CategoriaPublica[] | null>(null);
  const [fotos, setFotos] = useState<Map<number, string> | null>(null);
  const [elegidos, setElegidos] = useState<ProductoPublico[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<ProductoPublico[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [version, setVersion] = useState(0);

  async function recargar(seleccionar?: string | null) {
    const lista = await leerSecciones();
    setSecciones(lista);
    const elegida = lista.find((s) => s.id === seleccionar) ?? lista[0] ?? null;
    setBorrador(elegida ? { ...elegida, config: { ...elegida.config } } : null);
  }

  useEffect(() => {
    Promise.all([recargar(), listarCategorias().then(setRaices), fotosPorCategoria().then(setFotos)]).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : "No se pudieron cargar las secciones."),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Los productos elegidos a mano (o el del elegido de la semana), con nombre y foto.
  const idsElegidos = borrador ? (borrador.tipo === "elegido" ? (borrador.config.producto_id ? [borrador.config.producto_id] : []) : (borrador.config.ids ?? [])) : [];
  useEffect(() => {
    if (idsElegidos.length === 0) return void setElegidos([]);
    let cancelado = false;
    listarProductosPorIds(idsElegidos).then((lista) => {
      if (cancelado) return;
      const porId = new Map(lista.map((p) => [p.id, p]));
      setElegidos(idsElegidos.map((id) => porId.get(id)).filter((p): p is ProductoPublico => Boolean(p)));
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsElegidos.join(",")]);

  useEffect(() => {
    const q = busqueda.trim();
    if (q.length < 2) return void setResultados([]);
    let cancelado = false;
    const espera = window.setTimeout(() => {
      buscarProductos(q, 8)
        .then((lista) => {
          if (!cancelado) setResultados(lista);
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      cancelado = true;
      window.clearTimeout(espera);
    };
  }, [busqueda]);

  const categorias = useMemo(() => (raices ? categoriasPlanas(raices).filter((c) => c.cantidad > 0) : []), [raices]);
  const nombresDeCategoria = useMemo(() => new Map(categorias.map((c) => [c.slug, c.nombre])), [categorias]);
  const hojas = useMemo(() => categorias.filter((c) => c.hijas.length === 0), [categorias]);

  if (error) return <p className="p-6 text-sm text-danger">{error}</p>;
  if (!secciones) return <p className="p-6 text-sm text-muted-foreground">Cargando las secciones</p>;

  function cambiar(cambios: Partial<Seccion>) {
    setBorrador((b) => (b ? { ...b, ...cambios } : b));
  }
  function cambiarConfig(cambios: Partial<ConfigDeSeccion>) {
    setBorrador((b) => (b ? { ...b, config: { ...b.config, ...cambios } } : b));
  }

  async function alternarMostrar(s: Seccion) {
    if (!s.id) return;
    const { error: e } = await supabase.from("secciones_inicio").update({ activa: !s.activa, actualizada_en: new Date().toISOString() }).eq("id", s.id);
    if (e) return void toast.error(e.message);
    toast.success(s.activa ? `"${s.titulo}" ya no se muestra` : `"${s.titulo}" se muestra en el inicio`);
    await recargar(borrador?.id);
  }

  async function mover(indice: number, paso: -1 | 1) {
    if (!secciones) return;
    const destino = indice + paso;
    if (destino < 0 || destino >= secciones.length) return;
    const ordenada = secciones.map((s, i) => (i === indice ? secciones[destino] : i === destino ? secciones[indice] : s));
    const cambios = ordenada.map((s, i) => ({ id: s.id, orden: i + 1 })).filter((c, i) => c.id && ordenada[i].orden !== c.orden);
    const r = await Promise.all(cambios.map((c) => supabase.from("secciones_inicio").update({ orden: c.orden }).eq("id", c.id as string)));
    const fallo = r.find((x) => x.error);
    if (fallo?.error) toast.error(fallo.error.message);
    await recargar(borrador?.id);
  }

  function agregar(tipo: TipoDeSeccion, config: ConfigDeSeccion, nombre: string) {
    const orden = Math.max(0, ...(secciones ?? []).map((s) => s.orden)) + 1;
    setBorrador({ id: null, clave: `nueva-${Date.now()}`, tipo, titulo: nombre, bajada: "", activa: false, orden, config: { ...config, categoria: categorias[0]?.slug ?? "" } });
  }

  async function guardar() {
    if (!borrador) return;
    const c = borrador.config;
    if ((borrador.tipo === "productos" || borrador.tipo === "componentes") && c.fuente === "categoria" && !c.categoria) return void toast.error("Elegí la categoría.");
    if ((borrador.tipo === "productos" || borrador.tipo === "componentes") && c.fuente === "mano" && (c.ids ?? []).length === 0) return void toast.error("Sumá al menos un producto.");
    if (borrador.tipo === "comparador" && !c.categoria) return void toast.error("Elegí qué compara.");
    setGuardando(true);
    try {
      const fila = { tipo: borrador.tipo, titulo: borrador.titulo.trim(), bajada: borrador.bajada.trim(), activa: borrador.activa, config: borrador.config, actualizada_en: new Date().toISOString() };
      let id = borrador.id;
      if (id) {
        const { error: e } = await supabase.from("secciones_inicio").update(fila).eq("id", id);
        if (e) throw new Error(e.message);
      } else {
        const { data, error: e } = await supabase.from("secciones_inicio").insert({ ...fila, orden: borrador.orden }).select("id").single();
        if (e) throw new Error(e.message);
        id = (data as { id: string }).id;
      }
      toast.success("Sección guardada: el inicio ya la muestra así");
      await recargar(id);
      setVersion((v) => v + 1);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la sección.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!borrador) return;
    if (!borrador.id) return void (await recargar());
    if (!window.confirm(`¿Eliminar la sección "${borrador.titulo}"? No se puede deshacer.`)) return;
    const { error: e } = await supabase.from("secciones_inicio").delete().eq("id", borrador.id);
    if (e) return void toast.error(e.message);
    toast.success("Sección eliminada");
    await recargar();
  }

  function sumarProducto(p: ProductoPublico) {
    if (!borrador) return;
    if (borrador.tipo === "elegido") cambiarConfig({ producto_id: p.id });
    else {
      const maximo = borrador.tipo === "comparador" ? 3 : MAXIMO_EN_CARRUSEL;
      const ids = [...new Set([...(borrador.config.ids ?? []), p.id])].slice(0, maximo);
      cambiarConfig({ ids });
    }
    setBusqueda("");
  }

  function moverElegido(id: number, paso: -1 | 1) {
    const ids = [...(borrador?.config.ids ?? [])];
    const i = ids.indexOf(id);
    const j = i + paso;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    cambiarConfig({ ids });
  }

  const conProductos = borrador && (borrador.tipo === "productos" || borrador.tipo === "componentes");
  const formato: FormatoDeFila = borrador?.config.formato ?? "grilla";
  const maximo = formato === "carrusel" ? MAXIMO_EN_CARRUSEL : MAXIMO_EN_GRILLA;
  const cantidad = Math.min(borrador?.config.cantidad ?? 6, maximo);
  const buscaProductos = borrador && (borrador.tipo === "elegido" || borrador.tipo === "comparador" || (conProductos && borrador.config.fuente === "mano"));

  return (
    <div className="flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold">Secciones del inicio</h2>
          <p className="mt-1 text-sm text-muted-foreground">Elegí qué se muestra en el inicio, en qué orden y con qué productos. Los cambios se ven en la tienda apenas guardás.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {AGREGABLES.map((a) => (
            <Button key={a.tipo} type="button" variant={a.tipo === "productos" ? "default" : "outline"} onClick={() => agregar(a.tipo, a.config, a.nombre)}>
              Agregar {a.nombre.toLowerCase()}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          {secciones.map((s, i) => (
            <div key={s.clave} className={cn("flex items-center gap-2.5 rounded-2xl border bg-card p-3", borrador?.clave === s.clave ? "border-foreground" : "border-border", !s.activa && "opacity-60")}>
              <button type="button" onClick={() => setBorrador({ ...s, config: { ...s.config } })} className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                <span className="truncate text-sm font-bold">{s.titulo || NOMBRES_DE_TIPO[s.tipo]}</span>
                <span className="truncate text-xs text-muted-foreground">{detalleDe(s, nombresDeCategoria)}</span>
              </button>
              <Switch checked={s.activa} onCheckedChange={() => alternarMostrar(s)} aria-label={`Mostrar ${s.titulo}`} />
              <span className="flex flex-col gap-1">
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir" className="rounded-md border border-border p-1 hover:bg-secondary disabled:opacity-40">
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === secciones.length - 1} aria-label="Bajar" className="rounded-md border border-border p-1 hover:bg-secondary disabled:opacity-40">
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            </div>
          ))}
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">El interruptor muestra u oculta la sección sin borrarla y guarda al instante. Las flechas cambian el orden.</p>
        </div>

        {borrador && (
          <div className="flex min-w-0 flex-col gap-4">
            <SurfaceCard className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-bold">{borrador.titulo || NOMBRES_DE_TIPO[borrador.tipo]}</h3>
                <span className="text-xs text-muted-foreground">{NOMBRES_DE_TIPO[borrador.tipo]}</span>
              </div>

              {borrador.tipo !== "portada" && borrador.tipo !== "ayuda" && borrador.tipo !== "por_uso" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">Título</span>
                    <Input value={borrador.titulo} maxLength={80} onChange={(e) => cambiar({ titulo: e.target.value })} />
                  </label>
                  {(conProductos || borrador.tipo === "comparador") && (
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">Bajada (opcional)</span>
                      <Input value={borrador.bajada} maxLength={160} onChange={(e) => cambiar({ bajada: e.target.value })} />
                    </label>
                  )}
                </div>
              )}

              {borrador.tipo === "portada" && <p className="text-sm text-muted-foreground">Las portadas se eligen en Marketing › Portada del inicio. Acá solo decidís dónde va y si se muestra.</p>}
              {(borrador.tipo === "ayuda" || borrador.tipo === "por_uso") && <p className="text-sm text-muted-foreground">Esta sección no tiene opciones: solo se muestra u oculta y se ordena.</p>}

              {conProductos && (
                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-[110px] font-medium">Qué productos</span>
                    {FUENTES.filter((f) => borrador.tipo === "productos" || f.id !== "destacados").map((f) => (
                      <button key={f.id} type="button" onClick={() => cambiarConfig({ fuente: f.id })} className={chip((borrador.config.fuente ?? "destacados") === f.id)}>
                        {f.nombre}
                      </button>
                    ))}
                  </div>
                  {borrador.config.fuente === "categoria" && (
                    <>
                      <label className="flex flex-wrap items-center gap-2">
                        <span className="w-[110px] font-medium">Categoría</span>
                        <select
                          value={borrador.config.categoria ?? ""}
                          onChange={(e) => cambiarConfig({ categoria: e.target.value })}
                          className="h-10 min-w-[240px] rounded-xl border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Elegí una categoría</option>
                          {categorias.map((c) => (
                            <option key={c.slug} value={c.slug}>
                              {c.raiz.id === c.id ? c.nombre : `${c.raiz.nombre} › ${c.nombre}`} ({c.cantidad})
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="w-[110px] font-medium">Orden</span>
                        {ORDENES.map((o) => (
                          <button key={o.id} type="button" onClick={() => cambiarConfig({ orden: o.id })} className={chip((borrador.config.orden ?? "destacados") === o.id)}>
                            {o.nombre}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {borrador.tipo === "productos" && borrador.config.fuente === "destacados" && (
                    <label className="flex items-center gap-2.5">
                      <Switch checked={Boolean(borrador.config.pestanas)} onCheckedChange={(pestanas) => cambiarConfig({ pestanas })} />
                      <span>Pestañas para filtrar por monitores, notebooks, periféricos y componentes</span>
                    </label>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-[110px] font-medium">Cómo se ven</span>
                    {(["grilla", "carrusel"] as FormatoDeFila[]).map((f) => (
                      <button key={f} type="button" onClick={() => cambiarConfig({ formato: f, cantidad: Math.min(cantidad, f === "carrusel" ? MAXIMO_EN_CARRUSEL : MAXIMO_EN_GRILLA) })} className={chip(formato === f)}>
                        {f === "grilla" ? "Grilla" : "Carrusel"}
                      </button>
                    ))}
                    <span className="ml-3 font-medium">Cantidad</span>
                    <span className="flex h-9 items-center rounded-lg border border-input">
                      <button type="button" onClick={() => cambiarConfig({ cantidad: Math.max(2, cantidad - 1) })} aria-label="Uno menos" className="px-2">
                        <Minus className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <span className="min-w-7 text-center font-bold tabular-nums">{cantidad}</span>
                      <button type="button" onClick={() => cambiarConfig({ cantidad: Math.min(maximo, cantidad + 1) })} aria-label="Uno más" className="px-2">
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </span>
                    <span className="text-xs text-muted-foreground">{formato === "carrusel" ? `Se desliza, hasta ${MAXIMO_EN_CARRUSEL}.` : `Una fila fija, hasta ${MAXIMO_EN_GRILLA}.`}</span>
                  </div>
                </div>
              )}

              {borrador.tipo === "comparador" && (
                <div className="space-y-2 text-sm">
                  <label className="flex flex-wrap items-center gap-2">
                    <span className="w-[110px] font-medium">Qué compara</span>
                    <select
                      value={borrador.config.categoria ?? ""}
                      onChange={(e) => {
                        const nombre = nombresDeCategoria.get(e.target.value) ?? "";
                        cambiar({ titulo: nombre ? `Tres ${nombre.toLowerCase()}, lado a lado.` : borrador.titulo, config: { ...borrador.config, categoria: e.target.value, ids: [] } });
                      }}
                      className="h-10 min-w-[240px] rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Elegí una categoría</option>
                      {hojas.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.nombre} ({c.cantidad})
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs text-muted-foreground">Muestra tres productos de esa categoría lado a lado. Sin elegirlos, van los tres primeros destacados.</p>
                </div>
              )}

              {borrador.tipo === "categorias" && (
                <div className="space-y-2 text-sm">
                  <p className="font-medium">Categorías que se muestran ({(borrador.config.slugs ?? []).length} de 12; sin ninguna, las de siempre)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {hojas.map((c) => {
                      const esta = (borrador.config.slugs ?? []).includes(c.slug);
                      return (
                        <button
                          key={c.slug}
                          type="button"
                          onClick={() => cambiarConfig({ slugs: esta ? (borrador.config.slugs ?? []).filter((x) => x !== c.slug) : [...(borrador.config.slugs ?? []), c.slug].slice(0, 12) })}
                          className={chip(esta)}
                        >
                          {esta ? "✓ " : "+ "}
                          {c.nombre}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {buscaProductos && (
                <div className="space-y-2 text-sm">
                  <p className="font-medium">
                    {borrador.tipo === "elegido" ? "Producto (sin elegir, va el primero destacado)" : borrador.tipo === "comparador" ? "Los tres productos (opcional)" : "Productos elegidos, en este orden"}
                  </p>
                  {elegidos.map((p, i) => {
                    const foto = imagenPrincipal(p);
                    return (
                      <div key={p.id} className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-placa-foto">{foto && <img src={foto} alt="" className="max-h-[30px] max-w-[30px] object-contain mix-blend-multiply" />}</span>
                        <span className="min-w-0 flex-1 truncate text-[13px]">{p.nombre}</span>
                        {borrador.tipo !== "elegido" && (
                          <>
                            <button type="button" onClick={() => moverElegido(p.id, -1)} disabled={i === 0} aria-label="Subir" className="rounded-md border border-border p-1 disabled:opacity-40">
                              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <button type="button" onClick={() => moverElegido(p.id, 1)} disabled={i === elegidos.length - 1} aria-label="Bajar" className="rounded-md border border-border p-1 disabled:opacity-40">
                              <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => (borrador.tipo === "elegido" ? cambiarConfig({ producto_id: null }) : cambiarConfig({ ids: (borrador.config.ids ?? []).filter((x) => x !== p.id) }))}
                          aria-label="Quitar"
                          className="rounded-md border border-border p-1"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    );
                  })}
                  <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscá un producto para sumarlo" />
                  {resultados.map((p) => (
                    <button key={p.id} type="button" onClick={() => sumarProducto(p)} className="flex w-full items-center gap-2.5 rounded-lg border border-border px-2.5 py-2 text-left text-[13px] hover:border-input">
                      <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{p.nombre}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5 border-t border-border pt-4">
                <Button type="button" onClick={guardar} disabled={guardando}>
                  Guardar
                </Button>
                {(borrador.tipo === "productos" || borrador.tipo === "comparador" || !borrador.id) && (
                  <button type="button" onClick={eliminar} className="px-1 text-sm font-bold text-danger underline">
                    {borrador.id ? "Eliminar sección" : "Descartar"}
                  </button>
                )}
                {!borrador.activa && <span className="text-xs text-muted-foreground">Está oculta: prendé "Mostrar" en la lista para que se vea.</span>}
              </div>
            </SurfaceCard>

            {borrador.tipo !== "portada" && (
              <div className="space-y-2">
                <p className="text-[13px] font-bold text-muted-foreground">Vista previa en el inicio</p>
                <div data-tema="claro" className="overflow-hidden rounded-2xl border border-border bg-background py-5 font-sans text-foreground">
                  <SeccionDelInicioVista key={`${borrador.clave}-${version}-${JSON.stringify(borrador.config)}`} seccion={{ ...borrador, id: borrador.clave }} raices={raices} fotos={fotos} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
