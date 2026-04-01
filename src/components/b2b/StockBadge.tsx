import React from "react";
import { Check, AlertTriangle, AlertCircle, Clock } from "lucide-react";

interface StockBadgeProps {
  stock: number;
  lugStock?: number;
}

export function StockBadge({ stock, lugStock = 0 }: StockBadgeProps) {
  if (stock === 0 && lugStock > 0)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
        <Clock size={9} /> 2-3 días
      </span>
    );
  if (stock === 0)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
        <AlertCircle size={9} /> Sin stock
      </span>
    );
  if (stock <= 3)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
        <AlertTriangle size={9} /> Últimas {stock}u
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/15 shrink-0">
      <Check size={9} /> En stock
    </span>
  );
}
