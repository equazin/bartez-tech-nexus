import { cn } from "@/lib/utils";

export interface CheckoutSummaryProps {
  cartItemCount: number;
  totalUnits: number;
  totalWeightKg: number;
  subtotal: number;
  ivaTotal: number;
  discountAmount?: number;
  discountLabel?: string;
  surchargePercent: number;
  surchargeAmount: number;
  shippingCost: number;
  shippingType: "retiro" | "envio";
  shippingLabel: string;
  freeShippingApplied: boolean;
  grandTotal: number;
  paymentLabel: string;
  creditAvailableDisplay: string | null;
  projectedCreditDisplay: string | null;
  projectedCreditLow: boolean;
  exchangeRate: number;
  currency: "ARS" | "USD";
  formatPrice: (n: number) => string;
  formatARS: (n: number) => string;
  formatUSD: (n: number) => string;
  isDark: boolean;
  shippingETA?: string;
}

export function CheckoutSummary({
  cartItemCount,
  totalUnits,
  totalWeightKg,
  subtotal,
  ivaTotal,
  discountAmount = 0,
  discountLabel,
  surchargePercent,
  surchargeAmount,
  shippingCost,
  shippingType,
  shippingLabel,
  freeShippingApplied,
  grandTotal,
  paymentLabel,
  creditAvailableDisplay,
  projectedCreditDisplay,
  projectedCreditLow,
  exchangeRate,
  currency,
  formatPrice,
  formatARS,
  formatUSD,
  isDark,
  shippingETA,
}: CheckoutSummaryProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  if (cartItemCount === 0) {
    return (
      <div className={`rounded-xl border px-4 py-8 text-center ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
        <p className="text-sm text-muted-foreground">Agrega productos para ver el resumen</p>
      </div>
    );
  }

  return (
    <div className={`sticky top-[57px] overflow-hidden rounded-xl border ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
      <div className={`border-b px-4 py-2.5 ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Resumen del pedido</span>
      </div>

      <div className="space-y-2 px-4 py-4">
        <Row label="Subtotal s/IVA" value={formatPrice(subtotal)} isDark={isDark} />
        <Row label="Impuestos (IVA)" value={`+ ${formatPrice(ivaTotal)}`} isDark={isDark} />
        {discountAmount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-600">{discountLabel ?? "Descuento"}</span>
            <span className="text-xs font-semibold text-emerald-600 tabular-nums">- {formatPrice(discountAmount)}</span>
          </div>
        )}

        <div className={`my-3 border-b border-dashed ${dk("border-[#333]", "border-[#d4d4d4]")}`} />

        {surchargePercent > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-400">
              Recargo pago {surchargePercent.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
            </span>
            <span className="text-xs font-semibold text-amber-400 tabular-nums">
              + {formatPrice(surchargeAmount)}
            </span>
          </div>
        )}

        {shippingType === "envio" && freeShippingApplied && (
          <Row label="Envio" value="Bonificado" isDark={isDark} />
        )}

        {shippingType === "envio" && !freeShippingApplied && shippingCost > 0 && (
          <Row label="Envio" value={`+ ${formatPrice(shippingCost)}`} isDark={isDark} />
        )}

        <Row label="Unidades / peso" value={`${totalUnits} u - ${totalWeightKg.toFixed(1)} kg`} isDark={isDark} />

        {creditAvailableDisplay && (
          <>
            <Row label="Credito disponible" value={creditAvailableDisplay} isDark={isDark} />
            {projectedCreditDisplay && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Disponible post pedido</span>
                <span className={cn("text-xs font-semibold tabular-nums", projectedCreditLow ? "text-red-400" : dk("text-gray-300", "text-[#525252]"))}>
                  {projectedCreditDisplay}
                </span>
              </div>
            )}
          </>
        )}

        <Row label="Pago" value={paymentLabel} isDark={isDark} />
        <Row label="Logistica" value={shippingType === "envio" ? shippingLabel : "Retiro"} isDark={isDark} />

        {shippingType === "envio" && shippingETA && (
          <Row label="ETA estimado" value={shippingETA} isDark={isDark} />
        )}

        <div className={`mt-4 flex items-start justify-between rounded-xl border p-4 ${dk("bg-[#0f241a] border-[#183a28]", "bg-[#eaf5ef] border-[#d4ebd8]")}`}>
          <div>
            <p className={`text-[13px] font-black tracking-wide ${dk("text-white", "text-[#102d1f]")}`}>TOTAL FINAL</p>
            <p className={`mt-0.5 text-[10px] font-mono ${dk("text-[#7de3ad]", "text-[#25835a]")}`}>
              @ {exchangeRate.toLocaleString("es-AR")} ARS/USD
            </p>
          </div>
          <div className="text-right">
            <p className="text-[22px] font-black leading-none tabular-nums text-[#2D9F6A]">
              {formatPrice(grandTotal)}
            </p>
            <p className={`mt-1 text-[11px] font-mono ${dk("text-[#7de3ad]/80", "text-[#25835a]/80")}`}>
              {currency === "USD" ? formatARS(grandTotal) : formatUSD(grandTotal)}
            </p>
          </div>
        </div>
      </div>

      <div className={`flex items-center justify-between border-t px-4 py-2 ${dk("border-[#1a1a1a] bg-[#0a0a0a]", "border-[#e5e5e5] bg-[#f9f9f9]")}`}>
        <span className="text-[10px] text-gray-600">
          Moneda: <span className="font-bold text-gray-500">{currency}</span>
        </span>
        <span className="text-[10px] font-mono text-gray-700">
          1 USD = {exchangeRate.toLocaleString("es-AR")} ARS
        </span>
      </div>
    </div>
  );
}

function Row({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-semibold ${dk("text-gray-300", "text-[#525252]")}`}>{value}</span>
    </div>
  );
}
