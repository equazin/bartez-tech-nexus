import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { ArrowDown, ArrowUp, ImageUp, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SurfaceCard } from "@/components/ui/surface-card";
import { BannerDePortada, PcDePortada } from "@/components/tienda/PortadaDestacada";
import { supabase } from "@/lib/supabase";
import { buscarProductos, categoriasPlanas, imagenPrincipal, listarCategorias, rutaDelProducto, type ProductoPublico } from "@/lib/tienda/catalogo";
import { FONDOS_DE_PORTADA, type FondoDePortada, type TipoDePortada } from "@/lib/tienda/portadas";
import { cn } from "@/lib/utils";

/**
 * Marketing › Portada del inicio: banners con texto o una PC armada, con fechas. La tienda muestra la
 * primera activa y dentro de sus fechas (vista tienda_portadas); sin ninguna, la primera PC armada.
 */

type Destino = "ofertas" | "categoria" | "producto" | "armador";

interface Portada {
  id: string | null;
  nombre: string;
  tipo: TipoDePortada;
  etiqueta: string;
  titulo: string;
  texto: string;
  boton: string;
  destino_tipo: Destino;
  enlace: string;
  imagen_url: string | null;
  foto_producto_id: number | null;
  fondo: FondoDePortada;
  pc_armada_id: string | null;
  desde: string;
  hasta: string;
  activa: boolean;
  orden: number;
}

interface ArmadaDelPanel {
  id: string;
  nombre: string;
  publicada: boolean;
}

const DESTINOS: Array<{ id: Destino; nombre: string }> = [
  { id: "ofertas", nombre: "Ofertas" },
  { id: "categoria", nombre: "Una categoría" },
  { id: "producto", nombre: "Un producto" },
  { id: "armador", nombre: "Armá tu PC" },
];

const COLOR_DE_FONDO: Record<FondoDePortada, { clase: string; tema?: string }> = { gris: { clase: "bg-placa-foto" }, grafito: { clase: "bg-background", tema: "nocturno" }, rojo: { clase: "bg-primary" } };

const hoy = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

function nueva(orden: number): Portada {
  return {
    id: null,
    nombre: "Nueva portada",
    tipo: "banner",
    etiqueta: "",
    titulo: "",
    texto: "",
    boton: "Ver más",
    destino_tipo: "ofertas",
    enlace: "/ofertas",
    imagen_url: null,
    foto_producto_id: null,
    fondo: "gris",
    pc_armada_id: null,
    desde: hoy(),
    hasta: "",
    activa: false,
    orden,
  };
}

async function leerPortadas(): Promise<Portada[]> {
  const { data, error } = await supabase
    .from("portadas")
    .select("id, nombre, tipo, etiqueta, titulo, texto, boton, destino_tipo, enlace, imagen_url, foto_producto_id, fondo, pc_armada_id, desde, hasta, activa, orden")
    .order("orden")
    .order("creada_en");
  if (error) throw new Error(`No se pudieron leer las portadas: ${error.message}`);
  return ((data ?? []) as Array<Omit<Portada, "desde" | "hasta"> & { desde: string | null; hasta: string | null }>).map((p) => ({ ...p, desde: p.desde ?? "", hasta: p.hasta ?? "" }));
}

function vigente(p: Portada, armadas: ArmadaDelPanel[]): boolean {
  const dia = hoy();
  if (!p.activa || (p.desde && p.desde > dia) || (p.hasta && p.hasta < dia)) return false;
  return p.tipo === "banner" || armadas.some((a) => a.id === p.pc_armada_id && a.publicada);
}

const formatoDeFecha = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "");

