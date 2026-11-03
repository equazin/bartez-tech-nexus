import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SurfaceCard } from "@/components/ui/surface-card";
import { supabase } from "@/lib/supabase";
import { PASOS, chequeosDelArmado, evaluar, siguientePaso, type Armado, type Evaluacion, type IdDePaso } from "@/lib/tienda/armador";
import { imagenPrincipal, type ProductoPublico } from "@/lib/tienda/catalogo";
import { agruparPorPaso, listarComponentes, seleccionDe } from "@/lib/tienda/componentes";
import { formatearPesos } from "@/lib/tienda/dinero";
import { piezasValidas } from "@/lib/tienda/pcArmadas";
import { nombreCortoDeMedio, precioConMedio, preciosDe } from "@/lib/tienda/precios";
import { cn } from "@/lib/utils";

/**
 * Armá tu PC › PC armadas: las PC que aparecen arriba del armador de la tienda, en este orden.
 * El precio no se guarda: es la suma de las piezas, así sigue al costo y al dólar. Una PC publicada
 * se oculta sola de la tienda si una pieza se queda sin stock (vista tienda_pc_armadas).
 */

interface PcArmada {
  /** null: nueva, todavía sin guardar. */
  id: string | null;
  nombre: string;
  texto: string;
  publicada: boolean;
  orden: number;
  piezas: Armado["piezas"];
}

const ORDEN_DE_ESTADO: Record<Evaluacion["estado"], number> = { compatible: 0, revisar: 1, incompatible: 2 };
const MAXIMO_DE_OPCIONES = 40;

async function leerArmadas(): Promise<PcArmada[]> {
  const { data, error } = await supabase.from("pc_armadas").select("id, nombre, texto, publicada, orden, piezas").order("orden").order("creada_en");
  if (error) throw new Error(`No se pudieron leer las PC armadas: ${error.message}`);
  return ((data ?? []) as Array<{ id: string; nombre: string; texto: string | null; publicada: boolean; orden: number; piezas: unknown }>).map((a) => ({
    id: a.id,
    nombre: a.nombre,
    texto: a.texto ?? "",
    publicada: a.publicada,
    orden: a.orden,
    piezas: piezasValidas(a.piezas),
  }));
}

function nueva(orden: number): PcArmada {
  return { id: null, nombre: "Nueva PC armada", texto: "", publicada: false, orden, piezas: {} };
}

