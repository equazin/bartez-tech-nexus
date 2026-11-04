import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { abrirEtiqueta, crearEnvio, listarParaDespachar, type PedidoParaDespachar } from "@/lib/api/envios";

const ESTADOS: Record<string, string> = { pagado: "Pagado", preparando: "Preparando", enviado: "Enviado" };

/**
 * Pagos › Envíos con Zipnova: los pedidos pagados que despacha Teqo. "Crear envío" lo da de alta en Zipnova
 * con el transporte que eligió el cliente; después se descarga la etiqueta para pegar en el paquete.
 */
export function EnviosZipnova() {
  const [pedidos, setPedidos] = useState<PedidoParaDespachar[] | null>(null);
  const [trabajando, setTrabajando] = useState<number | null>(null);

  async function cargar() {
    try {
      setPedidos(await listarParaDespachar());
    } catch (e: unknown) {
      setPedidos([]);
      toast.error(e instanceof Error ? e.message : "No se pudieron leer los envíos.");
    }
  }

  useEffect(() => {
    void cargar();
  }, []);

  async function crear(pedido: PedidoParaDespachar) {
    setTrabajando(pedido.id);
    try {
      const r = await crearEnvio(pedido.id);
      toast.success(`Envío creado en Zipnova (${r.zipnova_envio_id}).`, { description: r.estado });
      await cargar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el envío.");
    } finally {
      setTrabajando(null);
    }
  }

  async function etiqueta(pedido: PedidoParaDespachar, que: "label" | "document") {
    try {
      await abrirEtiqueta(pedido.id, que);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo bajar la etiqueta. Si el envío es nuevo, esperá unos minutos.");
    }
  }

  if (pedidos === null || pedidos.length === 0) return null;

  return (
    <SurfaceCard className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">Envíos con Zipnova</h2>
        <p className="text-sm text-muted-foreground">
          Pedidos pagados que salen del depósito. Creá el envío cuando la mercadería esté lista: el pedido pasa a preparando y la etiqueta queda
          disponible en unos minutos. Cuando el transporte lo retira, el pedido pasa solo a enviado.
        </p>
      </div>
      <ul className="divide-y divide-border">
        {pedidos.map((p) => {
          const dir = p.direccion_envio ?? {};
          const destino =
            p.envio_detalle?.opcion === "sucursal"
              ? `Retira en sucursal: ${p.envio_detalle.sucursal ?? "a confirmar"}`
              : [`${dir.calle ?? ""} ${dir.numero ?? ""}`.trim(), dir.localidad, dir.provincia, dir.codigo_postal].filter(Boolean).join(", ");
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <div className="min-w-[220px] flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{p.order_number}</span>
                  <Badge variant="outline">{ESTADOS[p.status] ?? p.status}</Badge>
                  {p.shipping_transport && <span className="text-muted-foreground">{p.shipping_transport}</span>}
                </div>
                <div>{p.comprador_nombre}</div>
                <div className="text-muted-foreground">{destino}</div>
                {p.tracking_number && <div className="text-muted-foreground">Seguimiento: {p.tracking_number}</div>}
                {!p.comprador_documento && <div className="text-danger">Falta el DNI del comprador: cargalo en el pedido antes de crear el envío.</div>}
              </div>
              <div className="flex flex-wrap gap-2">
                {!p.zipnova_envio_id ? (
                  <Button size="sm" onClick={() => crear(p)} disabled={trabajando === p.id || !p.comprador_documento}>
                    {trabajando === p.id ? "Creando" : "Crear envío"}
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => etiqueta(p, "label")}>
                      Etiqueta
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => etiqueta(p, "document")}>
                      Guía
                    </Button>
                    {p.envio_seguimiento_url && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={p.envio_seguimiento_url} target="_blank" rel="noreferrer">
                          Seguimiento
                        </a>
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </SurfaceCard>
  );
}
