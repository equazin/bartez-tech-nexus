import { supabase } from "@/lib/supabase";

export type MedioDePago = "mercadopago" | "transferencia";

export interface MedioDisponible {
  id: MedioDePago;
  nombre: string;
  detalle: string;
}

/** Los medios que ofrece el checkout. La fase de pagos los toma de la configuración del panel. */
export const MEDIOS_DE_PAGO: MedioDisponible[] = [
  { id: "mercadopago", nombre: "Mercado Pago", detalle: "Tarjeta de crédito en cuotas, débito o dinero en cuenta. Pagás en Mercado Pago y volvés a la tienda." },
  { id: "transferencia", nombre: "Transferencia bancaria", detalle: "Te damos los datos de la cuenta al confirmar. El pedido se prepara cuando se acredita." },
];

export interface DatosDelComprador {
  nombre: string;
  email: string;
  telefono: string;
  documento?: string;
}

export interface DireccionDeEnvio {
  calle: string;
  numero: string;
  piso?: string;
  codigo_postal: string;
  localidad: string;
  provincia: string;
}

export interface PedidoNuevo {
  items: Array<{ product_id: number; quantity: number }>;
  /** Servicios sumados (armado, sistema y drivers...), por id. */
  servicios?: string[];
  comprador: DatosDelComprador;
  envio: DireccionDeEnvio;
  medio_pago: MedioDePago;
  cupon?: string;
  notas?: string;
}

export interface PedidoCreado {
  id: number;
  numero: string;
  token: string;
}

export interface ItemDelPedido {
  producto_id: number;
  nombre: string;
  sku: string | null;
  cantidad: number;
  precio_final: number | null;
  slug: string | null;
  categoria_slug: string | null;
  imagen: string | null;
}

export interface PedidoPublico {
  id: number;
  numero: string;
  estado: string;
  creado_en: string;
  pagado_en: string | null;
  total: number;
  subtotal: number | null;
  envio_costo: number | null;
  envio_demora_dias_min: number | null;
  envio_demora_dias_max: number | null;
  descuento: number | null;
  medio_pago: string | null;
  seguimiento: string | null;
  transporte: string | null;
  comprador: { nombre: string | null; email: string | null };
  direccion: DireccionDeEnvio | null;
  items: ItemDelPedido[];
}

export async function crearPedido(pedido: PedidoNuevo): Promise<PedidoCreado> {
  const respuesta = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pedido),
  });
  const json = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; data?: PedidoCreado; error?: string };
  if (!respuesta.ok || !json.data) throw new Error(json.error ?? "No se pudo crear el pedido.");
  return json.data;
}

export async function obtenerPedido(id: number, token: string): Promise<PedidoPublico | null> {
  const { data, error } = await supabase.rpc("tienda_pedido", { p_id: id, p_token: token });
  if (error) throw new Error(`No se pudo cargar la compra: ${error.message}`);
  return (data as PedidoPublico | null) ?? null;
}

export async function buscarPedido(email: string, numero: string): Promise<PedidoPublico | null> {
  const { data, error } = await supabase.rpc("tienda_pedido_por_email", { p_email: email.trim(), p_numero: numero.trim() });
  if (error) throw new Error(`No se pudo buscar la compra: ${error.message}`);
  return (data as PedidoPublico | null) ?? null;
}

export const ESTADOS: Record<string, string> = {
  pendiente_pago: "Pendiente de pago",
  pagado: "Pagado",
  preparando: "En preparación",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
  reintegrado: "Reintegrado",
  vencido: "Vencido",
};

export const etiquetaDeEstado = (estado: string): string => ESTADOS[estado] ?? estado;
