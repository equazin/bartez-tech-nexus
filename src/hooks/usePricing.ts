import { useCallback } from "react";
import { usePricingRules } from "@/hooks/usePricingRules";
import { resolveMarginWithContext } from "@/lib/pricingEngine";
import { getUnitPrice, getEffectiveCostPrice } from "@/lib/pricing";
import type { Product } from "@/models/products";
import type { UserProfile } from "@/lib/supabase";

export interface PriceResult {
  /** Costo base del proveedor (sin multiplicador) — para mostrar al admin */
  cost: number;
  /** Costo efectivo = cost × supplier_multiplier — base real del precio de venta */
  effectiveCost: number;
  /** Effective margin % after all rules */
  margin: number;
  /** Unit sell price sin IVA */
  unitPrice: number;
  /** Subtotal sin IVA (unitPrice × qty) */
  totalPrice: number;
  ivaRate: number;
  ivaAmount: number;
  /** Total con IVA */
  totalWithIVA: number;
  isVolumePricing: boolean;
}

/**
 * Single source-of-truth pricing hook.
 * All components that compute sell prices should call `computePrice(product, quantity)`
 * instead of duplicating the resolveMarginWithContext + getUnitPrice logic inline.
 *
 * Usage:
 *   const { computePrice } = usePricing(profile);
 *   const price = computePrice(product, 10);
 */
export function usePricing(profile: UserProfile | null, baseMarginOverride?: number) {
  const { rules } = usePricingRules();
  const globalMargin = baseMarginOverride ?? profile?.default_margin ?? 20;

  const computePrice = useCallback(
    (product: Product, quantity: number): PriceResult => {
      const { margin, isVolumePricing } = resolveMarginWithContext(
        product,
        rules,
        globalMargin,
        profile?.id,
        quantity
      );
      const cost         = getUnitPrice(product, quantity);
      const effectiveCost = getEffectiveCostPrice(product, quantity);
      const unitPrice    = effectiveCost * (1 + margin / 100);
      const totalPrice = unitPrice * quantity;
      const ivaRate    = product.iva_rate ?? 21;
      const ivaAmount  = totalPrice * (ivaRate / 100);

      return {
        cost,
        effectiveCost,
        margin,
        unitPrice,
        totalPrice,
        ivaRate,
        ivaAmount,
        totalWithIVA: totalPrice + ivaAmount,
        isVolumePricing,
      };
    },
    [rules, globalMargin, profile?.id]
  );

  /**
   * Build the product rows array expected by generateQuotePDF.
   * Use this wherever a PDF is exported so prices are always consistent
   * with the cart calculation.
   */
  const toPDFProducts = useCallback(
    (
      items: Array<{ product: Product; quantity: number; margin?: number }>,
      convertPrice: (n: number) => number
    ) => {
      return items.map(({ product, quantity, margin: overrideMargin }) => {
        const base = computePrice(product, quantity);
        const actualMargin  = overrideMargin ?? base.margin;
        const cost          = getUnitPrice(product, quantity);
        const effectiveCost = getEffectiveCostPrice(product, quantity);
        const unitPrice     = effectiveCost * (1 + actualMargin / 100);
        const totalPriceRaw = unitPrice * quantity;
        const ivaRate = product.iva_rate ?? 21;
        const ivaAmountRaw = totalPriceRaw * (ivaRate / 100);
        const totalWithIVARaw = totalPriceRaw + ivaAmountRaw;

        return {
          name:         product.name,
          quantity,
          price:        Number(convertPrice(unitPrice).toFixed(2)),
          total:        Number(convertPrice(totalPriceRaw).toFixed(2)),
          ivaRate,
          ivaAmount:    Number(convertPrice(ivaAmountRaw).toFixed(2)),
          totalWithIVA: Number(convertPrice(totalWithIVARaw).toFixed(2)),
          margin:       actualMargin,
          cost:         Number(convertPrice(cost).toFixed(2)),
          effectiveCost: Number(convertPrice(effectiveCost).toFixed(2)),
        };
      });
    },
    [computePrice]
  );

  return { computePrice, toPDFProducts, rules };
}
