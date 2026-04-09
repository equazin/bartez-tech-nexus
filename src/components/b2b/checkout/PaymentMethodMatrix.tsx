import { useMemo } from "react";
import { Check, CreditCard, Building2, Banknote, FileQuestion } from "lucide-react";
import { cn } from "@/lib/utils";

type PaymentMethod = "transferencia" | "echeq" | "cuenta_corriente" | "efectivo" | "otro";
type EcheqTermDays = 15 | 30 | 45 | 60;

const ECHEQ_SURCHARGE_BY_TERM: Record<EcheqTermDays, number> = {
  15: 2.25,
  30: 4.5,
  45: 6.75,
  60: 9,
};

const ECHEQ_TERM_OPTIONS: EcheqTermDays[] = [15, 30, 45, 60];

interface PaymentRow {
  method: PaymentMethod;
  label: string;
  icon: React.ReactNode;
  surchargePercent: number;
  estimatedTotal: number;
  sublabel?: string;
  echeqDays?: EcheqTermDays;
}

export interface PaymentMethodMatrixProps {
  baseTotal: number;
  selectedMethod: PaymentMethod;
  selectedEcheqDays: EcheqTermDays;
  creditAvailableDisplay: string | null;
  formatPrice: (n: number) => string;
  onSelectMethod: (method: PaymentMethod) => void;
  onSelectEcheqDays: (days: EcheqTermDays) => void;
}

export function PaymentMethodMatrix({
  baseTotal,
  selectedMethod,
  selectedEcheqDays,
  creditAvailableDisplay,
  formatPrice,
  onSelectMethod,
  onSelectEcheqDays,
}: PaymentMethodMatrixProps) {
  const rows: PaymentRow[] = useMemo(() => {
    const base: PaymentRow[] = [
      {
        method: "transferencia",
        label: "Transferencia bancaria",
        icon: <Building2 size={14} />,
        surchargePercent: 0,
        estimatedTotal: baseTotal,
        sublabel: "Sin recargo · acreditación inmediata",
      },
    ];

    // Expand echeq into individual term rows
    for (const days of ECHEQ_TERM_OPTIONS) {
      const surcharge = ECHEQ_SURCHARGE_BY_TERM[days];
      base.push({
        method: "echeq",
        label: `Echeq ${days} días`,
        icon: <CreditCard size={14} />,
        surchargePercent: surcharge,
        estimatedTotal: baseTotal * (1 + surcharge / 100),
        sublabel: `Recargo ${surcharge.toLocaleString("es-AR", { minimumFractionDigits: 1 })}%`,
        echeqDays: days,
      });
    }

    base.push(
      {
        method: "cuenta_corriente",
        label: "Cuenta corriente",
        icon: <CreditCard size={14} />,
        surchargePercent: 0,
        estimatedTotal: baseTotal,
        sublabel: creditAvailableDisplay
          ? `Disponible: ${creditAvailableDisplay}`
          : "Sujeto a crédito aprobado",
      },
      {
        method: "efectivo",
        label: "Efectivo",
        icon: <Banknote size={14} />,
        surchargePercent: 0,
        estimatedTotal: baseTotal,
        sublabel: "Pago contra entrega",
      },
      {
        method: "otro",
        label: "Otro",
        icon: <FileQuestion size={14} />,
        surchargePercent: 0,
        estimatedTotal: baseTotal,
        sublabel: "A convenir con vendedor",
      },
    );

    return base;
  }, [baseTotal, creditAvailableDisplay]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <CreditCard size={13} className="text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Medios de pago disponibles
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/70">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_120px] gap-2 bg-surface px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
          <span>Medio de pago</span>
          <span className="text-center">Recargo</span>
          <span className="text-right">Total estimado</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/40">
          {rows.map((row) => {
            const isSelected =
              row.method === selectedMethod &&
              (row.method !== "echeq" || row.echeqDays === selectedEcheqDays);

            return (
              <button
                key={`${row.method}-${row.echeqDays ?? ""}`}
                type="button"
                onClick={() => {
                  onSelectMethod(row.method);
                  if (row.method === "echeq" && row.echeqDays) {
                    onSelectEcheqDays(row.echeqDays);
                  }
                }}
                className={cn(
                  "grid w-full grid-cols-[1fr_80px_120px] gap-2 px-4 py-3 text-left transition-colors",
                  isSelected
                    ? "bg-primary/8 border-l-2 border-l-primary"
                    : "hover:bg-surface/80 border-l-2 border-l-transparent",
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition",
                      isSelected ? "border-primary bg-primary" : "border-border",
                    )}
                  >
                    {isSelected ? <Check size={10} className="text-primary-foreground" /> : null}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("shrink-0", isSelected ? "text-primary" : "text-muted-foreground")}>
                        {row.icon}
                      </span>
                      <span className={cn("text-sm font-semibold truncate", isSelected ? "text-foreground" : "text-foreground/80")}>
                        {row.label}
                      </span>
                    </div>
                    {row.sublabel ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground truncate pl-6">{row.sublabel}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  {row.surchargePercent > 0 ? (
                    <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      +{row.surchargePercent.toLocaleString("es-AR", { minimumFractionDigits: 1 })}%
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      0%
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end">
                  <span className={cn("text-sm font-bold tabular-nums", isSelected ? "text-primary" : "text-foreground/70")}>
                    {formatPrice(row.estimatedTotal)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
