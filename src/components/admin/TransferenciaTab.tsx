import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { guardarConfiguracionDePagos, leerConfiguracionDePagos, vencerPendientes, type ConfiguracionDePagos } from "@/lib/api/pagos";

const CAMPOS: Array<{ clave: "titular" | "cuit" | "banco" | "cbu" | "alias"; etiqueta: string }> = [
  { clave: "titular", etiqueta: "Titular de la cuenta" },
  { clave: "cuit", etiqueta: "CUIT del titular" },
  { clave: "banco", etiqueta: "Banco" },
  { clave: "cbu", etiqueta: "CBU (22 números)" },
  { clave: "alias", etiqueta: "Alias" },
];

/** Configuración › Transferencia y medios: la cuenta para transferir, los medios activos y el plazo para pagar. */
export function TransferenciaTab() {
  const [config, setConfig] = useState<ConfiguracionDePagos | null>(null);
  const [cuenta, setCuenta] = useState<Record<string, string>>({});
  const [horas, setHoras] = useState("");
  const [recargos, setRecargos] = useState<Record<string, string>>({});
  const [guardandoRecargos, setGuardandoRecargos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function tomar(c: ConfiguracionDePagos) {
    setConfig(c);
    setCuenta(Object.fromEntries(CAMPOS.map(({ clave }) => [clave, c.transferencia?.[clave] ?? ""])));
    setHoras(c.pendiente_vence_horas === null ? "" : String(c.pendiente_vence_horas));
    setRecargos(Object.fromEntries(c.medios.map((m) => [m.id, String(Number(m.recargo_porcentaje ?? 0))])));
  }

  async function guardarRecargos(evento: FormEvent) {
    evento.preventDefault();
    const valores: Record<string, number> = {};
    for (const [id, texto] of Object.entries(recargos)) {
      const numero = Number(texto.replace(",", "."));
      if (!Number.isFinite(numero) || numero < 0 || numero > 100) {
        toast.error("Cada recargo va de 0 a 100 %.");
        return;
      }
      valores[id] = numero;
    }
    setGuardandoRecargos(true);
    try {
      tomar(await guardarConfiguracionDePagos({ recargos: valores }));
      toast.success("Recargos guardados: la tienda ya muestra los precios nuevos");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudieron guardar los recargos.");
    } finally {
      setGuardandoRecargos(false);
    }
  }

  useEffect(() => {
    leerConfiguracionDePagos()
      .then(tomar)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo cargar la configuración."));
  }, []);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    try {
      tomar(
        await guardarConfiguracionDePagos({
          transferencia: { titular: cuenta.titular, cuit: cuenta.cuit, banco: cuenta.banco, cbu: cuenta.cbu, alias: cuenta.alias },
          pendiente_vence_horas: horas.trim() === "" ? null : Number(horas),
        }),
      );
      toast.success("Configuración de pagos guardada");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarMedio(id: string, activo: boolean) {
    try {
      tomar(await guardarConfiguracionDePagos({ medios: { [id]: activo } }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo cambiar el medio.");
    }
  }

  async function vencerAhora() {
    try {
      const r = await vencerPendientes();
      toast.success(r.aviso ?? `${r.vencidos} pedidos vencidos`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo correr el vencimiento.");
    }
  }

  if (error) return <p className="p-6 text-sm text-danger">{error}</p>;
  if (!config) return <p className="p-6 text-sm text-muted-foreground">Cargando la configuración de pagos</p>;

  return (
    <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
      <SurfaceCard className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">Cuenta para transferir</h2>
          <p className="mt-1 text-sm text-muted-foreground">Lo que ve el comprador al elegir transferencia. Sin cargar, la tienda muestra que los datos están a confirmar.</p>
        </div>
        <form onSubmit={guardar} className="space-y-3">
          {CAMPOS.map(({ clave, etiqueta }) => (
            <label key={clave} className="block space-y-1 text-sm">
              <span className="font-medium">{etiqueta}</span>
              <Input value={cuenta[clave] ?? ""} onChange={(e) => setCuenta({ ...cuenta, [clave]: e.target.value })} />
            </label>
          ))}
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Plazo para pagar (horas; vacío: no vence)</span>
            <Input inputMode="numeric" value={horas} onChange={(e) => setHoras(e.target.value)} />
            <span className="block text-xs text-muted-foreground">Pasado el plazo, el pedido pendiente vence y libera el stock. Una transferencia que llega después igual se puede confirmar.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={guardando}>
              Guardar
            </Button>
            <Button type="button" variant="outline" onClick={vencerAhora}>
              Vencer pendientes ahora
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <SurfaceCard className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">Medios de pago</h2>
          <p className="mt-1 text-sm text-muted-foreground">El checkout ofrece solo los activos. Mercado Pago necesita además las credenciales en el hosting.</p>
        </div>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {config.medios.map((medio) => (
            <li key={medio.id} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
              <span>
                <span className="font-bold">{medio.nombre}</span>
                <span className="block text-xs text-muted-foreground">{medio.detalle}</span>
                {medio.id === "mercadopago" && (
                  <span className={`block text-xs ${config.mercadopago_configurado ? "text-success" : "text-danger"}`}>
                    {config.mercadopago_configurado ? (config.webhook_configurado ? "Credenciales y secreto del aviso cargados" : "Falta el secreto del aviso: los pagos no se acreditan") : "Faltan las credenciales en el hosting"}
                  </span>
                )}
              </span>
              <Button type="button" size="sm" variant={medio.activo ? "outline" : "default"} onClick={() => cambiarMedio(medio.id, !medio.activo)}>
                {medio.activo ? "Desactivar" : "Activar"}
              </Button>
            </li>
          ))}
        </ul>
        <form onSubmit={guardarRecargos} className="space-y-3 border-t border-border pt-4">
          <div>
            <h3 className="font-bold">Recargo por medio</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Porcentaje que se suma al precio final con IVA de cada producto según cómo paga el cliente. La tienda muestra los dos precios y cobra el del medio elegido. El envío no lleva recargo.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {config.medios.map((medio) => (
              <label key={medio.id} className="block space-y-1 text-sm">
                <span className="font-medium">{medio.nombre} (%)</span>
                <Input inputMode="decimal" value={recargos[medio.id] ?? "0"} onChange={(e) => setRecargos({ ...recargos, [medio.id]: e.target.value })} />
              </label>
            ))}
          </div>
          <Button type="submit" disabled={guardandoRecargos}>
            Guardar recargos
          </Button>
        </form>
      </SurfaceCard>
    </div>
  );
}
