import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * El detalle de una compra de la tienda en el panel, en pesos: qué se vendió y a qué proveedor se le compra, el costo
 * de cada producto, el costo del envío, la comisión de Mercado Pago y la ganancia bruta que queda. Solo para el panel:
 * el costo y el margen nunca salen por la API pública.
 */

interface LineaDeLaTienda {
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

export interface PedidoDeLaTiendaFila {
  id: string | number;
  order_number?: string | null;
  status: string;
  total: number;
  subtotal?: number | null;
  shipping_cost?: number | null;
  discount_amount?: number | null;
  payment_method?: string | null;
  comprador_nombre?: string | null;
  comprador_email?: string | null;
  comprador_telefono?: string | null;
  comprador_documento?: string | null;
  shipping_address?: string | null;
  envio_detalle?: { opcion?: string; sucursal?: string | null; transporte?: string | null; costo?: number | null; zipnova?: { precio_zipnova?: number } | null } | null;
  products: LineaDeLaTienda[];
}

interface PagoDelPedido {
  proveedor: string;
  estado: string;
  cuotas: number | null;
  detalle: { comision?: number | null; neto_recibido?: number | null } | null;
}

const IVA_GENERAL = 0.21;
const MEDIOS: Record<string, string> = { mercadopago: "Mercado Pago", transferencia: "Transferencia" };
const ESTADOS_DE_PAGO: Record<string, string> = {
  pendiente: "pendiente",
  aprobado: "acreditado",
  rechazado: "rechazado",
  cancelado: "cancelado",
  reintegrado: "reintegrado",
  vencido: "vencido",
};

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const fmt = (n: number) => pesos.format(Math.round(n));
const porcentaje = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

function costoDelEnvio(p: PedidoDeLaTiendaFila): { monto: number | null; origen: string } {
  const detalle = p.envio_detalle ?? null;
  if (typeof detalle?.costo === "number") return { monto: detalle.costo, origen: detalle.zipnova ? "cotización de Zipnova" : "tarifa del envío" };
  if (typeof detalle?.zipnova?.precio_zipnova === "number") return { monto: detalle.zipnova.precio_zipnova, origen: "cotización de Zipnova" };
  const cobrado = Number(p.shipping_cost ?? 0);
  // Pedidos anteriores sin el costo guardado: la tarifa cobrada es el costo, salvo con envío gratis (no se sabe).
  return cobrado > 0 ? { monto: cobrado, origen: "tarifa cobrada" } : { monto: null, origen: "sin dato" };
}

export function PedidoDeLaTienda({ pedido }: { pedido: PedidoDeLaTiendaFila }) {
  const [pago, setPago] = useState<PagoDelPedido | null>(null);
  const [proveedores, setProveedores] = useState<Map<number, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const lineas = useMemo(() => (Array.isArray(pedido.products) ? pedido.products : []), [pedido.products]);

  useEffect(() => {
    let cancelado = false;
    setError(null);
    setPago(null);
    const ids = lineas.filter((l) => typeof l.product_id === "number" && !l.proveedor).map((l) => l.product_id as number);
    Promise.all([
      supabase.from("pagos").select("proveedor, estado, cuotas, detalle").eq("order_id", Number(pedido.id)).order("id", { ascending: false }).limit(1),
      ids.length
        ? supabase.from("product_suppliers").select("product_id, suppliers(name)").in("product_id", ids).eq("is_preferred", true)
        : Promise.resolve({ data: [], error: null }),
    ])
      .then(([pagos, sup]) => {
        if (cancelado) return;
        if (pagos.error) throw new Error(pagos.error.message);
        if (sup.error) throw new Error(sup.error.message);
        setPago(((pagos.data ?? [])[0] as PagoDelPedido | undefined) ?? null);
        const mapa = new Map<number, string>();
        for (const fila of (sup.data ?? []) as Array<{ product_id: number; suppliers: { name: string } | Array<{ name: string }> | null }>) {
          const s = Array.isArray(fila.suppliers) ? fila.suppliers[0] : fila.suppliers;
          if (s?.name && !mapa.has(fila.product_id)) mapa.set(fila.product_id, s.name);
        }
        setProveedores(mapa);
      })
      .catch((e: unknown) => {
        if (!cancelado) setError(e instanceof Error ? e.message : "No se pudieron leer el pago y los proveedores.");
      });
    return () => {
      cancelado = true;
    };
  }, [pedido.id, lineas]);

  const cuentas = useMemo(() => {
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
    const comision = pedido.payment_method === "mercadopago" ? (pago?.detalle?.comision ?? null) : 0;

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
  }, [lineas, pedido, pago]);

  const medio = MEDIOS[pedido.payment_method ?? ""] ?? pedido.payment_method ?? "Sin dato";
  const estadoDelPago = pago ? (ESTADOS_DE_PAGO[pago.estado] ?? pago.estado) : null;
  const esMercadoPago = pedido.payment_method === "mercadopago";

  return (
    <div className="mb-5 space-y-4 text-sm">
      <div className="grid gap-3 rounded-xl border border-border bg-secondary/40 p-3 text-xs sm:grid-cols-2">
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Comprador</p>
          <p className="font-semibold text-foreground">{pedido.comprador_nombre ?? "Sin nombre"}</p>
          <p className="text-muted-foreground">{[pedido.comprador_email, pedido.comprador_telefono].filter(Boolean).join(" · ")}</p>
          {pedido.comprador_documento && <p className="text-muted-foreground">DNI/CUIT {pedido.comprador_documento}</p>}
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pago y envío</p>
          <p className="font-semibold text-foreground">
            {medio}
            {estadoDelPago ? ` · ${estadoDelPago}` : ""}
            {pago?.cuotas && pago.cuotas > 1 ? ` · ${pago.cuotas} cuotas` : ""}
          </p>
          <p className="text-muted-foreground">
            {pedido.envio_detalle?.opcion === "sucursal" ? `Retira en sucursal: ${pedido.envio_detalle.sucursal ?? "sin dato"}` : (pedido.shipping_address ?? "Sin dirección")}
          </p>
          {pedido.envio_detalle?.transporte && <p className="text-muted-foreground">Transporte: {pedido.envio_detalle.transporte}</p>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="pb-2 font-medium">Producto</th>
              <th className="pb-2 font-medium">Proveedor</th>
              <th className="pb-2 text-center font-medium">Cant.</th>
              <th className="pb-2 text-right font-medium">Costo c/IVA</th>
              <th className="pb-2 text-right font-medium">Precio c/IVA</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => {
              const iva = Number(l.iva_rate ?? 21) / 100;
              const costo = l.cost_price !== null && l.cost_price !== undefined && Number(l.cost_price) > 0 ? Number(l.cost_price) * (1 + iva) * l.quantity : null;
              const precio = (l.precio_final ?? Number(l.unit_price) * (1 + iva)) * l.quantity;
              const proveedor = l.servicio_id ? "Servicio de Teqo" : (l.proveedor ?? (l.product_id ? proveedores.get(l.product_id) : undefined) ?? "Sin proveedor");
              return (
                <tr key={`${l.product_id ?? l.servicio_id ?? "l"}-${i}`} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-2 text-foreground">
                    {l.name}
                    {l.sku ? <span className="block text-[10px] text-muted-foreground">SKU {l.sku}</span> : null}
                  </td>
                  <td className="py-2 pr-2 text-muted-foreground">{proveedor}</td>
                  <td className="py-2 text-center text-muted-foreground">{l.quantity}</td>
                  <td className="py-2 text-right tabular-nums text-foreground">{costo === null ? "Sin costo" : fmt(costo)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-foreground">{fmt(precio)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Cuentas de la compra</th>
              <th className="px-3 py-2 text-right font-medium">Con IVA</th>
              <th className="px-3 py-2 text-right font-medium">Sin IVA</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            <tr className="border-b border-border/60">
              <td className="px-3 py-2 text-foreground">
                Cobrado al cliente
                {Number(pedido.shipping_cost ?? 0) > 0 || Number(pedido.discount_amount ?? 0) > 0 ? (
                  <span className="block text-[10px] text-muted-foreground">
                    {[
                      Number(pedido.shipping_cost ?? 0) > 0 ? `envío ${fmt(Number(pedido.shipping_cost))}` : null,
                      Number(pedido.discount_amount ?? 0) > 0 ? `descuento ${fmt(Number(pedido.discount_amount))}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-foreground">{fmt(cuentas.cobrado)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{fmt(cuentas.cobradoNeto)}</td>
            </tr>
            <tr className="border-b border-border/60">
              <td className="px-3 py-2 text-foreground">
                Costo de los productos
                {cuentas.sinCosto > 0 && <span className="block text-[10px] text-muted-foreground">{cuentas.sinCosto} línea(s) sin costo cargado</span>}
              </td>
              <td className="px-3 py-2 text-right text-foreground">−{fmt(cuentas.costoConIva)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">−{fmt(cuentas.costoNeto)}</td>
            </tr>
            <tr className="border-b border-border/60">
              <td className="px-3 py-2 text-foreground">
                Costo del envío
                <span className="block text-[10px] text-muted-foreground">{cuentas.envio.origen}</span>
              </td>
              <td className="px-3 py-2 text-right text-foreground">{cuentas.envio.monto === null ? "Sin dato" : `−${fmt(cuentas.envio.monto)}`}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{cuentas.envio.monto === null ? "" : `−${fmt(cuentas.envio.monto / (1 + IVA_GENERAL))}`}</td>
            </tr>
            {esMercadoPago && (
              <tr className="border-b border-border/60">
                <td className="px-3 py-2 text-foreground">
                  Comisión de Mercado Pago
                  <span className="block text-[10px] text-muted-foreground">
                    {cuentas.comision === null ? "Se ve cuando se acredita el pago" : "la que informó Mercado Pago, con las cuotas sin interés"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-foreground">{cuentas.comision === null ? "Pendiente" : `−${fmt(cuentas.comision)}`}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{cuentas.comision === null ? "" : `−${fmt(cuentas.comision / (1 + IVA_GENERAL))}`}</td>
              </tr>
            )}
            <tr>
              <td className="px-3 py-2.5 font-bold text-foreground">
                Ganancia bruta
                {cuentas.margen !== null && <span className="block text-[10px] font-normal text-muted-foreground">{porcentaje.format(cuentas.margen)} % de lo cobrado sin IVA</span>}
                {esMercadoPago && cuentas.comision === null && <span className="block text-[10px] font-normal text-muted-foreground">antes de la comisión de Mercado Pago</span>}
              </td>
              <td className={`px-3 py-2.5 text-right font-bold ${cuentas.gananciaConIva < 0 ? "text-danger" : "text-foreground"}`}>{fmt(cuentas.gananciaConIva)}</td>
              <td className={`px-3 py-2.5 text-right font-bold ${cuentas.gananciaNeta < 0 ? "text-danger" : "text-foreground"}`}>{fmt(cuentas.gananciaNeta)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        La ganancia sin IVA es la que queda después de pagar el IVA de la diferencia. No descuenta Ingresos Brutos ni Ganancias. El costo de cada producto
        se guardó con el dólar del día de la compra{lineas[0]?.dolar ? ` ($ ${Number(lineas[0].dolar).toLocaleString("es-AR")})` : ""}.
      </p>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
