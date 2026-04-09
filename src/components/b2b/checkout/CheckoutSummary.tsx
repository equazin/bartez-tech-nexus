import { cn } from "@/lib/utils";

export interface CheckoutSummaryProps {
  cartItemCount: number;
  totalUnits: number;
  totalWeightKg: number;
  subtotal: number;
  ivaTotal: number;
  surchargePercent: number;
  surchargeAmount: number;
  shippingCost: number;
  shippingType: "retiro" | "envio";
  shippingLabel: string;
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
  surchargePercent,
  surchargeAmount,
  shippingCost,
  shippingType,
  shippingLabel,
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
        <p className="text-sm text-muted-foreground">Agregá productos para ver el resumen</p>
      </div>
    );
  }

  return (
    <div className={`sticky top-[57px] border rounded-xl overflow-hidden ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
      {/* Header */}
      <div className={`px-4 py-2.5 border-b ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Resumen del pedido</span>
      </div>

      {/* Rows */}
      <div className="px-4 py-4 space-y-2">
        <Row label="Subtotal s/IVA" value={formatPrice(subtotal)} isDark={isDark} />
        <Row label="Impuestos (IVA)" value={`+ ${formatPrice(ivaTotal)}`} isDark={isDark} />

        <div className={`my-3 border-b border-dashed ${dk("border-[#333]", "border-[#d4d4d4]")}`} />

        {surchargePercent > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-amber-400">
              Recargo pago {surchargePercent.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
            </span>
            <span className="text-xs font-semibold text-amber-400 tabular-nums">
              + {formatPrice(surchargeAmount)}
            </span>
          </div>
        )}

        {shippingType === "envio" && shippingCost > 0 && (
          <Row label="Envío" value={`+ ${formatPrice(shippingCost)}`} isDark={isDark} />
        )}

        <Row label="Unidades / peso" value={`${totalUnits} u - ${totalWeightKg.toFixed(1)} kg`} isDark={isDark} />

        {creditAvailableDisplay && (
          <>
            <Row label="Crédito disponible" value={creditAvailableDisplay} isDark={isDark} />
            {projectedCreditDisplay && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Disponible post pedido</span>
                <span className={cn("text-xs font-semibold tabular-nums", projectedCreditLow ? "text-red-400" : dk("text-gray-300", "text-[#525252]"))}>
                  {projectedCreditDisplay}
                </span>
              </div>
            )}
          </>
        )}

        <Row label="Pago" value={paymentLabel} isDark={isDark} />
        <Row label="Logística" value={shippingType === "envio" ? shippingLabel : "Retiro"} isDark={isDark} />

        {shippingType === "envio" && shippingETA && (
          <Row label="ETA estimado" value={shippingETA} isDark={isDark} />
        )}

        {/* Grand total */}
        <div className={`flex justify-between items-start p-4 mt-4 rounded-xl border ${dk("bg-[#0f241a] border-[#183a28]", "bg-[#eaf5ef] border-[#d4ebd8]")}`}>
          <div>
            <p className={`text-[13px] font-black tracking-wide ${dk("text-white", "text-[#102d1f]")}`}>TOTAL FINAL</p>
            <p className={`text-[10px] font-mono mt-0.5 ${dk("text-[#7de3ad]", "text-[#25835a]")}`}>
              @ {exchangeRate.toLocaleString("es-AR")} ARS/USD
            </p>
          </div>
          <div className="text-right">
            <p className="text-[22px] font-black text-[#2D9F6A] tabular-nums leading-none">
              {formatPrice(grandTotal)}
            </p>
            <p className={`text-[11px] font-mono mt-1 ${dk("text-[#7de3ad]/80", "text-[#25835a]/80")}`}>
              {currency === "USD" ? formatARS(grandTotal) : formatUSD(grandTotal)}
            </p>
          </div>
        </div>
      </div>

      {/* Currency strip */}
      <div className={`px-4 py-2 border-t flex items-center justify-between ${dk("border-[#1a1a1a] bg-[#0a0a0a]", "border-[#e5e5e5] bg-[#f9f9f9]")}`}>
        <span className="text-[10px] text-gray-600">
          Moneda: <span className="font-bold text-gray-500">{currency}</span>
        </span>
        <span className="text-[10px] text-gray-700 font-mono">
          1 USD = {exchangeRate.toLocaleString("es-AR")} ARS
        </span>
      </div>
    </div>
  );
}

function Row({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-semibold ${dk("text-gray-300", "text-[#525252]")}`}>{value}</span>
    </div>
  );
}
