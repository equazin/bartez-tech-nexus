import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Tab } from "@/components/admin/layout/adminNavConfig";
import { contar, diaYHora, pesos } from "@/lib/panel/formatos";
import { ESTADOS_DE_LA_TIENDA, nombreDelMedio, tonoDelEstado } from "@/lib/panel/pedidosDeLaTienda";
import type { PedidoDelTablero } from "@/lib/panel/ventas";
import { Tarjeta, Vacio } from "./piezas";

const CUANTAS_MOSTRAR = 8;

/** Los últimos pedidos hechos en el período, pagados o no. */
export function ComprasDelPeriodo({
  compras,
  esDePrueba,
  ahora,
  onIr,
  className,
}: {
  compras: PedidoDelTablero[];
  esDePrueba: (pedido: PedidoDelTablero) => boolean;
  ahora: Date;
  onIr: (tab: Tab) => void;
  className?: string;
}) {
  const visibles = compras.slice(0, CUANTAS_MOSTRAR);
  return (
    <Tarjeta
      titulo="Pedidos del período"
      detalle={compras.length > 0 ? `${contar(compras.length, "pedido hecho", "pedidos hechos")}, pagados o no.` : undefined}
      accion={
        <Button size="sm" variant="outline" onClick={() => onIr("orders")}>
          Ver todos
        </Button>
      }
      className={className}
    >
      {visibles.length === 0 ? (
        <Vacio>No hubo pedidos en este período.</Vacio>
      ) : (
        <ul className="divide-y divide-border/70">
          {visibles.map((pedido) => (
            <li key={String(pedido.id)} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1 basis-52">
                <p className="truncate text-sm font-bold text-foreground">
                  {pedido.order_number ?? `Pedido ${pedido.id}`}
                  <span className="ml-2 font-normal text-muted-foreground">{pedido.comprador_nombre ?? "Sin nombre"}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {diaYHora(pedido.created_at, ahora)} · {nombreDelMedio(pedido.payment_method)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {esDePrueba(pedido) && <Badge variant="outline">De prueba</Badge>}
                <Badge variant={tonoDelEstado(pedido.status)}>{ESTADOS_DE_LA_TIENDA[pedido.status] ?? pedido.status}</Badge>
                <span className="min-w-[6.5rem] text-right text-sm font-bold tabular-nums text-foreground">{pesos(Number(pedido.total))}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {compras.length > visibles.length && (
        <p className="mt-3 text-xs text-muted-foreground">Se muestran los {visibles.length} más nuevos.</p>
      )}
    </Tarjeta>
  );
}
