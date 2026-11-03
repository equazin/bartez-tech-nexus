import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { LineaDeDespachoDirecto, PedidoDeLaTienda } from "@/lib/api/pagos";

/** El texto para cargar el pedido en el sitio del mayorista: productos, cliente y dirección. */
function textoParaElMayorista(pedido: PedidoDeLaTienda, lineas: LineaDeDespachoDirecto[]): string {
  const d = pedido.direccion_envio ?? {};
  const calle = [d.calle, d.numero, d.piso].filter(Boolean).join(" ");
  return [
    `Pedido ${pedido.order_number}`,
    ...lineas.map((l) => `${l.cantidad} x ${l.nombre}${l.sku ? ` (${l.sku})` : ""}${l.id_del_mayorista ? ` · id ${l.id_del_mayorista}` : ""}`),
    "",
    `Cliente: ${pedido.comprador_nombre ?? ""}`,
    pedido.comprador_documento ? `Documento: ${pedido.comprador_documento}` : null,
    pedido.comprador_telefono ? `Teléfono: ${pedido.comprador_telefono}` : null,
    pedido.comprador_email ? `Email: ${pedido.comprador_email}` : null,
    `Dirección: ${[calle, d.localidad, d.provincia, d.codigo_postal ? `CP ${d.codigo_postal}` : null].filter(Boolean).join(", ")}`,
    d.referencias ? `Referencias: ${d.referencias}` : null,
  ]
    .filter((linea) => linea !== null)
    .join("\n");
}

/**
 * Ventas › Pagos: en un pedido con productos que despacha un mayorista directo (New Bytes, con Entregar),
 * qué líneas pedirle y los datos del cliente listos para copiar en su sitio. El pedido al mayorista es a
 * mano por ahora (decisión de Nico del 3/11/2026).
 */
export function DespachoDirecto({ pedido, lineas }: { pedido: PedidoDeLaTienda; lineas: LineaDeDespachoDirecto[] }) {
  if (lineas.length === 0) return null;
  const porProveedor = new Map<string, LineaDeDespachoDirecto[]>();
  for (const linea of lineas) porProveedor.set(linea.proveedor, [...(porProveedor.get(linea.proveedor) ?? []), linea]);

  async function copiar(proveedor: string, suyas: LineaDeDespachoDirecto[]) {
    try {
      await navigator.clipboard.writeText(textoParaElMayorista(pedido, suyas));
      toast.success(`Datos copiados para ${proveedor}`);
    } catch {
      toast.error("No se pudo copiar. Seleccioná el texto a mano.");
    }
  }

  const listoParaPedir = pedido.status === "pagado" || pedido.status === "preparando";

  return (
    <>
      {[...porProveedor].map(([proveedor, suyas]) => (
        <div key={proveedor} className="space-y-2 rounded-xl border border-border bg-secondary/50 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">Lo despacha {proveedor}</p>
            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={() => copiar(proveedor, suyas)}>
              <Copy className="h-4 w-4" aria-hidden />
              Copiar datos para {proveedor}
            </Button>
          </div>
          <ul className="space-y-0.5">
            {suyas.map((l, i) => (
              <li key={`${l.nombre}-${i}`} className="tabular-nums">
                {l.cantidad} × {l.nombre}
                {l.sku ? <span className="text-muted-foreground"> · {l.sku}</span> : null}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {listoParaPedir
              ? `Cargá este pedido en el sitio de ${proveedor} con la dirección del cliente para que lo despache.`
              : `Se le pide a ${proveedor} cuando el pedido esté pagado.`}
          </p>
        </div>
      ))}
    </>
  );
}
