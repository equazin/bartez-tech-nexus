import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SurfaceCard } from "@/components/ui/surface-card";
import { supabase } from "@/lib/supabase";
import { leerConfiguracionDePagos } from "@/lib/api/pagos";
import { cn } from "@/lib/utils";

/**
 * Armá tu PC › Servicios: armado, sistema y drivers, o cualquier otro. Precio final con IVA por medio de
 * pago; la tienda muestra solo los activos con precio para cada medio activo (vista tienda_servicios).
 * Se cobran como una línea más del pedido, sin stock ni envío.
 */

interface Servicio {
  /** null: nuevo, todavía sin guardar. */
  id: string | null;
  clave: string;
  nombre: string;
  texto: string;
  precios: Record<string, string>;
  solo_con_pc: boolean;
  activo: boolean;
  orden: number;
  cambiado: boolean;
}

interface Medio {
  id: string;
  nombre: string;
  activo: boolean;
}

async function leerServicios(): Promise<Servicio[]> {
  const { data, error } = await supabase.from("servicios_tienda").select("id, nombre, texto, precios, solo_con_pc, activo, orden").order("orden").order("creado_en");
  if (error) throw new Error(`No se pudieron leer los servicios: ${error.message}`);
  return ((data ?? []) as Array<{ id: string; nombre: string; texto: string | null; precios: Record<string, unknown> | null; solo_con_pc: boolean; activo: boolean; orden: number }>).map(
    (s) => ({
      id: s.id,
      clave: s.id,
      nombre: s.nombre,
      texto: s.texto ?? "",
      precios: Object.fromEntries(Object.entries(s.precios ?? {}).map(([medio, precio]) => [medio, typeof precio === "number" ? String(precio) : ""])),
      solo_con_pc: s.solo_con_pc,
      activo: s.activo,
      orden: s.orden,
      cambiado: false,
    }),
  );
}

function aPrecio(texto: string | undefined): number | null {
  if (!texto?.trim()) return null;
  const numero = Number(texto.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero * 100) / 100 : null;
}