export function PortadaTab() {
  const [portadas, setPortadas] = useState<Portada[] | null>(null);
  const [armadas, setArmadas] = useState<ArmadaDelPanel[]>([]);
  const [categorias, setCategorias] = useState<Array<{ slug: string; nombre: string }>>([]);
  const [borrador, setBorrador] = useState<Portada | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [buscandoPara, setBuscandoPara] = useState<"destino" | "foto" | null>(null);
  const [resultados, setResultados] = useState<ProductoPublico[]>([]);

  async function recargar(seleccionar?: string | null) {
    const lista = await leerPortadas();
    setPortadas(lista);
    const elegida = lista.find((p) => p.id === seleccionar) ?? lista[0] ?? null;
    setBorrador(elegida ? { ...elegida } : null);
  }

  useEffect(() => {
    Promise.all([
      recargar(),
      supabase
        .from("pc_armadas")
        .select("id, nombre, publicada")
        .order("orden")
        .then(({ data }) => setArmadas((data ?? []) as ArmadaDelPanel[])),
      listarCategorias().then((raices) => setCategorias(categoriasPlanas(raices).filter((c) => c.cantidad > 0).map((c) => ({ slug: c.slug, nombre: c.nombre })))),
    ]).catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudieron cargar las portadas."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = busqueda.trim();
    if (!buscandoPara || q.length < 2) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    const espera = window.setTimeout(() => {
      buscarProductos(q, 8)
        .then((lista) => {
          if (!cancelado) setResultados(lista);
        })
        .catch(() => {
          if (!cancelado) setResultados([]);
        });
    }, 250);
    return () => {
      cancelado = true;
      window.clearTimeout(espera);
    };
  }, [busqueda, buscandoPara]);

  const visible = useMemo(() => (portadas ?? []).find((p) => vigente(p, armadas)) ?? null, [portadas, armadas]);
  const maximoOrden = Math.max(0, ...(portadas ?? []).map((p) => p.orden));

  if (error) return <p className="p-6 text-sm text-danger">{error}</p>;
  if (!portadas) return <p className="p-6 text-sm text-muted-foreground">Cargando las portadas</p>;

  function cambiar(cambios: Partial<Portada>) {
    setBorrador((b) => (b ? { ...b, ...cambios } : b));
  }

  function elegirDestino(destino: Destino) {
    setBuscandoPara(destino === "producto" ? "destino" : null);
    setBusqueda("");
    if (destino === "ofertas") cambiar({ destino_tipo: destino, enlace: "/ofertas" });
    else if (destino === "armador") cambiar({ destino_tipo: destino, enlace: "/arma-tu-pc" });
    else if (destino === "categoria") cambiar({ destino_tipo: destino, enlace: categorias[0] ? `/${categorias[0].slug}` : "/ofertas" });
    else cambiar({ destino_tipo: destino });
  }

  function elegirProducto(p: ProductoPublico) {
    if (buscandoPara === "destino") cambiar({ enlace: rutaDelProducto(p) });
    if (buscandoPara === "foto") cambiar({ imagen_url: imagenPrincipal(p), foto_producto_id: p.id });
    setBuscandoPara(null);
    setBusqueda("");
  }

  async function subirImagen(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) return void toast.error("La imagen tiene que ser JPG, PNG o WebP.");
    if (archivo.size > 5 * 1024 * 1024) return void toast.error("La imagen no puede pasar los 5 MB.");
    setSubiendo(true);
    try {
      const extension = archivo.type === "image/png" ? "png" : archivo.type === "image/webp" ? "webp" : "jpg";
      const ruta = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
      const { error: e } = await supabase.storage.from("portadas").upload(ruta, archivo, { contentType: archivo.type, upsert: false });
      if (e) throw new Error(e.message);
      const { data } = supabase.storage.from("portadas").getPublicUrl(ruta);
      cambiar({ imagen_url: data.publicUrl, foto_producto_id: null });
      toast.success("Imagen subida");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la imagen.");
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar() {
    if (!borrador) return;
    const nombre = (borrador.tipo === "pc" ? armadas.find((a) => a.id === borrador.pc_armada_id)?.nombre : borrador.titulo) || borrador.nombre;
    if (borrador.tipo === "banner" && !borrador.titulo.trim()) return void toast.error("Poné un título para el banner.");
    if (borrador.tipo === "pc" && !borrador.pc_armada_id) return void toast.error("Elegí qué PC armada mostrar.");
    if (borrador.desde && borrador.hasta && borrador.hasta < borrador.desde) return void toast.error("La fecha de fin tiene que ser posterior a la de inicio.");
    setGuardando(true);
    try {
      const fila = {
        nombre: nombre.trim().slice(0, 80),
        tipo: borrador.tipo,
        etiqueta: borrador.etiqueta.trim(),
        titulo: borrador.titulo.trim(),
        texto: borrador.texto.trim(),
        boton: borrador.boton.trim(),
        destino_tipo: borrador.destino_tipo,
        enlace: borrador.enlace,
        imagen_url: borrador.imagen_url,
        foto_producto_id: borrador.foto_producto_id,
        fondo: borrador.fondo,
        pc_armada_id: borrador.tipo === "pc" ? borrador.pc_armada_id : null,
        desde: borrador.desde || null,
        hasta: borrador.hasta || null,
        activa: borrador.activa,
        actualizada_en: new Date().toISOString(),
      };
      let id = borrador.id;
      if (id) {
        const { error: e } = await supabase.from("portadas").update(fila).eq("id", id);
        if (e) throw new Error(e.message);
      } else {
        const { data, error: e } = await supabase.from("portadas").insert({ ...fila, orden: borrador.orden }).select("id").single();
        if (e) throw new Error(e.message);
        id = (data as { id: string }).id;
      }
      toast.success("Portada guardada");
      await recargar(id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la portada.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!borrador) return;
    if (!borrador.id) return void (await recargar());
    if (!window.confirm(`¿Eliminar la portada "${borrador.nombre}"? No se puede deshacer.`)) return;
    const { error: e } = await supabase.from("portadas").delete().eq("id", borrador.id);
    if (e) return void toast.error(e.message);
    toast.success("Portada eliminada");
    await recargar();
  }

  async function mover(indice: number, paso: -1 | 1) {
    if (!portadas) return;
    const destino = indice + paso;
    if (destino < 0 || destino >= portadas.length) return;
    const ordenada = portadas.map((p, i) => (i === indice ? portadas[destino] : i === destino ? portadas[indice] : p));
    const cambios = ordenada.map((p, i) => ({ id: p.id, orden: i + 1 })).filter((c, i) => c.id && ordenada[i].orden !== c.orden);
    const resultados = await Promise.all(cambios.map((c) => supabase.from("portadas").update({ orden: c.orden }).eq("id", c.id as string)));
    const fallo = resultados.find((r) => r.error);
    if (fallo?.error) toast.error(fallo.error.message);
    await recargar(borrador?.id);
  }

  const estadoDe = (p: Portada) =>
    visible?.id === p.id && p.id ? { texto: "Se ve ahora", clase: "bg-success text-background" } : p.activa ? { texto: "Activa, en espera", clase: "bg-accent text-foreground" } : { texto: "Inactiva", clase: "bg-secondary text-muted-foreground" };

  return (
    <div className="flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold">Portada del inicio</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Lo primero que se ve en la tienda. Se muestra la primera portada activa y dentro de sus fechas; si no hay ninguna, la primera PC armada.
          </p>
        </div>
        <Button type="button" onClick={() => setBorrador(nueva(maximoOrden + 1))}>
          Nueva portada
        </Button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2.5">
          {portadas.length === 0 && <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Todavía no hay portadas: se ve la primera PC armada.</p>}
          {portadas.map((p, i) => {
            const estado = estadoDe(p);
            return (
              <div key={p.id} className={cn("flex items-center gap-2.5 rounded-2xl border bg-card p-3", borrador?.id === p.id ? "border-foreground" : "border-border")}>
                <button type="button" onClick={() => setBorrador({ ...p })} className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                  <span className="truncate text-sm font-bold">{p.nombre}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.tipo === "banner" ? "Banner" : "PC armada"} · {p.hasta ? `hasta el ${formatoDeFecha(p.hasta)}` : "sin fecha de fin"}
                  </span>
                  <span className={cn("self-start rounded-chip px-2 py-0.5 text-[11px] font-bold", estado.clase)}>{estado.texto}</span>
                </button>
                <span className="flex flex-col gap-1">
                  <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir" className="rounded-md border border-border p-1 hover:bg-secondary disabled:opacity-40">
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button type="button" onClick={() => mover(i, 1)} disabled={i === portadas.length - 1} aria-label="Bajar" className="rounded-md border border-border p-1 hover:bg-secondary disabled:opacity-40">
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              </div>
            );
          })}
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            Ahora se ve: <strong className="text-foreground">{visible?.nombre ?? "la primera PC armada"}</strong>. Una portada con fecha de fin vuelve sola a la siguiente cuando termina.
          </p>
        </div>

        {borrador && (
          <div className="flex min-w-0 flex-col gap-4">
            <SurfaceCard className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">Qué muestra</span>
                <span className="flex rounded-chip border border-border p-0.5">
                  {(["banner", "pc"] as TipoDePortada[]).map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => cambiar({ tipo, pc_armada_id: tipo === "pc" ? (borrador.pc_armada_id ?? armadas.find((a) => a.publicada)?.id ?? null) : borrador.pc_armada_id })}
                      className={cn("h-8 rounded-chip px-3.5 text-[13px] font-bold", borrador.tipo === tipo && "bg-foreground text-background")}
                    >
                      {tipo === "banner" ? "Banner con texto" : "Una PC armada"}
                    </button>
                  ))}
                </span>
              </div>

              {borrador.tipo === "banner" ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">Etiqueta (arriba del título)</span>
                      <Input value={borrador.etiqueta} maxLength={60} onChange={(e) => cambiar({ etiqueta: e.target.value })} placeholder="Por ejemplo: hasta el 5 de noviembre" />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">Título</span>
                      <Input value={borrador.titulo} maxLength={80} onChange={(e) => cambiar({ titulo: e.target.value })} />
                    </label>
                    <label className="block space-y-1 text-sm md:col-span-2">
                      <span className="font-medium">Texto</span>
                      <Textarea value={borrador.texto} maxLength={240} rows={2} onChange={(e) => cambiar({ texto: e.target.value })} />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">Botón</span>
                      <Input value={borrador.boton} maxLength={40} onChange={(e) => cambiar({ boton: e.target.value })} />
                    </label>
                    <div className="space-y-1 text-sm">
                      <span className="font-medium">Lleva a</span>
                      <div className="flex flex-wrap gap-1.5">
                        {DESTINOS.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => elegirDestino(d.id)}
                            className={cn("h-8 rounded-chip border px-3 text-xs font-bold", borrador.destino_tipo === d.id ? "border-foreground bg-foreground text-background" : "border-border")}
                          >
                            {d.nombre}
                          </button>
                        ))}
                      </div>
                      {borrador.destino_tipo === "categoria" && (
                        <select
                          value={borrador.enlace.slice(1)}
                          onChange={(e) => cambiar({ enlace: `/${e.target.value}` })}
                          className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                        >
                          {categorias.map((c) => (
                            <option key={c.slug} value={c.slug}>
                              {c.nombre}
                            </option>
                          ))}
                        </select>
                      )}
                      {borrador.destino_tipo === "producto" && (
                        <button type="button" onClick={() => setBuscandoPara("destino")} className="mt-1.5 text-xs font-bold underline">
                          {borrador.enlace === "/ofertas" ? "Elegir el producto" : "Cambiar el producto"}
                        </button>
                      )}
                      <p className="text-xs text-muted-foreground">Dirección: {borrador.enlace}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <span className="font-medium">Imagen</span>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="flex h-[72px] w-[96px] items-center justify-center overflow-hidden rounded-xl bg-placa-foto">
                        {borrador.imagen_url ? <img src={borrador.imagen_url} alt="" className="max-h-[64px] max-w-[88px] object-contain" /> : <span className="text-xs text-muted-foreground">Sin imagen</span>}
                      </span>
                      <Button type="button" size="sm" variant="outline" onClick={() => setBuscandoPara("foto")}>
                        Foto de un producto
                      </Button>
                      <label className={cn("inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-secondary", subiendo && "opacity-60")}>
                        <ImageUp className="h-4 w-4" aria-hidden />
                        {subiendo ? "Subiendo" : "Subir imagen"}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={subirImagen} disabled={subiendo} />
                      </label>
                      {borrador.imagen_url && (
                        <button type="button" onClick={() => cambiar({ imagen_url: null, foto_producto_id: null })} className="text-xs font-bold text-muted-foreground underline">
                          Quitar
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">JPG, PNG o WebP de hasta 5 MB. Una foto propia ocupa todo el lado derecho; la de un producto va sobre su placa.</p>
                  </div>

                  {buscandoPara && (
                    <div className="space-y-1.5 rounded-xl border border-border p-3">
                      <div className="flex items-center gap-2">
                        <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscá el producto por nombre, marca o modelo" autoFocus />
                        <button type="button" onClick={() => setBuscandoPara(null)} aria-label="Cerrar la búsqueda" className="rounded-lg border border-border p-2 hover:bg-secondary">
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                      {resultados.map((p) => {
                        const foto = imagenPrincipal(p);
                        return (
                          <button key={p.id} type="button" onClick={() => elegirProducto(p)} className="flex w-full items-center gap-2.5 rounded-lg border border-border px-2.5 py-2 text-left hover:border-input">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-placa-foto">
                              {foto && <img src={foto} alt="" className="max-h-[30px] max-w-[30px] object-contain mix-blend-multiply" />}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[13px]">{p.nombre}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2.5 text-sm">
                    <span className="font-medium">Fondo</span>
                    {FONDOS_DE_PORTADA.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => cambiar({ fondo: f.id })}
                        className={cn("flex h-9 items-center gap-2 rounded-chip border pl-1.5 pr-3 text-xs font-bold", borrador.fondo === f.id ? "border-foreground" : "border-border")}
                      >
                        <span data-tema={COLOR_DE_FONDO[f.id].tema} className={cn("h-6 w-6 rounded-full border border-input", COLOR_DE_FONDO[f.id].clase)} />
                        {f.nombre}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    {armadas.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => cambiar({ pc_armada_id: a.id })}
                        className={cn("flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left", borrador.pc_armada_id === a.id ? "border-foreground" : "border-border")}
                      >
                        <span className="text-sm font-bold">{a.nombre}</span>
                        <span className="text-xs text-muted-foreground">{a.publicada ? "Publicada" : "Borrador: no se ve hasta publicarla"}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">El título, las piezas y el precio salen de la PC armada y se actualizan solos con el costo y el dólar.</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border pt-4 text-sm">
                <label className="flex items-center gap-2">
                  <span className="font-medium">Desde</span>
                  <Input type="date" value={borrador.desde} onChange={(e) => cambiar({ desde: e.target.value })} className="w-[160px]" />
                </label>
                <label className="flex items-center gap-2">
                  <span className="font-medium">Hasta</span>
                  <Input type="date" value={borrador.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} className="w-[160px]" />
                </label>
                <label className="flex items-center gap-2.5">
                  <Switch checked={borrador.activa} onCheckedChange={(activa) => cambiar({ activa })} />
                  <span className="font-medium">{borrador.activa ? "Activa" : "Inactiva"}</span>
                </label>
                <span className="ml-auto flex items-center gap-2.5">
                  <Button type="button" onClick={guardar} disabled={guardando}>
                    Guardar
                  </Button>
                  <button type="button" onClick={eliminar} className="px-1 font-bold text-danger underline">
                    {borrador.id ? "Eliminar" : "Descartar"}
                  </button>
                </span>
              </div>
            </SurfaceCard>

            <div className="space-y-2">
              <p className="text-[13px] font-bold text-muted-foreground">Vista previa en la tienda</p>
              <div data-tema="claro" className="flex rounded-2xl bg-background p-2 font-sans text-foreground">
                {borrador.tipo === "banner" ? (
                  <BannerDePortada banner={{ ...borrador, titulo: borrador.titulo || "Título del banner" }} enlazar={false} />
                ) : (
                  <PcDePortada armadaId={borrador.pc_armada_id} enlazar={false} />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
