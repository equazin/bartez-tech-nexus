/**
 * Utilidades puras de pricing para Bundles/Kits.
 *
 * Reglas de precio:
 *  1. Base: SUM(product.cost_price * (1 + clientMargin/100)) — si el cliente tiene margen
 *     y el producto tiene cost_price. De lo contrario usa unit_price * quantity.
 *  2. Descuento:
 *     - discount_type = 'percentage': total * (1 - discount_pct/100)
 *     - discount_type = 'fixed':      fixed_price (override total, ignora cálculo)
 *     - discount_type = 'none':       sin descuento
 *  3. Precio individual = suma sin descuento (para mostrar "ahorro real").
 *  4. Slots opcionales omitidos no suman.
 */

import type { BundleWithSlots, BundleSelection } from "@/models/bundle";

export interface BundlePriceResult {
  /** Suma bruta de productos seleccionados (sin descuento). */
  subtotal: number;
  /** Monto total ahorrado (diferencia subtotal − total). */
  discountAmount: number;
  /** Porcentaje de ahorro sobre el subtotal (0-100). */
  savingsPct: number;
  /** Total final a pagar. */
  total: number;
}

/** Obtiene el precio base de una opción según margen del cliente. */
function resolveOptionPrice(
  option: BundleWithSlots["slots"][number]["options"][number],
  clientMargin: number,
): number {
  const qty = option.quantity ?? 1;
  const { cost_price, unit_price } = option.product;

  // Preferir cost_price + margen cuando disponible
  const base =
    cost_price != null && cost_price > 0
      ? cost_price * (1 + clientMargin / 100)
      : unit_price ?? 0;

  return base * qty;
}

/**
 * Calcula precio completo de un bundle dado selección actual y margen del cliente.
 *
 * @param bundle      Bundle con slots y opciones enriquecidas.
 * @param selection   Map slotId → productId | null (null = slot opcional omitido).
 * @param clientMargin Margen porcentual del cliente (ej: 20 = +20%). Default 0.
 */
export function calculateBundlePrice(
  bundle: BundleWithSlots,
  selection: BundleSelection,
  clientMargin = 0,
): BundlePriceResult {
  // Si tiene precio fijo manual → precio exacto sin cálculo
  if (bundle.discount_type === "fixed" && bundle.fixed_price != null && bundle.fixed_price > 0) {
    // Calculamos igual el subtotal para mostrar el ahorro
    let subtotal = 0;
    for (const slot of bundle.slots) {
      const selectedProductId = selection[slot.id];
      if (!selectedProductId) continue;
      const option = slot.options.find((o) => o.product_id === selectedProductId);
      if (!option) continue;
      subtotal += resolveOptionPrice(option, clientMargin);
    }
    const total = bundle.fixed_price;
    const discountAmount = Math.max(0, subtotal - total);
    const savingsPct = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
    return { subtotal, discountAmount, savingsPct, total };
  }

  // Cálculo normal: suma de opciones seleccionadas
  let subtotal = 0;
  for (const slot of bundle.slots) {
    const selectedProductId = selection[slot.id];
    if (!selectedProductId) continue; // omitido (null) o no seleccionado
    const option = slot.options.find((o) => o.product_id === selectedProductId);
    if (!option) continue;
    subtotal += resolveOptionPrice(option, clientMargin);
  }

  let discountAmount = 0;
  if (bundle.discount_type === "percentage" && bundle.discount_pct > 0) {
    discountAmount = subtotal * (bundle.discount_pct / 100);
  }
  // discount_type === 'none': sin descuento

  const total = subtotal - discountAmount;
  const savingsPct = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;

  return { subtotal, discountAmount, savingsPct, total };
}

/**
 * Construye la selección default:
 *  - Usa la opción marcada como `is_default`, o la primera disponible.
 *  - Slots opcionales sin stock aparecen como null.
 */
export function buildDefaultSelection(bundle: BundleWithSlots): BundleSelection {
  const selection: BundleSelection = {};

  for (const slot of bundle.slots) {
    if (slot.options.length === 0) {
      selection[slot.id] = null;
      continue;
    }
    // Preferir default marcado → primera con stock → primera
    const withStock = slot.options.filter((o) => o.product.stock > 0);
    const defaultOpt =
      slot.options.find((o) => o.is_default && o.product.stock > 0) ??
      withStock[0] ??
      slot.options[0];
    selection[slot.id] = defaultOpt.product_id;
  }

  return selection;
}

/**
 * Verifica disponibilidad: todos los slots REQUERIDOS tienen stock en la opción
 * seleccionada, y no fueron omitidos.
 */
export function isBundleAvailable(
  bundle: BundleWithSlots,
  selection: BundleSelection,
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

/** Precio con selección default. Útil para cards sin interacción. */
export function getBundleDefaultPrice(
  bundle: BundleWithSlots,
  clientMargin = 0,
): BundlePriceResult {
  return calculateBundlePrice(bundle, buildDefaultSelection(bundle), clientMargin);
}

/**
 * Resumen de los primeros N componentes del bundle (selección default).
 * Usado en la card del catálogo.
 */
export function getBundleComponentSummary(
  bundle: BundleWithSlots,
  maxItems = 4,
): { label: string; productName: string; quantity: number; optional: boolean }[] {
  const selection = buildDefaultSelection(bundle);
  const items: { label: string; productName: string; quantity: number; optional: boolean }[] = [];

  for (const slot of bundle.slots) {
    const productId = selection[slot.id];
    if (!productId) continue;
    const opt = slot.options.find((o) => o.product_id === productId);
    if (!opt) continue;
    items.push({
      label: slot.label,
      productName: opt.product.name,
      quantity: opt.quantity ?? 1,
      optional: opt.is_optional,
    });
    if (items.length >= maxItems) break;
  }

  return items;
}
