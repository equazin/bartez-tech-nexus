import { useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/models/products";

const WARRANTY_KEYS = [
  "garantia", "garantía", "warranty", "garantia_meses",
  "warranty_months", "garantia_fabricante", "manufacturer_warranty",
];

function resolveWarrantyLabel(product: Product): string {
  if (!product.specs) return "Garantía oficial";

  for (const [key, rawValue] of Object.entries(product.specs)) {
    const normalized = key.trim().toLowerCase();
    if (!WARRANTY_KEYS.some((wk) => normalized.includes(wk))) continue;

    const value = typeof rawValue === "string" ? rawValue.trim() : String(rawValue ?? "");
    if (!value) continue;

    // Try to extract months/years
    const monthsMatch = value.match(/(\d+)\s*mes/i);
    if (monthsMatch) {
      const months = parseInt(monthsMatch[1], 10);
      if (months >= 12 && months % 12 === 0) {
        return `${months / 12} ${months / 12 === 1 ? "año" : "años"} garantía`;
      }
      return `${months} meses garantía`;
    }

    const yearsMatch = value.match(/(\d+)\s*(año|year)/i);
    if (yearsMatch) {
      const years = parseInt(yearsMatch[1], 10);
      return `${years} ${years === 1 ? "año" : "años"} garantía`;
    }

    // Return raw if short enough
    if (value.length <= 40) return value;
    return value.slice(0, 37) + "…";
  }

  return "Garantía oficial";
}

export interface WarrantyBadgeProps {
  product: Product;
  /** Compact pill for product cards */
  compact?: boolean;
  className?: string;
}

export function WarrantyBadge({ product, compact = false, className }: WarrantyBadgeProps) {
  const label = useMemo(() => resolveWarrantyLabel(product), [product]);

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full",
          "bg-violet-500/10 text-violet-600 border border-violet-500/20 shrink-0",
          "dark:text-violet-400",
          className,
        )}
        title={label}
      >
        <ShieldCheck size={10} />
        {label}
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <ShieldCheck size={14} className="text-violet-600 dark:text-violet-400 shrink-0" />
      <span className="text-sm font-semibold text-foreground">{label}</span>
    </div>
  );
}
