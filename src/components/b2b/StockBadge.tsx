import React from "react";
import { Clock } from "lucide-react";

interface StockBadgeProps {
  stock: number;
  lugStock?: number;
}

export function StockBadge({ stock, lugStock = 0 }: StockBadgeProps) {
  if (stock === 0 && lugStock > 0)
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0 dark:text-blue-400">
        <Clock size={10} /> 2-3 días
      </span>
    );
  if (stock === 0)
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-destructive shadow-[0_0_4px_rgba(239,68,68,0.6)]" /> Sin stock
      </span>
    );
  if (stock < 5)
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0 dark:text-amber-400">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.6)]" /> Stock bajo ({stock})
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shrink-0 dark:text-emerald-400">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]" /> En stock
    </span>
  );
}
