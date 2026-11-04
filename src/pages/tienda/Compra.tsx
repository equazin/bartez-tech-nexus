import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tienda } from "@/components/tienda/Tienda";
import { NoEncontrado } from "@/components/tienda/NoEncontrado";
import { ExtrasDeLaCompra } from "@/components/tienda/ExtrasDeLaCompra";
import { ResumenDeCompra } from "@/components/tienda/ResumenDeCompra";
import { formatearPesos } from "@/lib/tienda/dinero";
import { crearPreferencia, datosDeTransferencia, type DatosDeTransferencia } from "@/lib/tienda/pagos";
import { obtenerPedido, type PedidoPublico } from "@/lib/tienda/pedidos";
import { esDeMercadoPago } from "@/lib/tienda/precios";
import { usarSeo } from "@/lib/tienda/seo";

const formatoFechaHora = new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeStyle: "short" });

function PagarConMercadoPago({ pedido, token, vuelta }: { pedido: PedidoPublico; token: string; vuelta: string | null }) {
  const [yendo, setYendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pagar() {
    setYendo(true);
    setError(null);
    try {
      window.location.href = await crearPreferencia(pedido.id, token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo abrir Mercado Pago.");
      setYendo(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-secondary p-6">
      <p className="font-bold">Falta pagar {formatearPesos(pedido.total)}</p>
      {vuelta === "exito" || vuelta === "pendiente" ? (
        <p className="text-sm text-muted-foreground">
          Estamos confirmando el pago con Mercado Pago. Cuando se acredite, esta página y tu email lo van a mostrar. Si ya pagaste, no vuelvas a pagar.
        </p>
      ) : vuelta === "fallo" ? (
        <p className="text-sm text-muted-foreground">El pago no se completó. Podés intentar de nuevo con otra tarjeta o medio.</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {pedido.medio_pago === "mercadopago_cuotas"
            ? "Pagás en Mercado Pago con tarjeta de crédito, en 3 cuotas sin interés, y volvés a la tienda."
            : "Pagás en Mercado Pago con débito, crédito en 1 pago o dinero en cuenta, y volvés a la tienda."}
        </p>
      )}
      {vuelta !== "exito" && (
        <Button size="lg" onClick={pagar} disabled={yendo}>
          {yendo ? "Abriendo Mercado Pago" : "Pagar con Mercado Pago"}
        </Button>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function PagarPorTransferencia({ pedido, token }: { pedido: PedidoPublico; token: string }) {
  const [datos, setDatos] = useState<DatosDeTransferencia | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    datosDeTransferencia(pedido.id, token)
      .then(setDatos)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudieron cargar los datos."));
  }, [pedido.id, token]);

  const cuenta = datos?.cuenta;
  const sinDatos = !cuenta || !cuenta.cbu;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-secondary p-6">
      <p className="font-bold">Transferí {formatearPesos(pedido.total)}</p>
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !datos ? (
        <p className="text-sm text-muted-foreground">Cargando los datos de la cuenta</p>
      ) : sinDatos ? (
        <p className="text-sm text-muted-foreground">Los datos de la cuenta están a confirmar: te los mandamos por email apenas estén.</p>
      ) : (
        <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
          <dt className="text-muted-foreground">Titular</dt>
          <dd>{cuenta.titular ?? "[A CONFIRMAR]"}</dd>
          <dt className="text-muted-foreground">CUIT</dt>
          <dd className="tabular-nums">{cuenta.cuit ?? "[A CONFIRMAR]"}</dd>
          <dt className="text-muted-foreground">Banco</dt>
          <dd>{cuenta.banco ?? "[A CONFIRMAR]"}</dd>
          <dt className="text-muted-foreground">CBU</dt>
          <dd className="font-mono tabular-nums">{cuenta.cbu}</dd>
          {cuenta.alias && (
            <>
              <dt className="text-muted-foreground">Alias</dt>
              <dd className="font-mono">{cuenta.alias}</dd>
            </>
          )}
        </dl>
      )}
      <p className="text-sm text-muted-foreground">
        Poné el número {pedido.numero} como referencia. Cuando se acredite te avisamos por email y empezamos a preparar el pedido.
        {datos?.vence_en ? ` Tenés tiempo hasta el ${formatoFechaHora.format(new Date(datos.vence_en))}.` : ""}
      </p>
    </div>
  );
}

export default function Compra() {
  const { id = "" } = useParams<{ id: string }>();
  const [parametros] = useSearchParams();
  const token = parametros.get("t") ?? "";
  const vuelta = parametros.get("pago");
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
    let intentos = 0;
    let reloj: ReturnType<typeof setTimeout> | undefined;

    const cargar = () => {
      obtenerPedido(numero, token)
        .then((p) => {
          if (cancelado) return;
          setPedido(p);
          // Al volver de Mercado Pago, el aviso puede tardar unos segundos: se vuelve a mirar hasta un minuto.
          if (p && p.estado === "pendiente_pago" && (vuelta === "exito" || vuelta === "pendiente") && intentos < 12) {
            intentos += 1;
            reloj = setTimeout(cargar, 5_000);
          }
        })
        .catch((e: unknown) => {
          if (!cancelado) setError(e instanceof Error ? e.message : "No se pudo cargar la compra.");
        })
        .finally(() => {
          if (!cancelado) setCargando(false);
        });
    };
    cargar();
    return () => {
      cancelado = true;
      if (reloj) clearTimeout(reloj);
    };
  }, [id, token, vuelta]);

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
          <h1 className="text-[40px] font-bold leading-[44px] tracking-[-1px]">{pedido.estado === "pagado" ? "Pago acreditado" : "Gracias por tu compra"}</h1>
          <p className="text-muted-foreground">
            Te mandamos el detalle a {pedido.comprador.email}. Guardá este enlace o entrá a{" "}
            <Link to="/cuenta" className="underline">
              Mi cuenta
            </Link>{" "}
            con ese email para volver a verla.
          </p>
        </div>
        {pedido.estado === "pendiente_pago" && esDeMercadoPago(pedido.medio_pago) && <PagarConMercadoPago pedido={pedido} token={token} vuelta={vuelta} />}
        {pedido.estado === "pendiente_pago" && pedido.medio_pago === "transferencia" && <PagarPorTransferencia pedido={pedido} token={token} />}
        {pedido.estado === "vencido" && (
          <div className="rounded-2xl border border-border bg-secondary p-6 text-sm text-muted-foreground">
            Venció el plazo para pagar y liberamos el stock. Si ya transferiste, respondé el email de la compra con el comprobante y lo revisamos.
          </div>
        )}
        <ExtrasDeLaCompra pedido={pedido} token={token} />
        <ResumenDeCompra pedido={pedido} />
      </div>
    </Tienda>
  );
}
