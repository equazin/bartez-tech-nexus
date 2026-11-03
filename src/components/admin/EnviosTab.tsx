import { useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { supabase } from "@/lib/supabase";
import { guardarConfiguracionDePrecios, obtenerEstadoDelDolar } from "@/lib/api/precios";
import { EnvioDeMayoristas } from "./EnvioDeMayoristas";

interface Tarifa {
  id: number;
  peso_hasta_kg: number;
  precio: number;
  demora_dias_min: number;
  demora_dias_max: number;
  activo: boolean;
}

const formatoPesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

async function listarTarifas(): Promise<Tarifa[]> {
  const { data, error } = await supabase.from("tarifas_envio").select("*").order("peso_hasta_kg");
  if (error) throw new Error(error.message);
  return (data ?? []) as Tarifa[];
}

/** Configuración › Envíos: una tarifa nacional por rango de peso, el envío gratis, el peso por defecto y la tarifa plana de los mayoristas que despachan directo. */
export function EnviosTab() {
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [nueva, setNueva] = useState({ peso: "", precio: "", min: "3", max: "7" });
  const [gratisDesde, setGratisDesde] = useState("");
  const [pesoPorDefecto, setPesoPorDefecto] = useState("");

  async function recargar() {
    const [lista, estado] = await Promise.all([listarTarifas(), obtenerEstadoDelDolar()]);
    setTarifas(lista);
    const valorDe = (clave: string) => {
      const fila = estado.configuracion.find((c) => c.clave === clave);
      return fila?.valor === null || fila?.valor === undefined ? "" : String(fila.valor);
    };
    setGratisDesde(valorDe("envio_gratis_desde"));
    setPesoPorDefecto(valorDe("peso_por_defecto_kg"));
  }

  useEffect(() => {
    recargar()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudieron cargar los envíos."))
      .finally(() => setCargando(false));
  }, []);

  async function agregar(evento: FormEvent) {
    evento.preventDefault();
    const peso = Number(nueva.peso.replace(",", "."));
    const precio = Number(nueva.precio.replace(",", "."));
    const min = Number(nueva.min);
    const max = Number(nueva.max);
    if (!(peso > 0) || !(precio >= 0) || !Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      toast.error("Revisá el peso, el precio y la demora.");
      return;
    }
    setGuardando(true);
    try {
      const { error: e } = await supabase.from("tarifas_envio").insert({ peso_hasta_kg: peso, precio, demora_dias_min: min, demora_dias_max: max });
      if (e) throw new Error(e.message);
      setNueva({ peso: "", precio: "", min: "3", max: "7" });
      setTarifas(await listarTarifas());
      toast.success("Tarifa agregada");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo agregar la tarifa.");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarActivo(tarifa: Tarifa) {
    const { error: e } = await supabase.from("tarifas_envio").update({ activo: !tarifa.activo, actualizado_en: new Date().toISOString() }).eq("id", tarifa.id);
    if (e) {
      toast.error(e.message);
      return;
    }
    setTarifas((previas) => previas.map((t) => (t.id === tarifa.id ? { ...t, activo: !t.activo } : t)));
  }

  async function borrar(tarifa: Tarifa) {
    const { error: e } = await supabase.from("tarifas_envio").delete().eq("id", tarifa.id);
    if (e) {
      toast.error(e.message);
      return;
    }
    setTarifas((previas) => previas.filter((t) => t.id !== tarifa.id));
  }

  async function guardarConfiguracion(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    try {
      await guardarConfiguracionDePrecios({
        envio_gratis_desde: gratisDesde.trim() === "" ? null : Number(gratisDesde.replace(",", ".")),
        peso_por_defecto_kg: Number(pesoPorDefecto.replace(",", ".")),
      });
      toast.success("Configuración de envíos guardada");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <p className="p-6 text-sm text-muted-foreground">Cargando los envíos</p>;
  if (error) return <p className="p-6 text-sm text-danger">{error}</p>;

  return (
    <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
      <SurfaceCard className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">Tarifa nacional por peso</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            El mismo precio para todo el país, a domicilio. Se cobra la primera tarifa cuyo tope cubre el peso del pedido; si lo supera, la más pesada.
            Sin tarifas activas, la tienda no puede confirmar compras.
          </p>
        </div>
        {tarifas.length === 0 ? (
          <p className="text-sm text-danger">No hay tarifas cargadas.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border text-sm">
            {tarifas.map((t) => (
              <li key={t.id} className={`flex items-center justify-between gap-3 px-3 py-2 ${t.activo ? "" : "opacity-60"}`}>
                <span className="tabular-nums">
                  Hasta {t.peso_hasta_kg} kg · {formatoPesos.format(t.precio)} · {t.demora_dias_min} a {t.demora_dias_max} días hábiles
                </span>
                <span className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => cambiarActivo(t)}>
                    {t.activo ? "Pausar" : "Activar"}
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Borrar tarifa" onClick={() => borrar(t)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={agregar} className="grid gap-3 sm:grid-cols-4">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Hasta (kg)</span>
            <Input inputMode="decimal" value={nueva.peso} onChange={(e) => setNueva({ ...nueva, peso: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Precio final</span>
            <Input inputMode="decimal" value={nueva.precio} onChange={(e) => setNueva({ ...nueva, precio: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Demora mínima (días)</span>
            <Input inputMode="numeric" value={nueva.min} onChange={(e) => setNueva({ ...nueva, min: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Demora máxima (días)</span>
            <Input inputMode="numeric" value={nueva.max} onChange={(e) => setNueva({ ...nueva, max: e.target.value })} />
          </label>
          <div className="sm:col-span-4">
            <Button type="submit" disabled={guardando}>
              Agregar tarifa
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">Envío gratis y peso por defecto</h2>
          <p className="mt-1 text-sm text-muted-foreground">Un producto sin peso cargado cotiza con el peso por defecto.</p>
        </div>
        <form onSubmit={guardarConfiguracion} className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Envío gratis desde (pesos, vacío para nunca)</span>
            <Input inputMode="decimal" value={gratisDesde} onChange={(e) => setGratisDesde(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Peso por defecto (kg)</span>
            <Input inputMode="decimal" value={pesoPorDefecto} onChange={(e) => setPesoPorDefecto(e.target.value)} />
          </label>
          <Button type="submit" disabled={guardando}>
            Guardar
          </Button>
        </form>
      </SurfaceCard>

      <EnvioDeMayoristas />
    </div>
  );
}
