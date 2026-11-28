/**
 * Las cuentas de una compra de la tienda, en pesos: lo cobrado, el costo de los productos, el del envío, la comisión
 * de Mercado Pago y la ganancia bruta. Las usan el detalle del pedido y el tablero, para que la ganancia sea una sola.
 * Solo para el panel: el costo y el margen nunca salen por la API pública.
 */

export interface LineaDeLaTienda {
  product_id?: number;
  servicio_id?: string;
  name: string;
  sku?: string;
  quantity: number;
  /** Costo unitario en pesos, sin IVA, con el dólar del momento de la venta. */
  cost_price: number | null;
  /** Precio unitario sin IVA. */
  unit_price: number;
  total_price: number;
  iva_rate?: number;
  /** Precio unitario con IVA, el que pagó el comprador. */
  precio_final?: number;
  dolar?: number | null;
  proveedor?: string | null;
}

export interface DetalleDelEnvio {
  opcion?: string;
  sucursal?: string | null;
  transporte?: string | null;
  costo?: number | null;
  zipnova?: { precio_zipnova?: number } | null;
}

export interface PedidoParaCuentas {
  total: number;
  subtotal?: number | null;
  shipping_cost?: number | null;
  discount_amount?: number | null;
  payment_method?: string | null;
  envio_detalle?: DetalleDelEnvio | null;
  products: LineaDeLaTienda[];
}

export interface CuentasDelPedido {
  cobrado: number;
  cobradoNeto: number;
  costoConIva: number;
  costoNeto: number;
  /** Líneas sin costo cargado: no restan en la ganancia. */
  sinCosto: number;
  envio: { monto: number | null; origen: string };
  /** Nula mientras Mercado Pago no la informó. Con otros medios es cero. */
  comision: number | null;
  gananciaConIva: number;
  gananciaNeta: number;
  /** Ganancia sin IVA sobre lo cobrado sin IVA, en porcentaje. */
  margen: number | null;
}

export const IVA_GENERAL = 0.21;

export const esDeMercadoPago = (medio: string | null | undefined): boolean => medio === "mercadopago" || medio === "mercadopago_cuotas";

/** Los medios que cobran comisión por venta (todos menos la transferencia). */
export const cobraComision = (medio: string | null | undefined): boolean => esDeMercadoPago(medio) || medio === "mobbex" || medio === "openpay";

export function costoDelEnvio(p: Pick<PedidoParaCuentas, "envio_detalle" | "shipping_cost">): { monto: number | null; origen: string } {
  const detalle = p.envio_detalle ?? null;
  if (typeof detalle?.costo === "number") return { monto: detalle.costo, origen: detalle.zipnova ? "cotización de Zipnova" : "tarifa del envío" };
  if (typeof detalle?.zipnova?.precio_zipnova === "number") return { monto: detalle.zipnova.precio_zipnova, origen: "cotización de Zipnova" };
  const cobrado = Number(p.shipping_cost ?? 0);
  // Pedidos anteriores sin el costo guardado: la tarifa cobrada es el costo, salvo con envío gratis (no se sabe).
  return cobrado > 0 ? { monto: cobrado, origen: "tarifa cobrada" } : { monto: null, origen: "sin dato" };
}

/**
 * `comisionInformada` es la que informó Mercado Pago al acreditar el pago; nula o sin definir mientras no se sabe.
 * Con transferencia no hay comisión y el valor se ignora.
 */
export function cuentasDelPedido(pedido: PedidoParaCuentas, comisionInformada: number | null | undefined): CuentasDelPedido {
  const lineas = Array.isArray(pedido.products) ? pedido.products : [];
  let ventaProductosNeta = 0;
  let costoNeto = 0;
  let costoConIva = 0;
  let sinCosto = 0;
  for (const l of lineas) {
    ventaProductosNeta += Number(l.total_price ?? 0);
    if (l.cost_price === null || l.cost_price === undefined || Number(l.cost_price) <= 0) {
      sinCosto += 1;
      continue;
    }
    const iva = Number(l.iva_rate ?? 21) / 100;
    costoNeto += Number(l.cost_price) * l.quantity;
    costoConIva += Number(l.cost_price) * (1 + iva) * l.quantity;
  }
  const subtotal = Number(pedido.subtotal ?? 0);
  const descuento = Number(pedido.discount_amount ?? 0);
  // El descuento sale de precios con IVA: se le saca el IVA en la misma proporción que a los productos.
  const descuentoNeto = subtotal > 0 ? descuento * (ventaProductosNeta / subtotal) : descuento / (1 + IVA_GENERAL);
  const envioCobrado = Number(pedido.shipping_cost ?? 0);
  const envio = costoDelEnvio(pedido);
  const comision = cobraComision(pedido.payment_method) ? (comisionInformada ?? null) : 0;

  const cobrado = Number(pedido.total);
  const cobradoNeto = ventaProductosNeta + envioCobrado / (1 + IVA_GENERAL) - descuentoNeto;
  const gananciaConIva = cobrado - costoConIva - (envio.monto ?? 0) - (comision ?? 0);
  const gananciaNeta = cobradoNeto - costoNeto - (envio.monto ?? 0) / (1 + IVA_GENERAL) - (comision ?? 0) / (1 + IVA_GENERAL);
  return {
    cobrado,
    cobradoNeto,
    costoConIva,
    costoNeto,
    sinCosto,
    envio,
    comision,
    gananciaConIva,
    gananciaNeta,
    margen: cobradoNeto > 0 ? (gananciaNeta / cobradoNeto) * 100 : null,
  };
}
