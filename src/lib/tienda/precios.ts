import type { PrecioPorMedio, ProductoPublico } from "./catalogo";

/**
 * El precio de cada producto según el medio de pago. La vista pública ya trae los precios con
 * el recargo de cada medio activo (transferencia y Mercado Pago, configurables en el panel);
 * acá solo se leen y se nombran. El checkout del servidor vuelve a calcularlos al cobrar.
 */

/** El medio con cuotas: sus precios llevan el detalle de cuotas de Mercado Pago. */
export const MEDIO_CON_CUOTAS = "mercadopago";

const NOMBRES_CORTOS: Record<string, string> = {
  transferencia: "Transferencia",
  mercadopago: "Mercado Pago",
};

export function nombreCortoDeMedio(medio: Pick<PrecioPorMedio, "id" | "nombre">): string {
  return NOMBRES_CORTOS[medio.id] ?? medio.nombre;
}

type ConPrecios = Pick<ProductoPublico, "precio_final_ars" | "precios_por_medio">;

/** Los precios por medio, del más barato al más caro. Sin datos de medios, el precio final solo. */
export function preciosDe(producto: ConPrecios): PrecioPorMedio[] {
  const lista = (producto.precios_por_medio ?? []).filter((m) => m && typeof m.id === "string");
  if (lista.length > 0) return lista.map((m) => ({ ...m, precio: m.precio === null ? null : Number(m.precio), recargo: Number(m.recargo ?? 0) }));
  return [{ id: "contado", nombre: "Precio final", recargo: 0, precio: producto.precio_final_ars }];
}

/** El precio del producto pagando con ese medio; si el medio no está, el precio final. */
export function precioConMedio(producto: ConPrecios, medio: string): number | null {
  const encontrado = preciosDe(producto).find((m) => m.id === medio);
  return encontrado ? encontrado.precio : producto.precio_final_ars;
}
