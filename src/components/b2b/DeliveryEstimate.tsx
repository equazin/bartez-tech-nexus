import { useMemo } from "react";
import { Truck, Clock, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Adds `days` business days (Mon-Fri) to `from`.
 * Skips weekends (Sat=6, Sun=0).
 */
function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return result;
}

function formatShortDate(date: Date): string {
  const days = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  const months = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
  ];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

function formatFullDate(date: Date): string {
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  return `${days[date.getDay()]} ${date.getDate()}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export interface DeliveryEstimateProps {
  stock: number;
  stockReserved?: number;
  /** Override lead time in business days (from supplier) */
  leadTimeDays?: number;
  /** Compact display for product cards */
  compact?: boolean;
  className?: string;
}

export function DeliveryEstimate({
  stock,
  stockReserved = 0,
  leadTimeDays,
  compact = false,
  className,
}: DeliveryEstimateProps) {
  const available = Math.max(0, stock - stockReserved);
  const today = useMemo(() => new Date(), []);

  const estimate = useMemo(() => {
    if (available > 0) {
      // In stock: 1-2 business days for dispatch + delivery
      const minDays = leadTimeDays ?? 1;
      const maxDays = leadTimeDays != null ? leadTimeDays + 1 : 2;
      const arriveBy = addBusinessDays(today, minDays);
      const arriveByMax = addBusinessDays(today, maxDays);
      return {
        type: "immediate" as const,
        label: compact
          ? `Llega ${formatShortDate(arriveBy)}`
          : `Llega el ${formatFullDate(arriveBy)}`,
        sublabel: minDays !== maxDays
          ? `Despacho en ${minDays}-${maxDays} días hábiles`
          : `Despacho en ${minDays} día hábil`,
        arriveBy,
        arriveByMax,
      };
    }

    if (leadTimeDays != null && leadTimeDays > 0) {
      // Out of stock but known lead time
      const arriveBy = addBusinessDays(today, leadTimeDays);
      const arriveByMax = addBusinessDays(today, leadTimeDays + 3);
      return {
        type: "delayed" as const,
        label: compact
          ? `Disponible ${formatShortDate(arriveBy)}`
          : `Disponible desde ${formatFullDate(arriveBy)}`,
        sublabel: `Importación estimada: ${leadTimeDays} días hábiles`,
        arriveBy,
        arriveByMax,
      };
    }

    // Fully out of stock
    return {
      type: "unavailable" as const,
      label: "Entrega bajo consulta",
      sublabel: "Contactá a tu vendedor para fechas",
      arriveBy: null,
      arriveByMax: null,
    };
  }, [available, compact, leadTimeDays, today]);

  const icon = estimate.type === "immediate" ? (
    <CalendarCheck size={compact ? 11 : 13} />
  ) : estimate.type === "delayed" ? (
    <Clock size={compact ? 11 : 13} />
  ) : (
    <Truck size={compact ? 11 : 13} />
  );

  const colorClass = estimate.type === "immediate"
    ? "text-emerald-600 dark:text-emerald-400"
    : estimate.type === "delayed"
      ? "text-blue-600 dark:text-blue-400"
      : "text-muted-foreground";

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0",
          estimate.type === "immediate"
            ? "bg-emerald-500/10 border-emerald-500/20"
            : estimate.type === "delayed"
              ? "bg-blue-500/10 border-blue-500/20"
              : "bg-muted/50 border-border/50",
          colorClass,
          className,
        )}
        title={estimate.sublabel}
      >
        {icon}
        {estimate.label}
      </span>
    );
  }

  return (
    <div className={cn("flex items-start gap-2", className)}>
      <div className={cn("mt-0.5", colorClass)}>{icon}</div>
      <div>
        <p className={cn("text-sm font-semibold", colorClass)}>{estimate.label}</p>
        <p className="text-[11px] text-muted-foreground">{estimate.sublabel}</p>
      </div>
    </div>
  );
}
