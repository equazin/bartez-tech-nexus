/**
 * Utilidades puras de pricing para Bundles/Kits.
 * El precio nunca es manual — siempre es la suma de los productos seleccionados
 * con el descuento del bundle aplicado.
 */

import type { BundleWithSlots, BundleSelection } from "@/models/bundle";

export interface BundlePriceResult {
  /** Suma de precios de los productos seleccionados, sin descuento. */
  subtotal: number;
  /** Monto ahorrado por el descuento del bundle. */
  discountAmount: number;
  /** Total final: subtotal − discountAmount. */
  total: number;
}

/**
 * Calcula el precio de un bundle dado el estado de selección actual.
 * @param bundle   Bundle con slots y opciones enriquecidas.
 * @param selection  Mapa slotId → productId de la selección del cliente.
 */
export function calculateBundlePrice(
  bundle: BundleWithSlots,
  selection: BundleSelection
): BundlePriceResult {
  let subtotal = 0;

  for (const slot of bundle.slots) {
    const selectedProductId = selection[slot.id];
    if (!selectedProductId) continue;

    const option = slot.options.find((o) => o.product_id === selectedProductId);
    if (!option) continue;

    subtotal += option.product.unit_price ?? option.product.cost_price ?? 0;
  }

  const discountAmount = subtotal * (bundle.discount_pct / 100);
  const total = subtotal - discountAmount;

  return { subtotal, discountAmount, total };
}

/**
 * Construye la selección default a partir de los slots:
 * usa la opción marcada como `is_default`, o la primera opción disponible.
 */
export function buildDefaultSelection(bundle: BundleWithSlots): BundleSelection {
  const selection: BundleSelection = {};

  for (const slot of bundle.slots) {
    if (slot.options.length === 0) continue;
    const defaultOpt = slot.options.find((o) => o.is_default) ?? slot.options[0];
    selection[slot.id] = defaultOpt.product_id;
  }

  return selection;
}

/**
 * Verifica si el bundle está disponible: todos los slots requeridos
 * tienen stock > 0 en la opción seleccionada.
 */
export function isBundleAvailable(
  bundle: BundleWithSlots,
  selection: BundleSelection
): boolean {
  return bundle.slots
    .filter((s) => s.required)
    .every((slot) => {
      const productId = selection[slot.id];
      if (!productId) return false;
      const opt = slot.options.find((o) => o.product_id === productId);
      return (opt?.product.stock ?? 0) > 0;
    });
}

/**
 * Retorna el precio calculado con la selección default.
 * Útil para mostrar el precio en cards sin necesidad de construir la selección manualmente.
 */
export function getBundleDefaultPrice(bundle: BundleWithSlots): BundlePriceResult {
  return calculateBundlePrice(bundle, buildDefaultSelection(bundle));
}

/**
 * Retorna una lista de los primeros N componentes de la selección default
 * para mostrar en la card (resumen).
 */
export function getBundleComponentSummary(
  bundle: BundleWithSlots,
  maxItems = 4
): { label: string; productName: string }[] {
  const selection = buildDefaultSelection(bundle);
  const items: { label: string; productName: string }[] = [];

  for (const slot of bundle.slots) {
    const productId = selection[slot.id];
    if (!productId) continue;
    const opt = slot.options.find((o) => o.product_id === productId);
    if (!opt) continue;
    items.push({ label: slot.label, productName: opt.product.name });
    if (items.length >= maxItems) break;
  }

  return items;
}
