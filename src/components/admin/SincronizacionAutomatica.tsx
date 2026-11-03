import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";
import {
  guardarSincronizacion,
  obtenerSincronizacion,
  sincronizarAhora,
  type CorridaDeSincronizacion,
  type EstadoDeSincronizacion,
  type TipoDeDolar,
} from "@/lib/api/precios";

const formatoPesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const formatoFecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

const TIPOS: Array<{ valor: TipoDeDolar; nombre: string }> = [
  { valor: "billete", nombre: "Billete" },
  { valor: "divisa", nombre: "Divisa" },
];

function textoDelDolar(corrida: CorridaDeSincronizacion): string {
  const d = corrida.dolar;
  if (d.estado === "apagado") return "Dólar: apagado.";
  if (d.estado === "error") return `Dólar: ${d.error ?? "no se pudo leer"}${d.valor ? ` (leído ${formatoPesos.format(d.valor)})` : ""}.`;
  const valor = d.valor ? formatoPesos.format(d.valor) : "";
  if (d.estado === "sin_cambios") return `Dólar: ${valor}, sin cambios.`;
  return `Dólar: ${valor}${d.anterior ? ` (antes ${formatoPesos.format(d.anterior)})` : ""}.`;
}

function textoDeElit(corrida: CorridaDeSincronizacion): string {
  const e = corrida.elit;
  if (e.estado === "apagada") return "ELIT: apagada.";
  if (e.estado === "sin_credenciales" || e.estado === "error") return `ELIT: ${e.error ?? "no se pudo consultar"}.`;
  const partes = [`${e.revisados} de ${e.vinculados} productos revisados`, `${e.productos_cambiados} con costo o stock nuevo`];
  if (e.no_encontrados > 0) partes.push(`${e.no_encontrados} que ELIT ya no devuelve`);
  return `ELIT: ${partes.join(", ")}${e.estado === "parcial" ? ". Faltó tiempo: sigue en la próxima corrida" : ""}.`;
}

/** Precios › Dólar: el dólar del BNA y los costos y el stock de ELIT, a las 9 y a las 18 (hora de Argentina). */
export function SincronizacionAutomatica({ alTerminar }: { alTerminar: () => void }) {
  const [estado, setEstado] = useState<EstadoDeSincronizacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let cancelado = false;
    obtenerSincronizacion()
      .then((nuevo) => !cancelado && setEstado(nuevo))
      .catch((e: unknown) => !cancelado && setError(e instanceof Error ? e.message : "No se pudo leer la sincronización."));
    return () => {
      cancelado = true;
    };
  }, []);

  async function guardar(cambios: Parameters<typeof guardarSincronizacion>[0]) {
    setOcupado(true);
    try {
      setEstado(await guardarSincronizacion(cambios));
      toast.success("Sincronización guardada");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  }

  async function correr() {
    setOcupado(true);
    try {
      const corrida = await sincronizarAhora();
      setEstado((previo) => (previo ? { ...previo, ultima: corrida } : previo));
      toast.success("Sincronización terminada", { description: `${corrida.recalculados ?? 0} precios recalculados.` });
      alTerminar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo sincronizar.");
    } finally {
      setOcupado(false);
    }
  }

  if (error) return <SurfaceCard className="text-sm text-danger lg:col-span-2">{error}</SurfaceCard>;
  if (!estado) return <SurfaceCard className="text-sm text-muted-foreground lg:col-span-2">Cargando la sincronización</SurfaceCard>;

  const { configuracion, ultima } = estado;
  return (
    <SurfaceCard className="space-y-4 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Sincronización automática</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos los días a las 9 y a las 18 (hora de Argentina) se toma el dólar del Banco Nación, se traen los costos y el stock de ELIT
            y se recalculan los precios.
          </p>
        </div>
        <Button type="button" variant="outline" disabled={ocupado} onClick={correr} className="gap-2">
          <RefreshCw className={cn("h-4 w-4", ocupado && "animate-spin")} aria-hidden />
          Sincronizar ahora
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-border p-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Dólar del BNA automático</span>
            <Switch checked={configuracion.dolar.activo} disabled={ocupado} onCheckedChange={(activo) => guardar({ dolar: { activo } })} />
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Cotización de venta:</span>
            {TIPOS.map((tipo) => (
              <button
                key={tipo.valor}
                type="button"
                disabled={ocupado || !configuracion.dolar.activo}
                onClick={() => guardar({ dolar: { tipo: tipo.valor } })}
                aria-pressed={configuracion.dolar.tipo === tipo.valor}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-50",
                  configuracion.dolar.tipo === tipo.valor ? "border-foreground bg-foreground text-background" : "border-input hover:bg-secondary",
                )}
              >
                {tipo.nombre}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Con el automático prendido, un dólar cargado a mano dura hasta la próxima corrida.</p>
        </div>

        <div className="space-y-3 rounded-xl border border-border p-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Costos y stock de ELIT</span>
            <Switch checked={configuracion.elit.activa} disabled={ocupado} onCheckedChange={(activa) => guardar({ elit: { activa } })} />
          </label>
          <p className="text-xs text-muted-foreground">
            {estado.credenciales_elit
              ? "Actualiza los productos que ya están vinculados a ELIT."
              : "Faltan las credenciales de ELIT en Vercel (ELIT_API_USER_ID y ELIT_API_TOKEN)."}
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-secondary/60 p-3 text-sm">
        {ultima ? (
          <>
            <p className="font-medium">
              Última corrida: {formatoFecha.format(new Date(ultima.empezo))} ({ultima.disparada_por === "cron" ? "automática" : "desde el panel"})
            </p>
            <p className="mt-1 text-muted-foreground">{textoDelDolar(ultima)}</p>
            <p className="text-muted-foreground">{textoDeElit(ultima)}</p>
            <p className="text-muted-foreground">
              {ultima.error_recalculo ? `Recálculo: ${ultima.error_recalculo}.` : `${ultima.recalculados ?? 0} precios recalculados.`}
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">Todavía no corrió. La primera corrida automática es a las 9 o a las 18, la que llegue antes.</p>
        )}
      </div>
    </SurfaceCard>
  );
}
