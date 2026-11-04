import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { describirCupon, enlaceDeFactura, fechaDeVencimiento } from "@/lib/tienda/cuenta";
import type { PedidoPublico } from "@/lib/tienda/pedidos";

/**
 * Lo que la compra suma después de pagada: la factura en PDF, el cupón para la próxima compra (se activa en Mi
 * cuenta con el email de la compra) y el botón de arrepentimiento con el número y el email ya cargados.
 */
export function ExtrasDeLaCompra({ pedido, token }: { pedido: PedidoPublico; token: string }) {
  const enCamino = pedido.estado === "enviado" || pedido.estado === "entregado";
  const vence = fechaDeVencimiento(pedido.cupon?.vence_en ?? null);
  const arrepentimiento = `/arrepentimiento?compra=${encodeURIComponent(pedido.numero)}${pedido.comprador.email ? `&email=${encodeURIComponent(pedido.comprador.email)}` : ""}`;

  if (!pedido.factura && !pedido.cupon && !enCamino) return null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {pedido.cupon && (
        <section className="space-y-3 rounded-2xl border border-dashed border-foreground/40 bg-card p-6 md:col-span-2">
          <p className="font-display text-xs font-semibold uppercase tracking-[1px] text-muted-foreground">Para tu próxima compra</p>
          <p className="font-mono text-2xl font-bold tracking-[0.12em]">{pedido.cupon.codigo}</p>
          <p className="text-sm">
            {describirCupon(pedido.cupon)}.{vence ? ` Vence el ${vence}.` : ""}
          </p>
          {pedido.cupon.activado ? (
            <p className="text-sm text-muted-foreground">Ya está activo en tu cuenta: cargalo al finalizar la compra, con la sesión abierta.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Para usarlo, activalo en Mi cuenta: entrás con {pedido.comprador.email ?? "el email de la compra"} y un código que te mandamos, sin contraseña.
              </p>
              <Button asChild>
                <Link to={`/cuenta?cupon=${encodeURIComponent(pedido.cupon.codigo)}`}>Activar mi cupón</Link>
              </Button>
            </>
          )}
        </section>
      )}

      {pedido.factura && (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
          <p className="font-bold">Factura</p>
          <p className="text-sm text-muted-foreground">La factura de esta compra está lista en PDF. También te la mandamos por email.</p>
          <Button asChild variant="outline">
            <a href={enlaceDeFactura(pedido.id, token)}>Bajar la factura</a>
          </Button>
        </section>
      )}

      {enCamino && (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-6">
          <p className="font-bold">Botón de arrepentimiento</p>
          <p className="text-sm text-muted-foreground">
            Podés arrepentirte dentro de los 10 días corridos desde que recibiste el pedido, sin dar motivos.
          </p>
          <Button asChild variant="outline">
            <Link to={arrepentimiento}>Me arrepentí de la compra</Link>
          </Button>
        </section>
      )}
    </div>
  );
}
