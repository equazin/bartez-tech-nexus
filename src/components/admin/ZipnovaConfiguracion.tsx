import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  activarAvisosDeZipnova,
  guardarEnvios,
  obtenerEnvios,
  traerCuentasDeZipnova,
  type ConfiguracionDeZipnova,
  type CuentasDeZipnova,
  type EstadoDeEnvios,
  type MedidaDeCategoria,
} from "@/lib/api/envios";

const CLASE_SELECT = "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm";

/**
 * Configuración › Envíos › Zipnova: cuenta, origen (el depósito), margen sobre el precio de Zipnova, retiro en
 * sucursal y medidas de la caja por categoría (los productos tienen peso pero no medidas).
 */
export function ZipnovaConfiguracion() {
  const [estado, setEstado] = useState<EstadoDeEnvios | null>(null);
  const [z, setZ] = useState<ConfiguracionDeZipnova | null>(null);
  const [cuentas, setCuentas] = useState<CuentasDeZipnova | null>(null);
  const [medidas, setMedidas] = useState<Record<number, MedidaDeCategoria & { borrar?: boolean }>>({});
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cargar(datos: EstadoDeEnvios) {
    setEstado(datos);
    setZ(datos.zipnova);
    setMedidas(Object.fromEntries(datos.medidas.map((m) => [m.categoria_id, { ...m }])));
  }

  useEffect(() => {
    obtenerEnvios()
      .then(cargar)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo leer la configuración de envíos."));
  }, []);

  const nombreDe = useMemo(() => new Map((estado?.categorias ?? []).map((c) => [c.id, c.name])), [estado]);

  async function traerCuentas() {
    try {
      setCuentas(await traerCuentasDeZipnova());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo consultar Zipnova.");
    }
  }

  async function guardar() {
    if (!z) return;
    setGuardando(true);
    try {
      cargar(await guardarEnvios({ zipnova: z, medidas: Object.values(medidas) }));
      toast.success("Envíos guardados");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function activarAvisos() {
    try {
      await activarAvisosDeZipnova();
      toast.success("Avisos activados: Zipnova va a avisar cada cambio de estado de los envíos.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudieron activar los avisos.");
    }
  }

  function cambiarMedida(id: number, campo: "alto_cm" | "ancho_cm" | "largo_cm", valor: string) {
    setMedidas((previo) => ({ ...previo, [id]: { ...previo[id], [campo]: Number(valor) || 0 } }));
  }

  if (error) return <SurfaceCard className="text-sm text-danger lg:col-span-2">{error}</SurfaceCard>;
  if (!estado || !z) return <SurfaceCard className="text-sm text-muted-foreground lg:col-span-2">Cargando envíos con Zipnova</SurfaceCard>;

  const visibles = Object.values(medidas).filter((m) => !m.borrar);
  const sinMedida = estado.categorias.filter((c) => !medidas[c.id] || medidas[c.id].borrar);

  return (
    <SurfaceCard className="space-y-5 lg:col-span-2">
      <div>
        <h2 className="text-lg font-bold">Envíos con Zipnova</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Lo que despacha Teqo desde el depósito se cotiza con Zipnova por código postal, peso y medidas, a domicilio o con retiro en sucursal. Lo
          de New Bytes sigue con su tarifa fija. Con Zipnova apagado se usa la tarifa por peso de arriba.
        </p>
        {!estado.credenciales && (
          <p className="mt-2 text-sm text-danger">Faltan ZIPNOVA_API_TOKEN y ZIPNOVA_API_SECRET en Vercel (o falta un Redeploy después de cargarlas).</p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={z.activo} onChange={(e) => setZ({ ...z, activo: e.target.checked })} />
          Cotizar los envíos con Zipnova
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={z.sucursal} onChange={(e) => setZ({ ...z, sucursal: e.target.checked })} />
          Ofrecer retiro en sucursal del transporte
        </label>

        <div className="space-y-1 text-sm">
          <span className="font-medium">Cuenta de Zipnova</span>
          {cuentas ? (
            <select className={CLASE_SELECT} value={z.account_id ?? ""} onChange={(e) => setZ({ ...z, account_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Elegí la cuenta</option>
              {cuentas.cuentas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name ?? c.description ?? `Cuenta ${c.id}`} ({c.id})
                </option>
              ))}
            </select>
          ) : (
            <Input value={z.account_id ?? ""} onChange={(e) => setZ({ ...z, account_id: Number(e.target.value) || null })} inputMode="numeric" placeholder="Número de cuenta" />
          )}
        </div>
        <div className="space-y-1 text-sm">
          <span className="font-medium">Origen (el depósito)</span>
          {cuentas ? (
            <select className={CLASE_SELECT} value={z.origen_id ?? ""} onChange={(e) => setZ({ ...z, origen_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Elegí el origen</option>
              {cuentas.direcciones.map((d) => (
                <option key={d.id} value={d.id}>
                  {[d.name, [d.street, d.street_number].filter(Boolean).join(" "), d.city].filter(Boolean).join(" · ") || `Origen ${d.id}`} ({d.id})
                </option>
              ))}
            </select>
          ) : (
            <Input value={z.origen_id ?? ""} onChange={(e) => setZ({ ...z, origen_id: Number(e.target.value) || null })} inputMode="numeric" placeholder="ID del origen" />
          )}
        </div>

        <label className="space-y-1 text-sm">
          <span className="font-medium">Margen sobre el precio de Zipnova (%)</span>
          <Input type="number" min={0} max={300} step="0.5" value={z.margen_porcentaje} onChange={(e) => setZ({ ...z, margen_porcentaje: Number(e.target.value) || 0 })} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Monto fijo por envío (pesos)</span>
          <Input type="number" min={0} step="100" value={z.margen_fijo} onChange={(e) => setZ({ ...z, margen_fijo: Number(e.target.value) || 0 })} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={traerCuentas} disabled={!estado.credenciales}>
          Traer cuentas y orígenes de Zipnova
        </Button>
        <Button type="button" variant="outline" onClick={activarAvisos} disabled={!estado.credenciales || !z.account_id}>
          Activar avisos de Zipnova
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Los avisos hacen que el pedido pase solo a enviado y a entregado, con el mail de seguimiento al cliente. Activalos una vez, después de guardar la cuenta.
      </p>

      <div className="space-y-2">
        <h3 className="font-bold">Medidas de la caja por categoría (cm)</h3>
        <p className="text-sm text-muted-foreground">
          Son estimadas: revisalas, porque cambian el precio que cotiza Zipnova. Un producto usa la medida de su categoría, si no la de la categoría
          padre, y si no la medida por defecto (30 × 25 × 15).
        </p>
        <div className="divide-y divide-border rounded-xl border border-border">
          {visibles.map((m) => (
            <div key={m.categoria_id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-[180px] flex-1 font-medium">{nombreDe.get(m.categoria_id) ?? `Categoría ${m.categoria_id}`}</span>
              <Input className="w-20" type="number" value={m.largo_cm} onChange={(e) => cambiarMedida(m.categoria_id, "largo_cm", e.target.value)} aria-label="Largo" />
              <span>×</span>
              <Input className="w-20" type="number" value={m.ancho_cm} onChange={(e) => cambiarMedida(m.categoria_id, "ancho_cm", e.target.value)} aria-label="Ancho" />
              <span>×</span>
              <Input className="w-20" type="number" value={m.alto_cm} onChange={(e) => cambiarMedida(m.categoria_id, "alto_cm", e.target.value)} aria-label="Alto" />
              <Button type="button" variant="ghost" size="sm" onClick={() => setMedidas((previo) => ({ ...previo, [m.categoria_id]: { ...m, borrar: true } }))}>
                Quitar
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <select className={`${CLASE_SELECT} max-w-xs`} value={nuevaCategoria} onChange={(e) => setNuevaCategoria(e.target.value)}>
            <option value="">Sumar una categoría</option>
            {sinMedida.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            disabled={!nuevaCategoria}
            onClick={() => {
              const id = Number(nuevaCategoria);
              setMedidas((previo) => ({ ...previo, [id]: { categoria_id: id, largo_cm: 30, ancho_cm: 25, alto_cm: 15 } }));
              setNuevaCategoria("");
            }}
          >
            Sumar
          </Button>
        </div>
      </div>

      <Button type="button" onClick={guardar} disabled={guardando}>
        {guardando ? "Guardando" : "Guardar envíos con Zipnova"}
      </Button>
    </SurfaceCard>
  );
}
