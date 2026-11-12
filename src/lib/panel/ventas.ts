/**
 * Las cuentas del tablero, sacadas de las compras de la tienda que el panel ya tiene cargadas. Una compra cuenta como
 * venta el día en que se acreditó el pago (pagado_en) y mientras siga cobrada: cancelada, reintegrada o vencida no
 * cuenta. La ganancia es la misma del detalle del pedido (cuentasDelPedido).
 */

import { cuentasDelPedido, esDeMercadoPago, IVA_GENERAL, type DetalleDelEnvio, type LineaDeLaTienda } from "./cuentasDelPedido";
import { estaPagado, nombreDelMedio } from "./pedidosDeLaTienda";
import { diaDeArgentina } from "./periodos";

export interface PedidoDelTablero {
  id: string | number;
  order_number?: string | null;
  status: string;
  origen?: string | null;
  total: number;
  subtotal?: number | null;
  shipping_cost?: number | null;
  discount_amount?: number | null;
  payment_method?: string | null;
  created_at: string;
  pagado_en?: string | null;
  preparando_en?: string | null;
  enviado_en?: string | null;
  comprador_nombre?: string | null;
  factura_path?: string | null;
  envio_detalle?: DetalleDelEnvio | null;
  products: LineaDeLaTienda[];
}

export interface PagoDelTablero {
  order_id: number;
  proveedor: string;
  estado: string;
  cuotas: number | null;
  /** Lo que descontó Mercado Pago. Nula si todavía no la informó o si quien mira no es administrador. */
  comision: number | null;
  reintegrado: number;
}

export interface Rango {
  desde: string;
  hasta: string;
}

export interface VentaPorMedio {
  medio: string;
  etiqueta: string;
  compras: number;
  cobrado: number;
}

export interface ProductoVendido {
  clave: string;
  nombre: string;
  unidades: number;
  facturado: number;
}

export interface ResumenDeVentas {
  /** Compras cobradas en el período. */
  compras: number;
  cobrado: number;
  cobradoNeto: number;
  /** Ganancia bruta sin IVA: después del costo, el envío y las comisiones informadas. */
  ganancia: number;
  margen: number | null;
  ticket: number | null;
  /** Compras con alguna línea sin costo cargado: su ganancia está inflada. */
  conLineasSinCosto: number;
  /** Compras con Mercado Pago cuya comisión todavía no se sabe. */
  sinComision: number;
  /** Pedidos hechos en el período, pagados o no. */
  creadas: number;
  porMedio: VentaPorMedio[];
  porDia: Map<string, { cobrado: number; compras: number }>;
  masVendidos: ProductoVendido[];
}

const enRango = (dia: string, rango: Rango): boolean => dia !== "" && dia >= rango.desde && dia <= rango.hasta;

/** Una compra es de prueba cuando todos sus productos llevan la etiqueta `prueba`. */
export function esDePrueba(pedido: PedidoDelTablero, idsDePrueba: ReadonlySet<number>): boolean {
  if (idsDePrueba.size === 0) return false;
  const conProducto = (Array.isArray(pedido.products) ? pedido.products : []).filter((l) => typeof l.product_id === "number");
  return conProducto.length > 0 && conProducto.every((l) => idsDePrueba.has(l.product_id as number));
}

export const soloDeLaTienda = (pedidos: readonly PedidoDelTablero[]): PedidoDelTablero[] => pedidos.filter((p) => p.origen === "tienda");

/** El pago acreditado de cada compra, por número de pedido. Si hay más de uno, vale el último. */
export function pagosPorPedido(pagos: readonly PagoDelTablero[]): Map<number, PagoDelTablero> {
  const mapa = new Map<number, PagoDelTablero>();
  for (const pago of pagos) mapa.set(Number(pago.order_id), pago);
  return mapa;
}

/** Las compras cobradas dentro del rango, por el día en que se acreditó el pago. */
export function ventasDelRango(pedidos: readonly PedidoDelTablero[], rango: Rango): PedidoDelTablero[] {
  return pedidos.filter((p) => estaPagado(p.status) && enRango(diaDeArgentina(p.pagado_en), rango));
}

