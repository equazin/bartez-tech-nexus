import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface QuickAddControlProps {
  inCart: number;
  outOfStock: boolean;
  wasAdded?: boolean;
  onAddQty: (qty: number) => void;
  onRemoveOne?: () => void;
  compact?: boolean;
}

export function QuickAddControl({
  inCart,
  outOfStock,
  wasAdded = false,
  onAddQty,
  onRemoveOne,
  compact = false,
}: QuickAddControlProps) {
  const [qty, setQty] = useState(1);

  const handleSubmit = () => {
    if (outOfStock) return;
    onAddQty(Math.max(1, qty));
    setQty(1);
  };

  return (
    <div className={cn("flex items-center gap-2", compact && "gap-1.5")}>
      {inCart > 0 ? (
        <div
          className={cn(
            "rounded-xl border border-border/70 bg-background px-2 text-center font-semibold tabular-nums text-foreground",
            compact ? "h-8 min-w-8 text-xs leading-8" : "h-10 min-w-10 text-sm leading-10",
          )}
          title="Cantidad actual en carrito"
        >
          {inCart}
        </div>
      ) : null}

      <div className="flex items-center rounded-xl border border-border/70 bg-background">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("rounded-xl border-0", compact ? "h-8 w-8" : "h-10 w-10")}
          onClick={() => setQty((prev) => Math.max(1, prev - 1))}
          disabled={outOfStock}
        >
          <Minus size={compact ? 11 : 13} />
        </Button>

        <Input
          type="number"
          min={1}
          value={qty}
          onChange={(event) => setQty(Math.max(1, Number(event.target.value) || 1))}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSubmit();
          }}
          className={cn(
            "border-0 bg-transparent text-center font-semibold tabular-nums shadow-none focus-visible:ring-0",
            compact ? "h-8 w-11 px-1 text-xs" : "h-10 w-12 px-1 text-sm",
          )}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("rounded-xl border-0", compact ? "h-8 w-8" : "h-10 w-10")}
          onClick={() => setQty((prev) => prev + 1)}
          disabled={outOfStock}
        >
          <Plus size={compact ? 11 : 13} />
        </Button>
      </div>

      <Button
        type="button"
        onClick={handleSubmit}
        disabled={outOfStock}
        variant={wasAdded ? "soft" : "default"}
        className={cn(compact ? "h-8 rounded-xl px-3 text-xs" : "h-10 rounded-xl px-4")}
      >
        Anadir
      </Button>

      {inCart > 0 && onRemoveOne ? (
        <Button type="button" variant="outline" onClick={onRemoveOne} className={cn(compact ? "h-8 rounded-xl px-3 text-xs" : "h-10 rounded-xl px-3")}>
          Quitar
        </Button>
      ) : null}
    </div>
  );
}
