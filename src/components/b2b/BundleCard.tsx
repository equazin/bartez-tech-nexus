/**
 * Card de Bundle/Kit para el portal cliente.
 * Visualmente consistente con ProductItem en modo grid.
 * Usa tokens de color del proyecto; no hardcodea colores.
 */

import { Layers, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { BundleWithSlots } from "@/models/bundle";
import {
  getBundleDefaultPrice,
  getBundleComponentSummary,
  isBundleAvailable,
  buildDefaultSelection,
} from "@/lib/bundlePricing";

interface BundleCardProps {
  bundle: BundleWithSlots;
  formatPrice: (amount: number) => string;
  onClick: (bundleId: string) => void;
}

export function BundleCard({ bundle, formatPrice, onClick }: BundleCardProps) {
  const defaultSel = buildDefaultSelection(bundle);
  const { subtotal, total } = getBundleDefaultPrice(bundle);
  const available = isBundleAvailable(bundle, defaultSel);
  const components = getBundleComponentSummary(bundle, 4);
  const extraCount = bundle.slots.length - 4;

  return (
    <SurfaceCard
      tone="glass"
      padding={false}
      className="cursor-pointer group hover:border-primary/40 transition-colors duration-150"
      onClick={() => onClick(bundle.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(bundle.id); }}
    >
      <div className="p-3 flex flex-col gap-2.5 h-full">
        {/* Header badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className="gap-1 text-[10px] py-0 px-1.5 bg-primary/10 text-primary border-primary/30">
            <Layers size={9} /> Kit
          </Badge>
          {bundle.discount_pct > 0 && (
            <Badge className="text-[10px] py-0 px-1.5 bg-green-500/10 text-green-500 border-green-500/30">
              <Tag size={9} className="mr-0.5" />
              -{bundle.discount_pct}% off
            </Badge>
          )}
          {bundle.allows_customization && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-muted-foreground">
              Personalizable
            </Badge>
          )}
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
          {bundle.title}
        </p>

        {/* Component summary */}
        {components.length > 0 && (
          <ul className="space-y-0.5 flex-1">
            {components.map((c, i) => (
              <li key={i} className="flex items-start gap-1 text-[11px] text-muted-foreground leading-snug">
                <span className="shrink-0 font-medium">{c.label}:</span>
                <span className="truncate">{c.productName}</span>
              </li>
            ))}
            {extraCount > 0 && (
              <li className="text-[10px] text-muted-foreground/60 italic">
                y {extraCount} componente{extraCount !== 1 ? "s" : ""} más...
              </li>
            )}
          </ul>
        )}

        {/* Price */}
        <div className="mt-auto pt-1 border-t border-border/50">
          {available ? (
            <div className="flex items-end gap-2">
              <span className="text-xl font-extrabold text-foreground tabular-nums">
                {formatPrice(total)}
              </span>
              {bundle.discount_pct > 0 && subtotal > total && (
                <span className="text-xs text-muted-foreground line-through tabular-nums pb-0.5">
                  {formatPrice(subtotal)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">Consultar</span>
          )}
        </div>
      </div>
    </SurfaceCard>
  );
}
