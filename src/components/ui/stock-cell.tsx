import * as React from "react";

import { StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";

interface StockCellProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Total available stock for the client */
  available: number;
  /** Reserved stock (in pending orders) — optional */
  reserved?: number;
  /** ETA in days for restock if available <= 0 */
  etaDays?: number;
  /** Threshold below which stock is "low" — defaults to 10 */
  lowThreshold?: number;
  align?: "left" | "right";
  density?: "compact" | "default";
}

function getTone(available: number, lowThreshold: number): "success" | "warning" | "danger" {
  if (available <= 0) return "danger";
  if (available <= lowThreshold) return "warning";
  return "success";
}

const StockCell = React.forwardRef<HTMLSpanElement, StockCellProps>(
  (
    {
      available,
      reserved,
      etaDays,
      lowThreshold = 10,
      align = "left",
      density = "default",
      className,
      ...props
    },
    ref,
  ) => {
    const tone = getTone(available, lowThreshold);
    const isOut = available <= 0;

    const primaryLabel = isOut
      ? etaDays
        ? `Sin stock · ETA ${etaDays}d`
        : "Sin stock"
      : `${available} disp.`;

    const reservedLabel =
      typeof reserved === "number" && reserved > 0 ? `${reserved} res.` : null;

    if (density === "compact") {
      return (
        <span
          ref={ref}
          className={cn(
            "inline-flex items-center gap-1.5 portal-tabular",
            align === "right" ? "justify-end" : "justify-start",
            className,
          )}
          {...props}
        >
          <StatusDot tone={tone} size="sm" />
          <span className="text-[13px] leading-[18px] text-foreground">{primaryLabel}</span>
        </span>
      );
    }

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex flex-col portal-tabular",
          align === "right" ? "items-end" : "items-start",
          className,
        )}
        {...props}
      >
        <span className="inline-flex items-center gap-1.5">
          <StatusDot tone={tone} size="sm" />
          <span className="text-[13px] leading-[18px] font-medium text-foreground">{primaryLabel}</span>
        </span>
        {reservedLabel || (isOut && etaDays) ? (
          <span className="text-[11px] leading-[14px] text-muted-foreground">
            {reservedLabel}
          </span>
        ) : null}
      </span>
    );
  },
);
StockCell.displayName = "StockCell";

export { StockCell };
