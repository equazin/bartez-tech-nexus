import { useEffect, useState, type FormEvent } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cargarDolar, guardarConfiguracionDePrecios, obtenerEstadoDelDolar, recalcularPrecios, type EstadoDelDolar } from "@/lib/api/precios";

const formatoPesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const formatoFecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

function valorDe(estado: EstadoDelDolar | null, clave: "margen_base" | "redondeo_pesos" | "cuotas_maximas"): string {
  const fila = estado?.configuracion.find((c) => c.clave === clave);
  return fila?.valor === null || fila?.valor === undefined ? "" : String(fila.valor);
}

/** Precios › Dólar y margen: el dólar vigente, su historial, el margen base, el redondeo y las cuotas máximas. */
export function DolarTab() {
  const [estado, setEstado] = useState<EstadoDelDolar | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [nuevoDolar, setNuevoDolar] = useState("");
  const [nota, setNota] = useState("");
  const [margen, setMargen] = useState("");
  const [redondeo, setRedondeo] = useState("");
  const [cuotasMaximas, setCuotasMaximas] = useState("");

  function tomar(nuevo: EstadoDelDolar) {
    setEstado(nuevo);
    setMargen(valorDe(nuevo, "margen_base"));
    setRedondeo(valorDe(nuevo, "redondeo_pesos"));
    setCuotasMaximas(valorDe(nuevo, "cuotas_maximas"));
  }

  useEffect(() => {
    let cancelado = false;
    obtenerEstadoDelDolar()
      .then((nuevo) => {
        if (!cancelado) tomar(nuevo);
      })
      .catch((e: unknown) => {
        if (!cancelado) setError(e instanceof Error ? e.message : "No se pudo cargar el dólar.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  async function enviarDolar(evento: FormEvent) {
    evento.preventDefault();
    const valor = Number(nuevoDolar.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error("Escribí el dólar como un número mayor que cero.");
      return;
    }
    setGuardando(true);
    try {
      const nuevo = await cargarDolar(valor, nota);
      tomar(nuevo);
      setNuevoDolar("");
      setNota("");
      toast.success("Dólar guardado", { description: `${nuevo.recalculados ?? 0} precios recalculados.` });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar el dólar.");
    } finally {
      setGuardando(false);
    }
  }

  async function enviarConfiguracion(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    try {
      const nuevo = await guardarConfiguracionDePrecios({
        margen_base: Number(margen.replace(",", ".")),
        redondeo_pesos: Number(redondeo.replace(",", ".")),
        cuotas_maximas: cuotasMaximas.trim() === "" ? null : Number(cuotasMaximas),
      });
      tomar(nuevo);
      toast.success("Configuración guardada y precios recalculados");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la configuración.");
    } finally {
      setGuardando(false);
    }
  }

  async function recalcular() {
    setGuardando(true);
    try {
      const resultado = await recalcularPrecios();
      toast.success("Precios recalculados", { description: `${resultado.recalculados} productos.` });
      tomar(await obtenerEstadoDelDolar());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudieron recalcular los precios.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <p className="p-6 text-sm text-muted-foreground">Cargando el dólar y la configuración</p>;
  if (error) return <p className="p-6 text-sm text-danger">{error}</p>;

  return (
    <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
      <SurfaceCard className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">Dólar vigente</h2>
          {estado?.vigente ? (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="text-2xl font-bold tabular-nums text-foreground">{formatoPesos.format(estado.vigente.valor)}</span> desde el{" "}
              {formatoFecha.format(new Date(estado.vigente.vigente_desde))}
              {estado.vigente.nota ? ` · ${estado.vigente.nota}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm text-danger">Todavía no hay un dólar cargado: los productos cotizados en dólares quedan sin precio en la tienda.</p>
          )}
          {estado && estado.sin_precio > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">{estado.sin_precio} productos activos sin precio final (sin costo, sin dólar o con precio manual vacío).</p>
          )}
        </div>
        <form onSubmit={enviarDolar} className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Dólar nuevo (pesos por dólar)</span>
            <Input inputMode="decimal" value={nuevoDolar} onChange={(e) => setNuevoDolar(e.target.value)} placeholder="Por ejemplo 1450" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Nota (opcional)</span>
            <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="De dónde sale el valor" maxLength={200} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={guardando}>
              Guardar y recalcular
            </Button>
            <Button type="button" variant="outline" disabled={guardando} onClick={recalcular} className="gap-2">
              <RefreshCw className="h-4 w-4" aria-hidden />
              Recalcular todos los precios
            </Button>
          </div>
        </form>
        {estado && estado.historial.length > 1 && (
          <div>
            <h3 className="mb-2 text-sm font-bold">Historial</h3>
            <ul className="divide-y divide-border rounded-xl border border-border text-sm">
              {estado.historial.map((fila) => (
                <li key={fila.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="tabular-nums">{formatoPesos.format(fila.valor)}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatoFecha.format(new Date(fila.vigente_desde))}
                    {fila.nota ? ` · ${fila.nota}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">Margen, redondeo y cuotas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            El precio final es el costo en pesos más el margen (el de la regla que coincide o este margen base), más el IVA del producto,
            redondeado. Cualquier cambio recalcula todos los precios que no sean manuales.
          </p>
        </div>
        <form onSubmit={enviarConfiguracion} className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Margen base (%)</span>
            <Input inputMode="decimal" value={margen} onChange={(e) => setMargen(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Redondeo (pesos)</span>
            <Input inputMode="numeric" value={redondeo} onChange={(e) => setRedondeo(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Cuotas máximas (vacío: las que da Mercado Pago)</span>
            <Input inputMode="numeric" value={cuotasMaximas} onChange={(e) => setCuotasMaximas(e.target.value)} />
          </label>
          <Button type="submit" disabled={guardando}>
            Guardar configuración
          </Button>
        </form>
      </SurfaceCard>
    </div>
  );
}
