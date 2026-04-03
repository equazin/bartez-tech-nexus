import { useCallback, useEffect, useState } from "react";
import { usePricingRules } from "@/hooks/usePricingRules";
import { resolveMarginWithContext } from "@/lib/pricingEngine";
import { getUnitPrice, getEffectiveCostPrice } from "@/lib/pricing";
import { calculatePerception, type ProvinceCode } from "@/lib/api/iibb";
import type { Product } from "@/models/products";
import type { UserProfile } from "@/lib/supabase";
import { useCurrency } from "@/context/CurrencyContext";
import { supabase } from "@/lib/supabase";

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
  /** IIBB Perception amount (specific to Argentina) */
  iibbAmount: number;
  /** Final total including IVA and IIBB */
  grandTotal: number;
  isVolumePricing: boolean;
  /** True when price comes from a client-specific agreement */
  isCustomPrice: boolean;
}

interface CustomPrice { product_id: number; custom_price: number; currency: string }

/**
 * Single source-of-truth pricing hook.
 * Priority: client_custom_prices > pricing_rules > default_margin
 */
export function usePricing(profile: UserProfile | null, baseMarginOverride?: number) {
  const { rules } = usePricingRules();
  const { exchangeRate } = useCurrency();
  const globalMargin = baseMarginOverride ?? profile?.default_margin ?? 20;

  const [customPrices, setCustomPrices] = useState<Record<number, CustomPrice>>({});

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from("client_custom_prices")
      .select("product_id, custom_price, currency")
      .eq("client_id", profile.id)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<number, CustomPrice> = {};
        for (const row of data as CustomPrice[]) map[row.product_id] = row;
        setCustomPrices(map);
      });
  }, [profile?.id]);

  const computePrice = useCallback(
    (product: Product, quantity: number): PriceResult => {
      const ivaRate = product.iva_rate ?? 21;

      // ── Priority 1: client-specific pactado price ──────────────────────────
      const pactado = customPrices[product.id];
      if (pactado) {
        // Convert to ARS if the pactado is in USD
        const unitPriceARS = pactado.currency === "USD"
          ? pactado.custom_price * exchangeRate.rate
          : pactado.custom_price;
        const totalPrice   = unitPriceARS * quantity;
        const ivaAmount    = totalPrice * (ivaRate / 100);
        const totalWithIVA = totalPrice + ivaAmount;
        const province = (profile as any)?.provincia || (profile as any)?.iibb_province;
        const iibbAmount = province
          ? calculatePerception(totalPrice, province as ProvinceCode, (profile as any)?.iibb_aliquot)
          : 0;
        return {
          cost: unitPriceARS, effectiveCost: unitPriceARS, margin: 0,
          unitPrice: unitPriceARS, totalPrice, ivaRate, ivaAmount, totalWithIVA,
          iibbAmount, grandTotal: totalWithIVA + iibbAmount,
          isVolumePricing: false, isCustomPrice: true,
        };
      }

      // ── Priority 2: pricing rules + default margin ─────────────────────────
      const cost_base          = getUnitPrice(product, quantity);
      const effective_cost_base = getEffectiveCostPrice(product, quantity);
      const { margin, isVolumePricing } = resolveMarginWithContext(
        product, rules, globalMargin, profile?.id, quantity
      );
      const unitPrice    = (cost_base !== undefined && cost_base !== null)
        ? effective_cost_base * (1 + margin / 100)
        : (product.unit_price ?? 0);
      const totalPrice   = unitPrice * quantity;
      const ivaAmount    = totalPrice * (ivaRate / 100);
      const totalWithIVA = totalPrice + ivaAmount;
      const province = (profile as any)?.provincia || (profile as any)?.iibb_province;
      const iibbAmount = province
        ? calculatePerception(totalPrice, province as ProvinceCode, (profile as any)?.iibb_aliquot)
        : 0;
      return {
        cost: cost_base ?? 0, effectiveCost: effective_cost_base ?? 0, margin,
        unitPrice, totalPrice, ivaRate, ivaAmount, totalWithIVA,
        iibbAmount, grandTotal: totalWithIVA + iibbAmount,
        isVolumePricing, isCustomPrice: false,
      };
    },
    [rules, globalMargin, profile?.id, exchangeRate.rate, customPrices]
  );

  const toPDFProducts = useCallback(
    (
      items: Array<{ product: Product; quantity: number; margin?: number }>,
      convertPrice: (n: number) => number
    ) => {
      return items.map(({ product, quantity, margin: overrideMargin }) => {
        const base = computePrice(product, quantity);
        const actualMargin   = overrideMargin ?? base.margin;
        const cost           = getUnitPrice(product, quantity);
        const effectiveCost  = getEffectiveCostPrice(product, quantity);
        const unitPrice      = base.isCustomPrice ? base.unitPrice : effectiveCost * (1 + actualMargin / 100);
        const totalPriceRaw  = unitPrice * quantity;
        const ivaRate        = product.iva_rate ?? 21;
        const ivaAmountRaw   = totalPriceRaw * (ivaRate / 100);
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

  return { computePrice, toPDFProducts, rules, customPrices };
}
