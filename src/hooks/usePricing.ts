import { useCallback, useEffect, useState } from "react";
import { usePricingRules } from "@/hooks/usePricingRules";
import { resolveMarginWithContext } from "@/lib/pricingEngine";
import { getUnitPrice, getEffectiveCostPrice } from "@/lib/pricing";
import { calculatePerception, type ProvinceCode } from "@/lib/api/iibb";
import type { Product } from "@/models/products";
import type { UserProfile } from "@/lib/supabase";
import { useCurrency } from "@/context/CurrencyContext";
import { supabase } from "@/lib/supabase";
import type { PriceAgreement } from "@/hooks/usePriceAgreements";

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
  /** Unit price before any product-level offers (special_price or offer_percent) */
  originalUnitPrice: number;
  /** Whether a product-level offer is being applied */
  isOffer: boolean;
  /** Percentage discount of the offer (relative to originalUnitPrice) */
  calculatedOfferPercent: number;
}

interface CustomPrice { product_id: number; custom_price: number; currency: string }
interface AgreementItem { product_id: number; fixed_price_usd: number | null; margin_pct: number | null }

/**
 * Single source-of-truth pricing hook.
 * Priority: client_custom_prices > price_agreement_items > price_agreement (margin) > pricing_rules > default_margin
 */
export function usePricing(profile: UserProfile | null, baseMarginOverride?: number) {
  const { rules } = usePricingRules();
  const { exchangeRate } = useCurrency();
  const globalMargin = baseMarginOverride ?? profile?.default_margin ?? 20;

  const [customPrices, setCustomPrices] = useState<Record<number, CustomPrice>>({});

  // Active price agreement for this client
  const [activeAgreement, setActiveAgreement] = useState<PriceAgreement | null>(null);
  const [agreementItems, setAgreementItems] = useState<Record<number, AgreementItem>>({});

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

  // Load active price agreement via RPC, then load its per-SKU items
  useEffect(() => {
    if (!profile?.id) { setActiveAgreement(null); setAgreementItems({}); return; }
    supabase
      .rpc("get_active_price_agreement", { p_client_id: profile.id })
      .then(({ data }) => {
        if (!data || (data as unknown[]).length === 0) { setActiveAgreement(null); setAgreementItems({}); return; }
        const row = (data as Record<string, unknown>[])[0];
        setActiveAgreement({
          id: Number(row.agreement_id),
          client_id: profile.id,
          name: String(row.name ?? ""),
          margin_pct: row.margin_pct != null ? Number(row.margin_pct) : null,
          discount_pct: Number(row.discount_pct ?? 0),
          price_list: (row.price_list as PriceAgreement["price_list"]) ?? "mayorista",
          valid_from: String(row.valid_from ?? ""),
          valid_until: row.valid_until != null ? String(row.valid_until) : null,
          active: true,
          notes: null,
          created_at: "",
          updated_at: "",
        });

        // Load per-SKU overrides
        supabase
          .from("price_agreement_items")
          .select("product_id, fixed_price_usd, margin_pct")
          .eq("agreement_id", Number(row.agreement_id))
          .then(({ data: items }) => {
            if (!items) return;
            const map: Record<number, AgreementItem> = {};
            for (const item of items as AgreementItem[]) map[item.product_id] = item;
            setAgreementItems(map);
          });
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
          originalUnitPrice: unitPriceARS, isOffer: false,
          calculatedOfferPercent: 0,
        };
      }

      // ── Priority 1.5: per-SKU agreement item fixed price ──────────────────
      const agItem = agreementItems[product.id];
      if (agItem?.fixed_price_usd != null) {
        const unitPriceARS = agItem.fixed_price_usd * exchangeRate.rate;
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
          originalUnitPrice: unitPriceARS, isOffer: false,
          calculatedOfferPercent: 0,
        };
      }

      // ── Priority 2: pricing rules + agreement margin OR default margin ─────
      const cost_base          = getUnitPrice(product, quantity);
      const effective_cost_base = getEffectiveCostPrice(product, quantity);

      // Agreement margin: per-item override > agreement-level override > default
      const agreementMargin = agItem?.margin_pct != null
        ? agItem.margin_pct
        : activeAgreement?.margin_pct ?? null;
      const baseMarginForProduct = agreementMargin ?? globalMargin;

      const { margin, isVolumePricing } = resolveMarginWithContext(
        product, rules, baseMarginForProduct, profile?.id, quantity
      );

      // Apply extra agreement discount on top
      const discountMultiplier = activeAgreement ? (1 - (activeAgreement.discount_pct / 100)) : 1;
      const originalUnitPrice = ((cost_base !== undefined && cost_base !== null)
        ? effective_cost_base * (1 + margin / 100)
        : (product.unit_price ?? 0)) * discountMultiplier;

      // ── Priority 3: Product-level Offer (special_price or offer_percent) ──
      // These apply ON TOP of the calculated price (lowest wins or offer takes precedence)
      let unitPrice = originalUnitPrice;
      let isOffer = false;
      let calculatedOfferPercent = 0;

      // Special Price: specific fixed offer price
      if (product.special_price) {
        // Assume special_price is in USD and needs conversion to ARS
        const specialPriceARS = product.special_price * exchangeRate.rate;
        if (specialPriceARS < unitPrice && unitPrice > 0) {
          calculatedOfferPercent = ((unitPrice - specialPriceARS) / unitPrice) * 100;
          unitPrice = specialPriceARS;
          isOffer = true;
        }
      } 
      
      // Offer Percent: specific % discount from calculated price
      if (product.offer_percent && product.offer_percent > 0) {
        const offerPriceARS = unitPrice * (1 - product.offer_percent / 100);
        if (offerPriceARS < unitPrice && unitPrice > 0) {
          calculatedOfferPercent = calculatedOfferPercent > 0 
            ? ((originalUnitPrice - offerPriceARS) / originalUnitPrice) * 100
            : product.offer_percent;
          unitPrice = offerPriceARS;
          isOffer = true;
        }
      }

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
        isVolumePricing, isCustomPrice: activeAgreement != null,
        originalUnitPrice, isOffer, calculatedOfferPercent
      };
    },
    [rules, globalMargin, profile?.id, exchangeRate.rate, customPrices, activeAgreement, agreementItems]
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

  return { computePrice, toPDFProducts, rules, customPrices, activeAgreement };
}
