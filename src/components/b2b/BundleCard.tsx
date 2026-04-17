/**
 * Card de Bundle/Kit para el portal cliente.
 * Soporta los tres tipos: pc_armada, esquema y bundle genérico.
 * Muestra imagen (si existe), tipo, precio con margen del cliente y ahorro real.
 */

import { ArrowUpRight, CheckCircle2, Cpu, Package, Sliders, Tag, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { BundleWithSlots, BundleType } from "@/models/bundle";
import { BUNDLE_TYPE_LABELS } from "@/models/bundle";
import {
  getBundleComponentSummary,
  getBundlePortalMetrics,
} from "@/lib/bundlePricing";

interface BundleCardProps {
  bundle: BundleWithSlots;
  formatPrice: (amount: number) => string;
  onClick: (bundleId: string) => void;
  /** Margen del cliente para calcular precios desde cost_price. Default 0. */
  clientMargin?: number;
}

const TYPE_ICONS: Record<BundleType, typeof Cpu> = {
  pc_armada: Cpu,
  esquema:   Sliders,
  bundle:    Package,
};

const TYPE_COLORS: Record<BundleType, string> = {
  pc_armada: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  esquema:   "bg-violet-500/10 text-violet-500 border-violet-500/30",
  bundle:    "bg-primary/10 text-primary border-primary/30",
};

export function BundleCard({ bundle, formatPrice, onClick, clientMargin = 0 }: BundleCardProps) {
  const metrics = getBundlePortalMetrics(bundle, clientMargin);
  const components = getBundleComponentSummary(bundle, 4);
  const extraCount = bundle.slots.length - 4;
  const hasDiscount = metrics.discountAmount > 0 && metrics.basePrice > metrics.startingPrice;
  const hasCustomization = metrics.configurableSlots > 0;
  const hasStockIssues = metrics.requiredOutOfStock > 0;
  const available = metrics.isAvailable;
  const subtotal = metrics.basePrice;
  const total = metrics.startingPrice;
  const savingsPct = metrics.savingsPct;

  const TypeIcon  = TYPE_ICONS[bundle.type] ?? Package;
  const typeColor = TYPE_COLORS[bundle.type] ?? TYPE_COLORS.bundle;
  const typeLabel = BUNDLE_TYPE_LABELS[bundle.type] ?? "Kit";

  return (
    <SurfaceCard
      tone="glass"
      padding="none"
      className="cursor-pointer group hover:border-primary/40 transition-colors duration-150 flex flex-col"
      onClick={() => onClick(bundle.id)}
      role="button"
      tabIndex={0}
      aria-label={`Abrir kit ${bundle.title}`}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(bundle.id); }}
    >
      {/* Imagen de portada */}
      {bundle.image_url && (
        <div className="relative overflow-hidden rounded-t-[inherit] bg-muted/40">
          <img
            src={bundle.image_url}
            alt={bundle.title}
            className="h-32 w-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
            loading="lazy"
          />
          {hasDiscount && (
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
              <Tag size={9} />
              -{Math.round(metrics.savingsPct)}%
            </div>
          )}
        </div>
      )}

      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Badges de tipo y estado */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className={`gap-1 text-[10px] py-0 px-1.5 ${typeColor}`}>
            <TypeIcon size={9} />
            {typeLabel}
          </Badge>
          {hasCustomization && (
            <Badge variant="outline" className="gap-1 text-[10px] py-0 px-1.5 text-muted-foreground">
              <Wrench size={9} />
              Configurable
            </Badge>
          )}
          {hasStockIssues ? (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-500/30 text-amber-500">
              Consultar stock
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-[10px] py-0 px-1.5 border-emerald-500/30 text-emerald-500">
              <CheckCircle2 size={9} />
              Disponible
            </Badge>
          )}
        </div>

        {/* Título */}
        <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
          {bundle.title}
        </p>

        {/* Descripción corta */}
        {bundle.description && (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 -mt-0.5">
            {bundle.description}
          </p>
        )}

        {/* Resumen de componentes */}
        {components.length > 0 && (
          <ul className="space-y-0.5 flex-1">
            {components.map((c, i) => (
              <li key={i} className="flex items-start gap-1 text-[11px] text-muted-foreground leading-snug">
                <span className="shrink-0 font-medium">{c.label}{c.quantity > 1 ? ` ×${c.quantity}` : ""}:</span>
                <span className="truncate">{c.productName}</span>
                {c.optional && (
                  <span className="shrink-0 text-[9px] text-muted-foreground/50 italic">(opc.)</span>
                )}
              </li>
            ))}
            {extraCount > 0 && (
              <li className="text-[10px] text-muted-foreground/60 italic">
                y {extraCount} componente{extraCount !== 1 ? "s" : ""} más...
              </li>
            )}
          </ul>
        )}

        {/* Precio */}
        <div className="mt-auto pt-2 border-t border-border/50">
          {available ? (
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Desde
                </p>
                <span className="text-xl font-extrabold text-foreground tabular-nums">
                  {formatPrice(total)}
                </span>
                {hasDiscount && (
                  <span className="ml-2 text-xs text-muted-foreground line-through tabular-nums">
                    {formatPrice(subtotal)}
                  </span>
                )}
              </div>
              {hasDiscount && (
                <span className="shrink-0 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-600 dark:text-green-400">
                  Ahorrás {formatPrice(subtotal - total)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">Consultar disponibilidad</span>
          )}
          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-foreground">
            <span>{hasCustomization ? "Ver configuracion" : "Ver kit"}</span>
            <ArrowUpRight size={14} className="text-primary" />
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
