import { useState } from "react";
import { Bell, Minus, Plus } from "lucide-react";

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
  showShortcuts?: boolean;
  minQty?: number;
  onNotifyClick?: () => void;
}

export function QuickAddControl({
  inCart,
  outOfStock,
  wasAdded = false,
  onAddQty,
  onRemoveOne,
  compact = false,
  showShortcuts = false,
  minQty = 1,
  onNotifyClick,
}: QuickAddControlProps) {
  const [qty, setQty] = useState(minQty);

  const handleSubmit = () => {
    if (outOfStock) return;
    onAddQty(Math.max(minQty, qty));
    setQty(minQty);
  };

  const shortcuts = (() => {
    if (!showShortcuts || compact || outOfStock) return [];
    const base = minQty > 1 ? minQty : 1;
    if (base > 1) {
      return [base, base * 2, base * 4].filter((v) => v <= 100);
    }
    return [5, 10, 25];
  })();

  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn("flex shrink-0 items-center", compact ? "min-w-max flex-wrap gap-1.5 sm:flex-nowrap" : "flex-wrap gap-2 sm:flex-nowrap")}>
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

      <div className="flex shrink-0 items-center rounded-xl border border-border/70 bg-background">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("rounded-xl border-0", compact ? "h-8 w-8" : "h-10 w-10")}
          onClick={() => setQty((prev) => Math.max(minQty, prev - 1))}
          disabled={outOfStock}
        >
          <Minus size={compact ? 11 : 13} />
        </Button>

        <Input
          type="number"
          min={minQty}
          value={qty}
          onChange={(event) => setQty(Math.max(minQty, Number(event.target.value) || minQty))}
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

      {outOfStock && onNotifyClick ? (
        <Button
          type="button"
          variant="outline"
          onClick={onNotifyClick}
          className={cn("gap-1.5 border-border/70 text-muted-foreground hover:border-primary/30 hover:text-primary", compact ? "h-8 rounded-xl px-3 text-xs" : "h-10 rounded-xl px-3")}
          title="Notificarme cuando vuelva el stock"
        >
          <Bell size={compact ? 11 : 13} />
          {!compact && <span>Avisar</span>}
        </Button>
      ) : (
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={outOfStock}
          variant={wasAdded ? "soft" : "default"}
          className={cn(compact ? "h-8 rounded-xl px-3 text-xs" : "h-10 rounded-xl px-4")}
        >
          Añadir
        </Button>
      )}

      {inCart > 0 && onRemoveOne ? (
        <Button type="button" variant="outline" onClick={onRemoveOne} className={cn(compact ? "h-8 rounded-xl px-3 text-xs" : "h-10 rounded-xl px-3")}>
          Quitar
        </Button>
      ) : null}
      </div>

      {shortcuts.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-medium text-muted-foreground">Rápido:</span>
          {shortcuts.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => onAddQty(amount)}
              className="rounded-lg border border-border/60 bg-secondary/40 px-2 py-0.5 text-[9px] font-bold tabular-nums text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary active:scale-95"
            >
              +{amount}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

