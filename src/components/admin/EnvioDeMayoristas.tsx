import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { supabase } from "@/lib/supabase";

interface MayoristaDirecto {
  id: string;
  name: string;
  envio_tarifa_plana: number | null;
  envio_demora_dias_min: number | null;
  envio_demora_dias_max: number | null;
}

interface Borrador {
  tarifa: string;
  min: string;
  max: string;
}

const aBorrador = (m: MayoristaDirecto): Borrador => ({
  tarifa: m.envio_tarifa_plana === null ? "" : String(m.envio_tarifa_plana),
  min: m.envio_demora_dias_min === null ? "" : String(m.envio_demora_dias_min),
  max: m.envio_demora_dias_max === null ? "" : String(m.envio_demora_dias_max),
});

/**
 * Configuración › Envíos: los mayoristas que despachan directo al cliente (New Bytes, con Entregar).
 * Sus productos pagan una tarifa plana por pedido; si el carrito mezcla con lo que despacha Teqo,
 * se cobra solo el envío más alto. Sin tarifa cargada, sus productos no se pueden comprar.
 */
export function EnvioDeMayoristas() {
  const [mayoristas, setMayoristas] = useState<MayoristaDirecto[]>([]);
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    supabase
      .from("suppliers")
      .select("id, name, envio_tarifa_plana, envio_demora_dias_min, envio_demora_dias_max")
      .eq("despacho_directo", true)
      .order("name")
      .then(({ data, error: e }) => {
        if (cancelado) return;
        if (e) {
          setError(e.message);
          return;
        }
        const lista = (data ?? []) as MayoristaDirecto[];
        setMayoristas(lista);
        setBorradores(Object.fromEntries(lista.map((m) => [m.id, aBorrador(m)])));
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function guardar(evento: FormEvent, mayorista: MayoristaDirecto) {
    evento.preventDefault();
    const borrador = borradores[mayorista.id];
    const tarifa = borrador.tarifa.trim() === "" ? null : Number(borrador.tarifa.replace(",", "."));
    const min = borrador.min.trim() === "" ? null : Number(borrador.min);
    const max = borrador.max.trim() === "" ? null : Number(borrador.max);
    if (tarifa !== null && !(tarifa >= 0)) return void toast.error("La tarifa es un precio final en pesos, o vacía.");
    if ((min !== null && !Number.isInteger(min)) || (max !== null && !Number.isInteger(max)) || (min !== null && max !== null && max < min)) {
      return void toast.error("Revisá la demora: días enteros y la máxima no menor que la mínima.");
    }
    setGuardando(mayorista.id);
    try {
      const { error: e } = await supabase
        .from("suppliers")
        .update({ envio_tarifa_plana: tarifa, envio_demora_dias_min: min, envio_demora_dias_max: max, updated_at: new Date().toISOString() })
        .eq("id", mayorista.id);
      if (e) throw new Error(e.message);
      setMayoristas((previos) =>
        previos.map((m) => (m.id === mayorista.id ? { ...m, envio_tarifa_plana: tarifa, envio_demora_dias_min: min, envio_demora_dias_max: max } : m)),
      );
      toast.success(`Envío de ${mayorista.name} guardado`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(null);
    }
  }

  if (error) return <SurfaceCard className="text-sm text-danger lg:col-span-2">{error}</SurfaceCard>;
  if (mayoristas.length === 0) return null;

  return (
    <SurfaceCard className="space-y-4 lg:col-span-2">
      <div>
        <h2 className="text-lg font-bold">Mayoristas que despachan directo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sus productos los manda el mayorista a la casa del cliente. Pagan una tarifa plana por pedido; si el carrito también tiene productos que
          despacha Teqo, se cobra solo el envío más alto. Sin tarifa cargada, sus productos no se pueden comprar.
        </p>
      </div>
      {mayoristas.map((m) => {
        const borrador = borradores[m.id] ?? aBorrador(m);
        const cambiar = (campo: keyof Borrador, valor: string) => setBorradores((previos) => ({ ...previos, [m.id]: { ...borrador, [campo]: valor } }));
        return (
          <form key={m.id} onSubmit={(e) => guardar(e, m)} className="grid items-end gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <p className="text-sm font-bold sm:self-center">{m.name}</p>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Tarifa plana (precio final)</span>
              <Input inputMode="decimal" value={borrador.tarifa} onChange={(e) => cambiar("tarifa", e.target.value)} placeholder="Vacía: sin cargar" />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Demora mínima (días)</span>
              <Input inputMode="numeric" value={borrador.min} onChange={(e) => cambiar("min", e.target.value)} />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Demora máxima (días)</span>
              <Input inputMode="numeric" value={borrador.max} onChange={(e) => cambiar("max", e.target.value)} />
            </label>
            <Button type="submit" disabled={guardando === m.id}>
              Guardar
            </Button>
          </form>
        );
      })}
    </SurfaceCard>
  );
}