export function PcArmadasTab() {
  const [armadas, setArmadas] = useState<PcArmada[] | null>(null);
  const [productos, setProductos] = useState<ProductoPublico[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<PcArmada | null>(null);
  const [abierto, setAbierto] = useState<IdDePaso | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function recargar(seleccionar?: string | null) {
    const lista = await leerArmadas();
    setArmadas(lista);
    const elegida = lista.find((a) => a.id === seleccionar) ?? lista[0] ?? null;
    setBorrador(elegida ? { ...elegida, piezas: { ...elegida.piezas } } : null);
  }

  useEffect(() => {
    Promise.all([recargar(), listarComponentes().then(setProductos)]).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : "No se pudieron cargar las PC armadas."),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const porId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos]);
  const porPaso = useMemo(() => agruparPorPaso(productos), [productos]);
  const maximoOrden = Math.max(0, ...(armadas ?? []).map((a) => a.orden));

  const totalesDe = (piezas: Armado["piezas"]) => {
    const seleccion = seleccionDe(piezas, porId);
    const primera = Object.values(seleccion)[0];
    const medios = primera ? preciosDe(primera) : [];
    return medios.map((medio) => ({
      medio,
      total: PASOS.reduce((suma, paso) => {
        const producto = seleccion[paso.id];
        return suma + (producto ? (precioConMedio(producto, medio.id) ?? 0) * (piezas[paso.id]?.cantidad ?? 1) : 0);
      }, 0),
    }));
  };

  if (error) return <p className="p-6 text-sm text-danger">{error}</p>;
  if (!armadas) return <p className="p-6 text-sm text-muted-foreground">Cargando las PC armadas</p>;

  const seleccion = borrador ? seleccionDe(borrador.piezas, porId) : {};
  const piezasPerdidas = borrador ? PASOS.filter((p) => borrador.piezas[p.id] && !seleccion[p.id]) : [];
  const chequeos = chequeosDelArmado(seleccion, []);
  const completa = Boolean(borrador) && piezasPerdidas.length === 0 && !chequeos.some((c) => c.estado === "falta" || c.estado === "incompatible");
  const totales = borrador ? totalesDe(borrador.piezas) : [];

  function cambiar(cambios: Partial<PcArmada>) {
    setBorrador((b) => (b ? { ...b, ...cambios } : b));
  }

  function elegirPieza(paso: IdDePaso, producto: ProductoPublico) {
    if (!borrador) return;
    const piezas = { ...borrador.piezas, [paso]: { id: producto.id, cantidad: borrador.piezas[paso]?.cantidad ?? 1 } };
    cambiar({ piezas });
    setAbierto(siguientePaso(paso, { piezas, yaTengo: [], origen: null, servicios: [] }, seleccionDe(piezas, porId)));
    setBusqueda("");
  }

  function quitarPieza(paso: IdDePaso) {
    if (!borrador) return;
    cambiar({ piezas: Object.fromEntries(Object.entries(borrador.piezas).filter(([id]) => id !== paso)) as Armado["piezas"] });
  }

  function cambiarCantidad(paso: IdDePaso, cantidad: number) {
    if (!borrador) return;
    const pieza = borrador.piezas[paso];
    if (pieza) cambiar({ piezas: { ...borrador.piezas, [paso]: { ...pieza, cantidad: Math.max(1, Math.min(4, cantidad)) } } });
  }

  async function guardar() {
    if (!borrador) return;
    if (!borrador.nombre.trim()) return void toast.error("Poné un nombre para la PC armada.");
    if (borrador.publicada && !completa) {
      return void toast.error("Para publicarla tiene que estar completa y sin piezas incompatibles. Corregí lo marcado o guardala como borrador.");
    }
    setGuardando(true);
    try {
      const fila = {
        nombre: borrador.nombre.trim(),
        texto: borrador.texto.trim(),
        publicada: borrador.publicada,
        piezas: borrador.piezas,
        actualizada_en: new Date().toISOString(),
      };
      let id = borrador.id;
      if (id) {
        const { error: e } = await supabase.from("pc_armadas").update(fila).eq("id", id);
        if (e) throw new Error(e.message);
      } else {
        const { data, error: e } = await supabase.from("pc_armadas").insert({ ...fila, orden: borrador.orden }).select("id").single();
        if (e) throw new Error(e.message);
        id = (data as { id: string }).id;
      }
      toast.success(borrador.publicada ? "Guardada: la tienda ya la muestra" : "Guardada como borrador");
      await recargar(id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function mover(indice: number, paso: -1 | 1) {
    if (!armadas) return;
    const destino = indice + paso;
    if (destino < 0 || destino >= armadas.length) return;
    const ordenada = armadas.map((a, i) => (i === indice ? armadas[destino] : i === destino ? armadas[indice] : a));
    const cambios = ordenada.map((a, i) => ({ id: a.id, orden: i + 1 })).filter((c, i) => c.id && ordenada[i].orden !== c.orden);
    try {
      const resultados = await Promise.all(cambios.map((c) => supabase.from("pc_armadas").update({ orden: c.orden }).eq("id", c.id as string)));
      const fallo = resultados.find((r) => r.error);
      if (fallo?.error) throw new Error(fallo.error.message);
      await recargar(borrador?.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el orden.");
    }
  }

  async function duplicar() {
    if (!borrador?.id) return;
    const { data, error: e } = await supabase
      .from("pc_armadas")
      .insert({ nombre: `${borrador.nombre} (copia)`.slice(0, 80), texto: borrador.texto, publicada: false, orden: maximoOrden + 1, piezas: borrador.piezas })
      .select("id")
      .single();
    if (e) return void toast.error(e.message);
    toast.success("Copia creada como borrador");
    await recargar((data as { id: string }).id);
  }

  async function eliminar() {
    if (!borrador) return;
    if (!borrador.id) return void (await recargar());
    if (!window.confirm(`¿Eliminar "${borrador.nombre}"? No se puede deshacer.`)) return;
    const { error: e } = await supabase.from("pc_armadas").delete().eq("id", borrador.id);
    if (e) return void toast.error(e.message);
    toast.success("PC armada eliminada");
    await recargar();
  }

  const opcionesDe = (paso: IdDePaso) => {
    const texto = busqueda.trim().toLowerCase();
    return porPaso[paso]
      .filter((p) => !texto || `${p.nombre} ${p.sku ?? ""} ${p.marca ?? ""}`.toLowerCase().includes(texto))
      .map((producto) => ({ producto, evaluacion: evaluar(paso, producto, seleccion) }))
      .sort((a, b) => ORDEN_DE_ESTADO[a.evaluacion.estado] - ORDEN_DE_ESTADO[b.evaluacion.estado] || (a.producto.precio_final_ars ?? 0) - (b.producto.precio_final_ars ?? 0))
      .slice(0, MAXIMO_DE_OPCIONES);
  };

  return (
    <div className="flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold">PC armadas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Aparecen arriba del armador de la tienda, en este orden. El precio es la suma de las piezas y se actualiza solo cuando cambia el costo o el dólar.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setBorrador(nueva(maximoOrden + 1));
            setAbierto("procesador");
          }}
        >
          Nueva PC armada
        </Button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2.5">
          {armadas.length === 0 && <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Todavía no hay PC armadas.</p>}
          {armadas.map((a, i) => {
            const gabinete = a.piezas.gabinete ? porId.get(a.piezas.gabinete.id) : undefined;
            const foto = gabinete ? imagenPrincipal(gabinete) : null;
            const total = totalesDe(a.piezas)[0]?.total ?? 0;
            const piezas = PASOS.reduce((n, p) => n + (a.piezas[p.id]?.cantidad ?? 0), 0);
            return (
              <div key={a.id} className={cn("flex items-center gap-2.5 rounded-2xl border bg-card p-2.5", borrador?.id === a.id ? "border-foreground" : "border-border")}>
                <button
                  type="button"
                  onClick={() => {
                    setBorrador({ ...a, piezas: { ...a.piezas } });
                    setAbierto(null);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg bg-placa-foto">
                    {foto && <img src={foto} alt="" className="max-h-[46px] max-w-[42px] object-contain mix-blend-multiply" />}
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-sm font-bold">{a.nombre}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatearPesos(total)} · {piezas === 1 ? "1 pieza" : `${piezas} piezas`}
                    </span>
                    <span className={cn("self-start rounded-chip px-2 py-0.5 text-[11px] font-bold", a.publicada ? "bg-success text-background" : "bg-secondary text-muted-foreground")}>
                      {a.publicada ? "Publicada" : "Borrador"}
                    </span>
                  </span>
                </button>
                <span className="flex flex-col gap-1">
                  <button type="button" onClick={() => mover(i, -1)} aria-label="Subir" className="rounded-md border border-border p-1 hover:bg-secondary disabled:opacity-40" disabled={i === 0}>
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button type="button" onClick={() => mover(i, 1)} aria-label="Bajar" className="rounded-md border border-border p-1 hover:bg-secondary disabled:opacity-40" disabled={i === armadas.length - 1}>
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              </div>
            );
          })}
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">Si una pieza se queda sin stock, la PC armada se oculta sola de la tienda hasta que vuelva.</p>
        </div>

        {borrador && (
          <div className="flex min-w-0 flex-col gap-4">
            <SurfaceCard className="space-y-3">
              <h3 className="font-bold">Datos</h3>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Nombre</span>
                <Input value={borrador.nombre} maxLength={80} onChange={(e) => cambiar({ nombre: e.target.value })} />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="font-medium">Para qué sirve (lo ve el cliente debajo del nombre)</span>
                <Textarea value={borrador.texto} maxLength={300} rows={2} onChange={(e) => cambiar({ texto: e.target.value })} placeholder="Por ejemplo: para clases, trabajo y navegar" />
              </label>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">Estado</span>
                <span className="flex rounded-chip border border-border p-0.5">
                  {[true, false].map((valor) => (
                    <button
                      key={String(valor)}
                      type="button"
                      onClick={() => cambiar({ publicada: valor })}
                      className={cn("h-8 rounded-chip px-3.5 text-[13px] font-bold", borrador.publicada === valor ? "bg-foreground text-background" : "")}
                    >
                      {valor ? "Publicada" : "Borrador"}
                    </button>
                  ))}
                </span>
                <span className="text-xs text-muted-foreground">
                  {borrador.publicada ? (completa ? "Se ve en la tienda." : "No se puede publicar hasta que esté completa y compatible.") : "No se ve en la tienda."}
                </span>
              </div>
            </SurfaceCard>

            <SurfaceCard className="space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-bold">Piezas</h3>
                <span className="text-xs text-muted-foreground">Al elegir una, pasa sola a la siguiente vacía. Ves primero las compatibles.</span>
              </div>
              <ul className="divide-y divide-border">
                {PASOS.map((paso) => {
                  const pieza = borrador.piezas[paso.id];
                  const producto = seleccion[paso.id];
                  const foto = producto ? imagenPrincipal(producto) : null;
                  const estaAbierto = abierto === paso.id;
                  return (
                    <li key={paso.id} className="py-2.5">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="w-[116px] shrink-0 text-[13px] text-muted-foreground">{paso.nombre}</span>
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-placa-foto">
                          {foto && <img src={foto} alt="" className="max-h-9 max-w-9 object-contain mix-blend-multiply" />}
                        </span>
                        <span className={cn("min-w-0 flex-[1_1_200px] text-sm leading-snug", !producto && "text-muted-foreground")}>
                          {producto ? producto.nombre : pieza ? "Ya no está en la tienda: elegí otra" : paso.necesaria ? "Sin elegir" : "Opcional"}
                        </span>
                        {producto && paso.id === "memoria" && (
                          <span className="flex h-8 items-center rounded-lg border border-input">
                            <button type="button" aria-label="Una menos" onClick={() => cambiarCantidad(paso.id, (pieza?.cantidad ?? 1) - 1)} className="px-2">
                              <Minus className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <span className="min-w-5 text-center text-[13px] font-bold tabular-nums">{pieza?.cantidad ?? 1}</span>
                            <button type="button" aria-label="Una más" onClick={() => cambiarCantidad(paso.id, (pieza?.cantidad ?? 1) + 1)} className="px-2">
                              <Plus className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </span>
                        )}
                        <span className="min-w-[96px] text-right text-sm font-bold tabular-nums">
                          {producto?.precio_final_ars != null ? formatearPesos(producto.precio_final_ars * (pieza?.cantidad ?? 1)) : ""}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant={!pieza && paso.necesaria && !estaAbierto ? "default" : "outline"}
                          onClick={() => {
                            setAbierto(estaAbierto ? null : paso.id);
                            setBusqueda("");
                          }}
                        >
                          {estaAbierto ? "Cerrar" : pieza ? "Cambiar" : "Elegir"}
                        </Button>
                        <button
                          type="button"
                          aria-label={`Quitar ${paso.nombre.toLowerCase()}`}
                          onClick={() => quitarPieza(paso.id)}
                          className={cn("rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary", !pieza && "invisible")}
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                      {estaAbierto && (
                        <div className="mt-2 flex flex-col gap-1.5 sm:pl-[128px]">
                          <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre, marca o SKU" autoFocus />
                          {opcionesDe(paso.id).map(({ producto: p, evaluacion }) => {
                            const fotoOpcion = imagenPrincipal(p);
                            const noVa = evaluacion.estado === "incompatible";
                            return (
                              <button
                                key={p.id}
                                type="button"
                                disabled={noVa || p.precio_final_ars === null}
                                onClick={() => elegirPieza(paso.id, p)}
                                className={cn(
                                  "flex items-center gap-2.5 rounded-lg border bg-background px-2.5 py-2 text-left hover:border-input disabled:cursor-not-allowed disabled:opacity-55",
                                  pieza?.id === p.id ? "border-foreground" : "border-border",
                                )}
                              >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-placa-foto">
                                  {fotoOpcion && <img src={fotoOpcion} alt="" className="max-h-[30px] max-w-[30px] object-contain mix-blend-multiply" />}
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col">
                                  <span className="truncate text-[13px]">{p.nombre}</span>
                                  <span className={cn("text-xs", evaluacion.estado === "compatible" ? "text-success" : noVa ? "text-danger" : "text-muted-foreground")}>
                                    {evaluacion.estado === "compatible" ? "Compatible" : evaluacion.motivo}
                                    {!p.hay_stock && " · sin stock"}
                                  </span>
                                </span>
                                <span className="shrink-0 text-[13px] font-bold tabular-nums">{p.precio_final_ars !== null ? formatearPesos(p.precio_final_ars) : "Sin precio"}</span>
                              </button>
                            );
                          })}
                          {porPaso[paso.id].length === 0 && <p className="text-[13px] text-muted-foreground">No hay productos publicados en esta categoría.</p>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </SurfaceCard>

            <SurfaceCard className="grid gap-5 md:grid-cols-2">
              <div className="space-y-1.5">
                <h3 className="font-bold">Compatibilidad</h3>
                {piezasPerdidas.map((p) => (
                  <p key={p.id} className="flex gap-2 text-[13px] text-danger">
                    <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {p.nombre}: ya no está en la tienda
                  </p>
                ))}
                {chequeos.map((c) => (
                  <p key={c.id} className={cn("flex gap-2 text-[13px]", c.estado === "incompatible" && "text-danger")}>
                    {c.estado === "compatible" ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    ) : c.estado === "incompatible" ? (
                      <X className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    )}
                    {c.texto}
                  </p>
                ))}
              </div>
              <div className="space-y-1">
                <h3 className="font-bold">Precio en la tienda</h3>
                {totales.length === 0 && <p className="text-[13px] text-muted-foreground">Elegí piezas para ver el precio.</p>}
                {totales.map(({ medio, total }, i) => (
                  <div key={medio.id} className="flex items-baseline justify-between gap-3">
                    <span className={cn("text-sm", i > 0 && "text-muted-foreground")}>Con {nombreCortoDeMedio(medio).toLowerCase()}</span>
                    <span className={cn("font-bold tabular-nums", i === 0 ? "text-xl" : "text-sm")}>{formatearPesos(total)}</span>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Suma de las piezas con el margen de cada medio de pago. Los servicios se cobran aparte.</p>
              </div>
            </SurfaceCard>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button type="button" onClick={guardar} disabled={guardando}>
                Guardar
              </Button>
              <Button type="button" variant="outline" onClick={duplicar} disabled={!borrador.id}>
                Duplicar
              </Button>
              <button type="button" onClick={eliminar} className="px-1 text-sm font-bold text-danger underline">
                {borrador.id ? "Eliminar" : "Descartar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
