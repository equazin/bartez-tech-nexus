import { ArrowRight, CheckCircle2, Gift, Star, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

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
    solidColor: string;
    badgeClass: string;
    benefits: string[];
    ordersRequired: number;
  }
> = {
  cliente: {
    label: "Cliente",
    color: "text-muted-foreground",
    solidColor: "bg-muted-foreground",
    badgeClass: "border-border bg-muted/50 text-muted-foreground",
    benefits: ["Acceso al catalogo B2B", "Soporte por WhatsApp"],
    ordersRequired: 0,
  },
  silver: {
    label: "Silver",
    color: "text-slate-400",
    solidColor: "bg-slate-400",
    badgeClass: "border-slate-400/30 bg-slate-400/10 text-slate-400",
    benefits: ["Acceso al catalogo B2B", "Soporte por WhatsApp", "+2% descuento adicional", "Prioridad en consultas"],
    ordersRequired: 10,
  },
  gold: {
    label: "Gold",
    color: "text-amber-500",
    solidColor: "bg-amber-500",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-500",
    benefits: [
      "Acceso al catalogo B2B",
      "Soporte por WhatsApp",
      "+5% descuento adicional",
      "Ejecutivo asignado",
      "Credito hasta 30 dias",
    ],
    ordersRequired: 30,
  },
  platinum: {
    label: "Platinum",
    color: "text-violet-400",
    solidColor: "bg-violet-400",
    badgeClass: "border-violet-400/30 bg-violet-400/10 text-violet-400",
    benefits: [
      "Acceso al catalogo B2B",
      "Soporte por WhatsApp",
      "+8% descuento adicional",
      "Entrega prioritaria",
      "Credito hasta 60 dias",
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
  const range = Math.max(1, nextRequired - currentRequired);
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
  const unlockedAtNextLevel = nextConfig
    ? nextConfig.benefits.filter((benefit) => !config.benefits.includes(benefit))
    : [];
  const nextLevelBenefitPreview = unlockedAtNextLevel.length > 0
    ? unlockedAtNextLevel
    : nextConfig
      ? [nextConfig.benefits[nextConfig.benefits.length - 1]]
      : [];

  return (
    <SurfaceCard
      tone="subtle"
      padding="md"
      className="space-y-4 border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15">
            <Trophy size={16} className="text-primary" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Fidelizacion</p>
            <p className="text-sm font-bold text-foreground">Programa de fidelidad Bartez</p>
            <p className="text-xs text-muted-foreground">
              Compra, suma pedidos y desbloquea mejores condiciones comerciales.
            </p>
          </div>
        </div>
        <Badge variant="outline" className={cn("shrink-0", config.badgeClass)}>
          {config.label}
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pedidos acumulados</p>
          <p className="mt-1 text-xl font-extrabold text-foreground">{ordersCount}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Proximo nivel</p>
          <p className={cn("mt-1 text-base font-bold", nextConfig ? nextConfig.color : "text-primary")}>
            {nextConfig?.label ?? "Nivel maximo"}
          </p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card/70 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Te falta</p>
          <p className="mt-1 text-base font-bold text-foreground">
            {nextConfig ? `${ordersToNext} pedido${ordersToNext === 1 ? "" : "s"}` : "Nada"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Nivel actual: {config.label}</span>
          <span className={nextConfig?.color ?? "text-primary"}>
            {nextConfig ? `Objetivo: ${nextConfig.label}` : "Objetivo cumplido"}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {nextConfig ? (
          <p className="text-xs text-muted-foreground">
            {ordersToNext > 0
              ? `Te faltan ${ordersToNext} pedido${ordersToNext === 1 ? "" : "s"} para subir a ${nextConfig.label}.`
              : `Listo para subir a ${nextConfig.label}.`}
          </p>
        ) : (
          <p className="text-xs text-primary">Ya estas en el nivel mas alto del programa.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LEVEL_ORDER.map((level) => {
          const levelCfg = LEVEL_CONFIG[level];
          const reached = ordersCount >= levelCfg.ordersRequired;
          const isCurrent = level === safeLevel;

          return (
            <div
              key={level}
              className={cn(
                "rounded-xl border px-2.5 py-2 text-center",
                isCurrent
                  ? "border-primary/40 bg-primary/10"
                  : reached
                    ? "border-border/70 bg-card/70"
                    : "border-dashed border-border/70 bg-card/40",
              )}
            >
              <div className="flex items-center justify-center">
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    reached ? levelCfg.solidColor : "bg-muted-foreground/40",
                  )}
                />
              </div>
              <p className={cn("mt-1 text-[11px] font-semibold", reached ? "text-foreground" : "text-muted-foreground")}>
                {levelCfg.label}
              </p>
              <p className="text-[10px] text-muted-foreground">{levelCfg.ordersRequired} pedidos</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-card/70 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Beneficios activos</p>
          <ul className="mt-2 space-y-1.5">
            {config.benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2 text-xs text-foreground">
                <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-primary" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-dashed border-border/70 bg-card/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {nextConfig ? `Al subir a ${nextConfig.label}` : "Nivel maximo"}
          </p>
          {nextConfig ? (
            <ul className="mt-2 space-y-1.5">
              {nextLevelBenefitPreview.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-xs text-foreground">
                  <Gift size={13} className="mt-0.5 shrink-0 text-amber-500" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Star size={13} className="text-primary" />
              Ya tenes desbloqueados todos los beneficios disponibles.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card/70 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Como funciona</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-semibold text-primary">1</span>
            Cada pedido confirmado suma para tu nivel.
          </p>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-semibold text-primary">2</span>
            Al llegar al objetivo, subis automaticamente.
          </p>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 font-semibold text-primary">3</span>
            Tus beneficios se aplican en nuevas compras.
          </p>
        </div>
      </div>

      {onGoToAccount ? (
        <button
          type="button"
          onClick={onGoToAccount}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        >
          Ver detalle del programa en mi cuenta
          <ArrowRight size={14} />
        </button>
      ) : null}
    </SurfaceCard>
  );
}
