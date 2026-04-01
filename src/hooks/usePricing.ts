import { useCallback } from "react";
import { usePricingRules } from "@/hooks/usePricingRules";
import { resolveMarginWithContext } from "@/lib/pricingEngine";
import { getUnitPrice, getEffectiveCostPrice } from "@/lib/pricing";
import type { Product } from "@/models/products";
import type { UserProfile } from "@/lib/supabase";
import { useCurrency } from "@/context/CurrencyContext";

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
  const { exchangeRate } = useCurrency();
  const globalMargin = baseMarginOverride ?? profile?.default_margin ?? 20;

  const computePrice = useCallback(
    (product: Product, quantity: number): PriceResult => {
      // 1. Determine base cost (normalize to USD if it's ARS)
      let cost_base = getUnitPrice(product, quantity);
      let effective_cost_base = getEffectiveCostPrice(product, quantity);

      // If the product cost is in ARS, convert to USD base for internal calculations
      if (product.cost_currency === "ARS" && exchangeRate.rate > 0) {
        cost_base = cost_base / exchangeRate.rate;
        effective_cost_base = effective_cost_base / exchangeRate.rate;
      }

      // 2. Resolve margin
      const { margin, isVolumePricing } = resolveMarginWithContext(
        product,
        rules,
        globalMargin,
        profile?.id,
        quantity
      );

      // 3. Compute final unit price
      // If cost_price is missing (Client Portal View), use pre-calculated unit_price
      const unitPrice = (cost_base !== undefined && cost_base !== null)
        ? effective_cost_base * (1 + margin / 100)
        : (product.unit_price ?? 0);

      const totalPrice = unitPrice * quantity;
      const ivaRate    = product.iva_rate ?? 21;
      const ivaAmount  = totalPrice * (ivaRate / 100);

      return {
        cost: cost_base ?? 0,
        effectiveCost: effective_cost_base ?? 0,
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
