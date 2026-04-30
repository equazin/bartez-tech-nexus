import * as React from "react";

import { useCurrency, type Currency } from "@/context/CurrencyContext";
import { cn } from "@/lib/utils";

export interface PriceTier {
  /** Lower bound (inclusive) of the tier */
  minQty: number;
  /** Upper bound (inclusive). Omit for last open-ended tier */
  maxQty?: number;
  /** Unit price for this tier */
  unitPrice: number;
  /** Optional source currency override (defaults to active currency) */
  from?: Currency;
}

interface TierTableProps extends React.HTMLAttributes<HTMLDivElement> {
  tiers: PriceTier[];
  /** Current quantity in cart — highlights matching tier */
  currentQty?: number;
  density?: "default" | "compact";
}

function formatRange(tier: PriceTier): string {
  if (typeof tier.maxQty === "number") {
    if (tier.minQty === tier.maxQty) return `${tier.minQty}`;
    return `${tier.minQty}–${tier.maxQty}`;
  }
  return `${tier.minQty}+`;
}

function isQtyInTier(qty: number, tier: PriceTier): boolean {
  if (qty < tier.minQty) return false;
  if (typeof tier.maxQty === "number" && qty > tier.maxQty) return false;
  return true;
}

const TierTable = React.forwardRef<HTMLDivElement, TierTableProps>(
  ({ tiers, currentQty, density = "default", className, ...props }, ref) => {
    const { formatPrice } = useCurrency();

    if (tiers.length === 0) return null;

    const rowPad = density === "compact" ? "px-2.5 py-1.5" : "px-3 py-2";
    const textSize = density === "compact" ? "text-[12px]" : "text-[13px]";

    return (
      <div
        ref={ref}
        className={cn("overflow-hidden rounded-xl border border-border/70 bg-card", className)}
        {...props}
      >
        <div className={cn("grid grid-cols-2 border-b border-border/70 bg-muted/30 portal-tabular", rowPad)}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cantidad</span>
          <span className="text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Precio unit.</span>
        </div>
        <div className="divide-y divide-border/60">
          {tiers.map((tier, index) => {
            const isActive = typeof currentQty === "number" && isQtyInTier(currentQty, tier);
            return (
              <div
                key={`${tier.minQty}-${tier.maxQty ?? "open"}-${index}`}
                className={cn(
                  "grid grid-cols-2 portal-tabular",
                  rowPad,
                  textSize,
                  isActive ? "bg-brand/10 font-semibold text-brand" : "text-foreground",
                )}
              >
                <span>{formatRange(tier)}</span>
                <span className="text-right">{formatPrice(tier.unitPrice, tier.from)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
TierTable.displayName = "TierTable";

export { TierTable };
