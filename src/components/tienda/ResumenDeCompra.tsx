import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { formatearPesos } from "@/lib/tienda/dinero";
import { textoDeDemora } from "@/lib/tienda/envios";
import { etiquetaDeEstado, type PedidoPublico } from "@/lib/tienda/pedidos";
import { resolveProductImageUrl } from "@/lib/productImage";

const formatoFecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "long" });

export function ResumenDeCompra({ pedido }: { pedido: PedidoPublico }) {
  const envio = pedido.envio_costo ?? 0;
  const descuento = pedido.descuento ?? 0;
  const demora = textoDeDemora({ demora_dias_min: pedido.envio_demora_dias_min, demora_dias_max: pedido.envio_demora_dias_max });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[20px] font-bold leading-[26px]">Compra {pedido.numero}</h2>
          <Badge variant={pedido.estado === "pagado" || pedido.estado === "entregado" ? "success" : "secondary"}>{etiquetaDeEstado(pedido.estado)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Hecha el {formatoFecha.format(new Date(pedido.creado_en))}</p>

        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {pedido.items.map((item) => (
            <li key={`${item.producto_id}-${item.sku ?? ""}`} className="flex items-center gap-4 p-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-placa-foto p-1">
                {item.imagen && <img src={resolveProductImageUrl(item.imagen)} alt="" className="h-full w-full object-contain mix-blend-multiply" />}
              </div>
              <div className="min-w-0 flex-1">
                {item.slug ? (
                  <Link to={`/${item.categoria_slug ?? "productos"}/${item.slug}`} className="font-medium hover:underline">
                    {item.nombre}
                  </Link>
                ) : (
                  <p className="font-medium">{item.nombre}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {item.cantidad} {item.cantidad === 1 ? "unidad" : "unidades"}
                </p>
              </div>
              <p className="font-bold tabular-nums">{item.precio_final !== null ? formatearPesos(item.precio_final * item.cantidad) : ""}</p>
            </li>
          ))}
        </ul>
      </section>

      <aside className="space-y-4">
        <div className="space-y-2 rounded-2xl border border-border bg-card p-6 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatearPesos(pedido.subtotal ?? pedido.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Envío</span>
            <span className="tabular-nums">{envio > 0 ? formatearPesos(envio) : "Sin cargo"}</span>
          </div>
          {descuento > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descuento</span>
              <span className="tabular-nums">- {formatearPesos(descuento)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
            <span>Total</span>
            <span className="tabular-nums">{formatearPesos(pedido.total)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Precios finales con IVA incluido.</p>
        </div>

        {pedido.direccion && (
          <div className="space-y-1 rounded-2xl border border-border bg-card p-6 text-sm">
            {pedido.envio_opcion === "sucursal" ? (
              <>
                <p className="font-bold">Retiro en sucursal del transporte</p>
                <p>{pedido.sucursal ?? "Sucursal a confirmar"}</p>
              </>
            ) : (
              <>
                <p className="font-bold">Envío a domicilio</p>
                <p>
                  {pedido.direccion.calle} {pedido.direccion.numero}
                  {pedido.direccion.piso ? `, ${pedido.direccion.piso}` : ""}
                </p>
                <p>
                  {pedido.direccion.localidad}, {pedido.direccion.provincia} (CP {pedido.direccion.codigo_postal})
                </p>
              </>
            )}
            {demora && <p className="text-muted-foreground">{demora} desde que se acredita el pago.</p>}
            {pedido.seguimiento && (
              <p className="text-muted-foreground">
                Seguimiento {pedido.transporte ? `${pedido.transporte} ` : ""}
                <span className="font-mono">{pedido.seguimiento}</span>
              </p>
            )}
            {pedido.seguimiento_url && (
              <p>
                <a href={pedido.seguimiento_url} target="_blank" rel="noreferrer" className="font-bold underline">
                  Seguir el envío
                </a>
              </p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