export function resumirVentas(pedidos: readonly PedidoDelTablero[], pagos: ReadonlyMap<number, PagoDelTablero>, rango: Rango): ResumenDeVentas {
  const ventas = ventasDelRango(pedidos, rango);
  const porMedio = new Map<string, VentaPorMedio>();
  const porDia = new Map<string, { cobrado: number; compras: number }>();
  const vendidos = new Map<string, ProductoVendido>();
  let cobrado = 0;
  let cobradoNeto = 0;
  let ganancia = 0;
  let conLineasSinCosto = 0;
  let sinComision = 0;

  for (const pedido of ventas) {
    const pago = pagos.get(Number(pedido.id));
    // Un reintegro parcial deja la compra cobrada, pero por menos.
    const reintegrado = Math.min(Number(pago?.reintegrado ?? 0), Number(pedido.total));
    const reintegradoNeto = reintegrado / (1 + IVA_GENERAL);
    const cuentas = cuentasDelPedido(pedido, pago?.comision);
    const cobradoDeEsta = cuentas.cobrado - reintegrado;
    cobrado += cobradoDeEsta;
    cobradoNeto += cuentas.cobradoNeto - reintegradoNeto;
    ganancia += cuentas.gananciaNeta - reintegradoNeto;
    if (cuentas.sinCosto > 0) conLineasSinCosto += 1;
    if (esDeMercadoPago(pedido.payment_method) && cuentas.comision === null) sinComision += 1;

    const medio = pedido.payment_method ?? "sin_medio";
    const delMedio = porMedio.get(medio) ?? { medio, etiqueta: nombreDelMedio(pedido.payment_method), compras: 0, cobrado: 0 };
    porMedio.set(medio, { ...delMedio, compras: delMedio.compras + 1, cobrado: delMedio.cobrado + cobradoDeEsta });

    const dia = diaDeArgentina(pedido.pagado_en);
    const delDia = porDia.get(dia) ?? { cobrado: 0, compras: 0 };
    porDia.set(dia, { cobrado: delDia.cobrado + cobradoDeEsta, compras: delDia.compras + 1 });

    for (const linea of Array.isArray(pedido.products) ? pedido.products : []) {
      const clave = typeof linea.product_id === "number" ? `p${linea.product_id}` : `s${linea.servicio_id ?? linea.name}`;
      const cantidad = Number(linea.quantity ?? 0);
      const iva = Number(linea.iva_rate ?? 21) / 100;
      const precio = Number(linea.precio_final ?? Number(linea.unit_price ?? 0) * (1 + iva));
      const anterior = vendidos.get(clave) ?? { clave, nombre: linea.name, unidades: 0, facturado: 0 };
      vendidos.set(clave, { ...anterior, unidades: anterior.unidades + cantidad, facturado: anterior.facturado + precio * cantidad });
    }
  }

  return {
    compras: ventas.length,
    cobrado,
    cobradoNeto,
    ganancia,
    margen: cobradoNeto > 0 ? (ganancia / cobradoNeto) * 100 : null,
    ticket: ventas.length > 0 ? cobrado / ventas.length : null,
    conLineasSinCosto,
    sinComision,
    creadas: pedidos.filter((p) => enRango(diaDeArgentina(p.created_at), rango)).length,
    porMedio: [...porMedio.values()].sort((a, b) => b.cobrado - a.cobrado),
    porDia,
    masVendidos: [...vendidos.values()].sort((a, b) => b.facturado - a.facturado).slice(0, 6),
  };
}

/** Los pedidos hechos dentro del rango, del más nuevo al más viejo. */
export function comprasDelRango(pedidos: readonly PedidoDelTablero[], rango: Rango): PedidoDelTablero[] {
  return pedidos
    .filter((p) => enRango(diaDeArgentina(p.created_at), rango))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export interface GrupoDePedidos {
  cantidad: number;
  total: number;
  /** La fecha más vieja del grupo, para decir hace cuánto espera. */
  masViejo: string | null;
}

function agrupar(pedidos: readonly PedidoDelTablero[], fecha: (p: PedidoDelTablero) => string | null | undefined): GrupoDePedidos {
  let total = 0;
  let masViejo: string | null = null;
  for (const p of pedidos) {
    total += Number(p.total);
    const f = fecha(p) ?? null;
    if (f && (!masViejo || f < masViejo)) masViejo = f;
  }
  return { cantidad: pedidos.length, total, masViejo };
}

export interface PedidosEnCurso {
  esperandoTransferencia: GrupoDePedidos;
  esperandoMercadoPago: GrupoDePedidos;
  pagados: GrupoDePedidos;
  enPreparacion: GrupoDePedidos;
  enCamino: GrupoDePedidos;
  sinFactura: GrupoDePedidos;
}

/** Lo que está abierto ahora, sin importar el período. */
export function pedidosEnCurso(pedidos: readonly PedidoDelTablero[]): PedidosEnCurso {
  const pendientes = pedidos.filter((p) => p.status === "pendiente_pago");
  return {
    esperandoTransferencia: agrupar(pendientes.filter((p) => p.payment_method === "transferencia"), (p) => p.created_at),
    esperandoMercadoPago: agrupar(pendientes.filter((p) => p.payment_method !== "transferencia"), (p) => p.created_at),
    pagados: agrupar(pedidos.filter((p) => p.status === "pagado"), (p) => p.pagado_en ?? p.created_at),
    enPreparacion: agrupar(pedidos.filter((p) => p.status === "preparando"), (p) => p.preparando_en ?? p.pagado_en),
    enCamino: agrupar(pedidos.filter((p) => p.status === "enviado"), (p) => p.enviado_en),
    sinFactura: agrupar(pedidos.filter((p) => estaPagado(p.status) && !p.factura_path), (p) => p.pagado_en ?? p.created_at),
  };
}
