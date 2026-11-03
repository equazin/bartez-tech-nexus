import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tienda } from "@/components/tienda/Tienda";
import { NoEncontrado } from "@/components/tienda/NoEncontrado";
import { ResumenDeCompra } from "@/components/tienda/ResumenDeCompra";
import { obtenerPedido, type PedidoPublico } from "@/lib/tienda/pedidos";
import { usarSeo } from "@/lib/tienda/seo";

function ProximoPaso({ pedido }: { pedido: PedidoPublico }) {
  if (pedido.estado !== "pendiente_pago") return null;
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-secondary p-6">
      <p className="font-bold">Falta pagar</p>
      <p className="text-sm text-muted-foreground">
        {pedido.medio_pago === "transferencia"
          ? "Te mandamos por email los datos de la cuenta para transferir. Cuando se acredite, empezamos a preparar el pedido."
          : "Te mandamos por email el enlace para pagar con Mercado Pago. Cuando se acredite, empezamos a preparar el pedido."}
      </p>
      <p className="text-sm text-muted-foreground">Guardá este enlace: con él podés volver a ver tu compra cuando quieras.</p>
    </div>
  );
}

export default function Compra() {
  const { id = "" } = useParams<{ id: string }>();
  const [parametros] = useSearchParams();
  const token = parametros.get("t") ?? "";
  const [pedido, setPedido] = useState<PedidoPublico | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usarSeo(pedido ? `Compra ${pedido.numero}` : "Tu compra");

  useEffect(() => {
    const numero = Number(id);
    if (!Number.isInteger(numero) || !token) {
      setCargando(false);
      return;
    }
    let cancelado = false;
    obtenerPedido(numero, token)
      .then((p) => {
        if (!cancelado) setPedido(p);
      })
      .catch((e: unknown) => {
        if (!cancelado) setError(e instanceof Error ? e.message : "No se pudo cargar la compra.");
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [id, token]);

  if (cargando) {
    return (
      <Tienda>
        <p className="container mx-auto px-4 py-24 text-muted-foreground">Cargando tu compra</p>
      </Tienda>
    );
  }

  if (error || !pedido) {
    return (
      <Tienda>
        <NoEncontrado titulo="No encontramos esta compra" detalle={error ?? "El enlace puede estar incompleto. Probá buscarla con tu email y el número de pedido."} />
        <div className="container mx-auto px-4 pb-16">
          <Button asChild variant="outline">
            <Link to="/seguimiento">Buscar mi compra</Link>
          </Button>
        </div>
      </Tienda>
    );
  }

  return (
    <Tienda>
      <div className="container mx-auto space-y-6 px-4 py-8">
        <div className="space-y-2">
          <h1 className="text-[40px] font-bold leading-[44px] tracking-[-1px]">Gracias por tu compra</h1>
          <p className="text-muted-foreground">Te mandamos el detalle a {pedido.comprador.email}.</p>
        </div>
        <ProximoPaso pedido={pedido} />
        <ResumenDeCompra pedido={pedido} />
      </div>
    </Tienda>
  );
}