export function ServiciosTiendaTab() {
  const [servicios, setServicios] = useState<Servicio[] | null>(null);
  const [medios, setMedios] = useState<Medio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([leerServicios().then(setServicios), leerConfiguracionDePagos().then((c) => setMedios(c.medios.map((m) => ({ id: m.id, nombre: m.nombre, activo: m.activo }))))]).catch(
      (e: unknown) => setError(e instanceof Error ? e.message : "No se pudieron cargar los servicios."),
    );
  }, []);

  if (error) return <p className="p-6 text-sm text-danger">{error}</p>;
  if (!servicios) return <p className="p-6 text-sm text-muted-foreground">Cargando los servicios</p>;

  const activos = medios.filter((m) => m.activo);

  function cambiar(clave: string, cambios: Partial<Servicio>) {
    setServicios((lista) => (lista ?? []).map((s) => (s.clave === clave ? { ...s, ...cambios, cambiado: true } : s)));
  }

  async function guardar(s: Servicio) {
    if (!s.nombre.trim()) return void toast.error("Poné un nombre para el servicio.");
    const precios: Record<string, number> = {};
    for (const medio of medios) {
      const precio = aPrecio(s.precios[medio.id]);
      if (s.precios[medio.id]?.trim() && precio === null) return void toast.error(`El precio con ${medio.nombre} tiene que ser un número mayor a cero.`);
      if (precio !== null) precios[medio.id] = precio;
    }
    const sinPrecio = activos.filter((m) => precios[m.id] === undefined);
    if (s.activo && sinPrecio.length > 0) return void toast.error(`Para activarlo cargá el precio con ${sinPrecio.map((m) => m.nombre).join(" y ")}.`);
    setGuardando(s.clave);
    try {
      const fila = { nombre: s.nombre.trim(), texto: s.texto.trim(), precios, solo_con_pc: s.solo_con_pc, activo: s.activo, actualizado_en: new Date().toISOString() };
      const { error: e } = s.id
        ? await supabase.from("servicios_tienda").update(fila).eq("id", s.id)
        : await supabase.from("servicios_tienda").insert({ ...fila, orden: s.orden });
      if (e) throw new Error(e.message);
      toast.success(s.activo ? "Servicio guardado: la tienda ya lo ofrece" : "Servicio guardado, inactivo");
      setServicios(await leerServicios());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el servicio.");
    } finally {
      setGuardando(null);
    }
  }

  async function eliminar(s: Servicio) {
    if (!s.id) {
      setServicios((lista) => (lista ?? []).filter((x) => x.clave !== s.clave));
      return;
    }
    if (!window.confirm(`¿Eliminar "${s.nombre}"? Los pedidos que ya lo tienen lo conservan.`)) return;
    const { error: e } = await supabase.from("servicios_tienda").delete().eq("id", s.id);
    if (e) return void toast.error(e.message);
    toast.success("Servicio eliminado");
    setServicios(await leerServicios());
  }

  function agregar() {
    const orden = Math.max(0, ...(servicios ?? []).map((s) => s.orden)) + 1;
    setServicios((lista) => [
      ...(lista ?? []),
      { id: null, clave: `nuevo-${Date.now()}`, nombre: "", texto: "", precios: {}, solo_con_pc: true, activo: false, orden, cambiado: true },
    ]);
  }

  return (
    <div className="flex max-w-6xl flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold">Servicios</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Se ofrecen en el armador y en el carrito. Cargá el precio final con IVA para cada medio de pago; sin precio, el servicio no se muestra.
          </p>
        </div>
        <Button type="button" onClick={agregar}>
          Agregar servicio
        </Button>
      </div>

      {servicios.length === 0 && <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Todavía no hay servicios.</p>}

      {servicios.map((s) => (
        <SurfaceCard key={s.clave} className={cn("grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto]", !s.activo && "opacity-80")}>
          <div className="flex min-w-0 flex-col gap-2">
            <Input value={s.nombre} maxLength={80} onChange={(e) => cambiar(s.clave, { nombre: e.target.value })} placeholder="Nombre del servicio" className="font-bold" />
            <Textarea value={s.texto} maxLength={400} rows={2} onChange={(e) => cambiar(s.clave, { texto: e.target.value })} placeholder="Qué incluye" />
          </div>
          <div className="flex flex-wrap gap-3 lg:flex-col">
            {medios.map((medio) => (
              <label key={medio.id} className="block w-[180px] space-y-1 text-sm">
                <span className="font-medium">
                  Con {medio.nombre}
                  {!medio.activo && <span className="text-muted-foreground"> (inactivo)</span>}
                </span>
                <Input inputMode="decimal" value={s.precios[medio.id] ?? ""} onChange={(e) => cambiar(s.clave, { precios: { ...s.precios, [medio.id]: e.target.value } })} placeholder="$ precio final" />
              </label>
            ))}
          </div>
          <div className="flex flex-col gap-3 text-sm lg:w-[230px]">
            <div className="space-y-1">
              <span className="font-medium">Cuándo se ofrece</span>
              <span className="flex flex-col gap-1">
                {[true, false].map((valor) => (
                  <label key={String(valor)} className="flex items-center gap-2">
                    <input type="radio" name={`cuando-${s.clave}`} checked={s.solo_con_pc === valor} onChange={() => cambiar(s.clave, { solo_con_pc: valor })} />
                    {valor ? "Con una PC completa en el carrito" : "Siempre, con cualquier compra"}
                  </label>
                ))}
              </span>
            </div>
            <label className="flex items-center gap-2.5">
              <Switch checked={s.activo} onCheckedChange={(activo) => cambiar(s.clave, { activo })} />
              <span className="font-medium">{s.activo ? "Activo" : "Inactivo"}</span>
            </label>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={() => guardar(s)} disabled={guardando === s.clave || !s.cambiado}>
                Guardar
              </Button>
              <button type="button" onClick={() => eliminar(s)} aria-label="Eliminar servicio" className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </SurfaceCard>
      ))}

      <div className="grid gap-3 md:grid-cols-2">
        <SurfaceCard className="space-y-1">
          <p className="font-bold">Cómo se cobran</p>
          <p className="text-sm text-muted-foreground">Entran al pedido como una línea más, con el precio del medio que eligió el cliente. No llevan stock ni envío aparte.</p>
        </SurfaceCard>
        <SurfaceCard className="space-y-1">
          <p className="font-bold">Con una PC completa</p>
          <p className="text-sm text-muted-foreground">Esos servicios se ofrecen solo si el carrito tiene procesador, motherboard, memoria, almacenamiento y gabinete.</p>
        </SurfaceCard>
      </div>
    </div>
  );
}
