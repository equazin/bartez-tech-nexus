import { ArrowRight, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SurfaceCard } from "@/components/ui/surface-card";

type PartnerLevel = "cliente" | "silver" | "gold" | "platinum";

interface LoyaltyPanelProps {
  partnerLevel: PartnerLevel | null | undefined;
  ordersCount: number;
  onGoToAccount?: () => void;
}

const LEVEL_ORDER: PartnerLevel[] = ["cliente", "silver", "gold", "platinum"];

const LEVEL_CONFIG: Record<
  PartnerLevel,
  {
    label: string;
    color: string;
    badgeClass: string;
    dotClass: string;
    benefits: string[];
    ordersRequired: number;
  }
> = {
  cliente: {
    label: "Cliente",
    color: "text-muted-foreground",
    badgeClass: "border-border bg-muted/50 text-muted-foreground",
    dotClass: "bg-muted-foreground",
    benefits: ["Acceso al catálogo B2B", "Soporte por WhatsApp"],
    ordersRequired: 0,
  },
  silver: {
    label: "Silver",
    color: "text-slate-400",
    badgeClass: "border-slate-400/30 bg-slate-400/10 text-slate-400",
    dotClass: "bg-slate-400",
    benefits: ["Acceso al catálogo B2B", "Soporte por WhatsApp", "+2% descuento adicional", "Prioridad en consultas"],
    ordersRequired: 10,
  },
  gold: {
    label: "Gold",
    color: "text-amber-500",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-500",
    dotClass: "bg-amber-500",
    benefits: [
      "Acceso al catálogo B2B",
      "Soporte por WhatsApp",
      "+5% descuento adicional",
      "Ejecutivo asignado",
      "Crédito hasta 30 días",
    ],
    ordersRequired: 30,
  },
  platinum: {
    label: "Platinum",
    color: "text-violet-400",
    badgeClass: "border-violet-400/30 bg-violet-400/10 text-violet-400",
    dotClass: "bg-violet-400",
    benefits: [
      "Acceso al catálogo B2B",
      "Soporte por WhatsApp",
      "+8% descuento adicional",
      "Entrega prioritaria",
      "Crédito hasta 60 días",
    ],
    ordersRequired: 60,
  },
};

function getNextLevel(current: PartnerLevel): PartnerLevel | null {
  const idx = LEVEL_ORDER.indexOf(current);
  return idx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[idx + 1] : null;
}

function getProgressToNextLevel(current: PartnerLevel, ordersCount: number): number {
  const next = getNextLevel(current);
  if (!next) return 100;
  const currentRequired = LEVEL_CONFIG[current].ordersRequired;
  const nextRequired = LEVEL_CONFIG[next].ordersRequired;
  const range = nextRequired - currentRequired;
  const progress = ordersCount - currentRequired;
  return Math.min(100, Math.max(0, (progress / range) * 100));
}

export function LoyaltyPanel({ partnerLevel, ordersCount, onGoToAccount }: LoyaltyPanelProps) {
  const safeLevel: PartnerLevel = partnerLevel && LEVEL_CONFIG[partnerLevel] ? partnerLevel : "cliente";
  const config = LEVEL_CONFIG[safeLevel];
  const nextLevel = getNextLevel(safeLevel);
  const nextConfig = nextLevel ? LEVEL_CONFIG[nextLevel] : null;
  const progressPct = getProgressToNextLevel(safeLevel, ordersCount);
  const ordersToNext = nextConfig ? Math.max(0, nextConfig.ordersRequired - ordersCount) : 0;

  return (
    <SurfaceCard tone="subtle" padding="md" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10`}>
            <Star size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Fidelización</p>
            <p className="text-sm font-bold text-foreground">Programa Bartez</p>
          </div>
        </div>
        <Badge variant="outline" className={config.badgeClass}>
          {config.label}
        </Badge>
      </div>

      {/* Progress bar (only if not platinum) */}
      {nextLevel && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{config.label}</span>
            <span className={nextConfig?.color}>{nextConfig?.label}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {ordersToNext > 0
              ? `${ordersToNext} pedido${ordersToNext !== 1 ? "s" : ""} más para alcanzar ${nextConfig?.label}`
              : `¡Listo para ${nextConfig?.label}!`}
          </p>
        </div>
      )}

      {safeLevel === "platinum" && (
        <p className="text-xs text-violet-400 font-medium">Nivel máximo alcanzado — ¡Gracias por tu fidelidad!</p>
      )}

      {/* Benefits */}
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Tus beneficios</p>
        <ul className="space-y-1">
          {config.benefits.map((benefit) => (
            <li key={benefit} className="flex items-center gap-2 text-xs text-foreground">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.dotClass}`} />
              {benefit}
            </li>
          ))}
        </ul>
      </div>

      {/* Next level preview */}
      {nextLevel && nextConfig && (
        <div className="rounded-xl border border-border/60 bg-card/60 p-3 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Próximo nivel · {nextConfig.label}
          </p>
          <p className="text-xs text-muted-foreground">
            {nextConfig.benefits[nextConfig.benefits.length - 1]}
          </p>
        </div>
      )}

      {onGoToAccount && (
        <button
          type="button"
          onClick={onGoToAccount}
          className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          Ver mi cuenta <ArrowRight size={11} />
        </button>
      )}
    </SurfaceCard>
  );
}
