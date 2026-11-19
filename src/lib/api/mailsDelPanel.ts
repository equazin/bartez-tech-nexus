import { toast } from "sonner";
import { llamarPagos } from "./pagos";

/** Los mails al comprador que el servidor manda después de responderle al panel. */
export type MailAlComprador = "pago_acreditado" | "seguimiento" | "enviado" | "entregado" | "cancelado" | "reintegrado";

type EstadoDelMail = "enviado" | "saliendo" | "fallo";

const NOMBRE_DEL_MAIL: Record<MailAlComprador, string> = {
  pago_acreditado: "pago acreditado",
  seguimiento: "seguimiento",
  enviado: "compra en camino",
  entregado: "compra entregada",
  cancelado: "compra cancelada",
  reintegrado: "reintegro",
};

/** El botón del detalle de la compra (Pedidos) que vuelve a mandar el mail del estado en que está. */
const BOTON_DE_REENVIO = "Reenviar Email (Estado Actual)";

/** Cuánto se espera antes de cada consulta: un mail tarda entre 3 y 10 segundos en salir, y a veces más. */
const ESPERAS_MS = [4_000, 5_000, 7_000, 10_000, 14_000];

const esperar = (ms: number) => new Promise<void>((listo) => window.setTimeout(listo, ms));

/**
 * El panel no espera al servidor de correo: el mail sale después de responder y acá se mira cómo terminó.
 * Si no salió, queda un aviso fijo en pantalla para reenviarlo desde la compra. Nunca tira.
 */
export async function seguirMail(orderId: number | string, tipo: MailAlComprador, numero: string): Promise<void> {
  const mail = `El mail de ${NOMBRE_DEL_MAIL[tipo]} de ${numero}`;
  const sinConfirmar = () =>
    toast.warning(`${mail} quedó sin confirmar. Si el comprador no lo recibe, abrí la compra en Pedidos y tocá «${BOTON_DE_REENVIO}».`, { duration: Infinity, closeButton: true });
  try {
    for (const espera of ESPERAS_MS) {
      await esperar(espera);
      const { estado } = await llamarPagos<{ estado: EstadoDelMail }>("mail", { consulta: { order_id: orderId, tipo } });
      if (estado === "enviado") {
        toast.success(`${mail} salió.`);
        return;
      }
      if (estado === "fallo") {
        toast.error(`${mail} no salió. Abrí la compra en Pedidos y tocá «${BOTON_DE_REENVIO}».`, { duration: Infinity, closeButton: true });
        return;
      }
    }
    sinConfirmar();
  } catch {
    sinConfirmar();
  }
}
