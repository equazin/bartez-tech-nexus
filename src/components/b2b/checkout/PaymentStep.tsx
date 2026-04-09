import { CreditCard } from "lucide-react";
import { PaymentMethodMatrix } from "./PaymentMethodMatrix";

type PaymentMethod = "transferencia" | "echeq" | "cuenta_corriente" | "efectivo" | "otro";
type EcheqTermDays = 15 | 30 | 45 | 60;

export interface PaymentStepProps {
  baseTotal: number;
  paymentMethod: PaymentMethod;
  echeqTermDays: EcheqTermDays;
  currentAccountSharePct: number;
  creditAvailableDisplay: string | null;
  creditAvailableArs: number | null;
  creditLimitArs: number | null;
  creditUsedArs: number;
  maxCurrentAccountSharePct: number;
  clientPaymentTerms: number;
  currentAccountAmount: number;
  transferAmount: number;
  formatPrice: (n: number) => string;
  isDark: boolean;
  onSetPaymentMethod: (m: PaymentMethod) => void;
  onSetEcheqTermDays: (d: EcheqTermDays) => void;
  onSetCurrentAccountSharePct: (pct: number) => void;
}

export function PaymentStep({
  baseTotal,
  paymentMethod,
  echeqTermDays,
  currentAccountSharePct,
  creditAvailableDisplay,
  creditAvailableArs,
  creditLimitArs,
  creditUsedArs,
  maxCurrentAccountSharePct,
  clientPaymentTerms,
  currentAccountAmount,
  transferAmount,
  formatPrice,
  isDark,
  onSetPaymentMethod,
  onSetEcheqTermDays,
  onSetCurrentAccountSharePct,
}: PaymentStepProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  return (
    <div className="flex flex-col gap-5">
      {/* Credit indicator */}
      {creditAvailableDisplay && creditLimitArs != null ? (
        <div className={`rounded-xl border p-4 flex flex-col gap-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard size={14} className={currentAccountAmount > (creditAvailableArs || 0) ? "text-red-500" : "text-[#2D9F6A]"} />
              <span className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>Línea de Crédito B2B</span>
            </div>
            <span className={`text-sm font-black tabular-nums ${currentAccountAmount > (creditAvailableArs || 0) ? "text-red-500" : "text-[#2D9F6A]"}`}>
              {creditAvailableDisplay} libre
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 flex rounded-full overflow-hidden bg-[#e5e5e5] dark:bg-[#262626]">
            {/* Consumido previamente */}
            <div 
              style={{ width: `${Math.min(100, (creditUsedArs / creditLimitArs) * 100)}%` }} 
              className="h-full bg-gray-400 dark:bg-gray-600 border-r border-white/20"
              title={`Consumido: ${formatPrice(creditUsedArs)}`}
            />
            {/* Cesta Actual (si pule limite, se vuelve rojo, sino naranja/verde) */}
            <div 
              style={{ width: `${Math.min(100, (currentAccountAmount / creditLimitArs) * 100)}%` }} 
              className={`h-full ${currentAccountAmount > (creditAvailableArs || 0) ? "bg-red-500" : "bg-amber-400"} transition-all`}
              title={`Este carrito: ${formatPrice(currentAccountAmount)}`}
            />
          </div>
          
          <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-1">
            <span>Usado: {formatPrice(creditUsedArs)}</span>
            <span>Total: {formatPrice(creditLimitArs)}</span>
          </div>
        </div>
      ) : creditAvailableDisplay && (
        <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${dk("border-[#183a28] bg-[#0f241a]", "border-[#d4ebd8] bg-[#eaf5ef]")}`}>
          <div className="flex items-center gap-2">
            <CreditCard size={14} className="text-[#2D9F6A]" />
            <span className={`text-sm font-semibold ${dk("text-white", "text-[#102d1f]")}`}>Crédito disponible</span>
          </div>
          <span className="text-lg font-black text-[#2D9F6A] tabular-nums">{creditAvailableDisplay}</span>
        </div>
      )}

      {/* Payment matrix */}
      <PaymentMethodMatrix
        baseTotal={baseTotal}
        selectedMethod={paymentMethod}
        selectedEcheqDays={echeqTermDays}
        creditAvailableDisplay={creditAvailableDisplay}
        formatPrice={formatPrice}
        onSelectMethod={onSetPaymentMethod}
        onSelectEcheqDays={onSetEcheqTermDays}
      />

      {/* Account split for cuenta corriente */}
      {paymentMethod === "cuenta_corriente" && (
        <div className={`rounded-xl border p-4 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <p className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>Split de pago</p>
              <p className={`text-[11px] ${dk("text-gray-400", "text-[#737373]")}`}>
                Plazo comercial: {clientPaymentTerms === 0 ? "contado" : `${clientPaymentTerms} días`}.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className={dk("text-gray-400", "text-[#737373]")}>Cuenta corriente {currentAccountSharePct}%</span>
            <span className={dk("text-gray-400", "text-[#737373]")}>Transferencia {100 - currentAccountSharePct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={currentAccountSharePct}
            onChange={(e) => onSetCurrentAccountSharePct(Number(e.target.value))}
            className="w-full accent-[#2D9F6A]"
          />
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <div className={`rounded-lg border px-3 py-2 ${dk("border-[#262626] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")}`}>
              <p className="text-[11px] text-gray-500">Monto por cuenta corriente</p>
              <p className="text-sm font-bold text-[#2D9F6A]">{formatPrice(currentAccountAmount)}</p>
            </div>
            <div className={`rounded-lg border px-3 py-2 ${dk("border-[#262626] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")}`}>
              <p className="text-[11px] text-gray-500">Monto por transferencia</p>
              <p className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>{formatPrice(transferAmount)}</p>
            </div>
          </div>
          {creditAvailableArs != null && (
            <p className={`mt-3 text-[11px] ${currentAccountSharePct > maxCurrentAccountSharePct ? "text-amber-400" : dk("text-gray-400", "text-[#737373]")}`}>
              Máximo cubrible con tu disponible actual: {maxCurrentAccountSharePct}% del pedido.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
