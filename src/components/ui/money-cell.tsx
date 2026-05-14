import * as React from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrency, type Currency } from "@/context/CurrencyContext";
import { cn } from "@/lib/utils";

interface MoneyCellProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  from?: Currency;
  emphasis?: "default" | "strong" | "muted";
  align?: "left" | "right";
  /** Show secondary value (the other currency) below in smaller text */
  showSecondary?: boolean;
  /** Show original value crossed out (for offers) */
  original?: number;
  /** Optional badge text shown after the price (e.g. "+ IVA", "neto") */
  hint?: string;
}

const emphasisClass: Record<NonNullable<MoneyCellProps["emphasis"]>, string> = {
  default: "text-foreground font-medium",
  strong: "text-foreground font-semibold",
  muted: "text-muted-foreground font-normal",
};

const MoneyCell = React.forwardRef<HTMLSpanElement, MoneyCellProps>(
  (
    {
      value,
      from,
      emphasis = "default",
      align = "left",
      showSecondary = false,
      original,
      hint,
      className,
      ...props
    },
    ref,
  ) => {
    const { formatPrice, formatUSD, formatARS, currency, exchangeRate } = useCurrency();

    const primary = formatPrice(value, from);
    const secondary = currency === "USD" ? formatARS(value, from) : formatUSD(value, from);
    const originalFormatted = typeof original === "number" ? formatPrice(original, from) : null;

    const tooltipText =
      currency === "USD"
        ? `${primary} · ${secondary} (TC ${exchangeRate.rate})`
        : `${primary} · ${secondary} (TC ${exchangeRate.rate})`;

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex flex-col portal-tabular",
          align === "right" ? "items-end text-right" : "items-start text-left",
          className,
        )}
        {...props}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn("inline-flex items-baseline gap-1.5", emphasisClass[emphasis])}>
                {originalFormatted ? (
                  <span className="text-[12px] font-normal text-muted-foreground line-through">{originalFormatted}</span>
                ) : null}
                <span className="text-[14px] leading-[20px]">{primary}</span>
                {hint ? <span className="text-[11px] font-normal text-muted-foreground">{hint}</span> : null}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {tooltipText}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {showSecondary ? <span className="text-[11px] leading-[14px] text-muted-foreground">{secondary}</span> : null}
      </span>
    );
  },
);
MoneyCell.displayName = "MoneyCell";

export { MoneyCell };
