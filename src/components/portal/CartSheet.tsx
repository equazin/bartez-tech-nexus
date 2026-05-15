import * as React from "react";
import { ShoppingCart } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Total item count shown in title */
  itemCount?: number;
  /** Cart contents — caller injects existing cart UI */
  children: React.ReactNode;
  /** Sticky footer (totals + checkout CTA) */
  footer?: React.ReactNode;
  className?: string;
}

function CartSheet({ open, onOpenChange, itemCount = 0, children, footer, className }: CartSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn("flex w-full max-w-md flex-col gap-0 border-l border-border/70 bg-surface-1 p-0 sm:max-w-lg", className)}
      >
        <SheetHeader className="border-b border-border/70 px-4 py-3.5 sm:px-5 sm:py-4">
          <SheetTitle className="flex items-center gap-2 portal-h3">
            <ShoppingCart className="h-[18px] w-[18px] text-brand" />
            <span>Carrito</span>
            {itemCount > 0 ? (
              <span className="ml-1 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand portal-tabular">
                {itemCount}
              </span>
            ) : null}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-3.5 sm:px-5 sm:py-4">{children}</div>
        {footer ? (
          <div className="border-t border-border/70 bg-card px-4 py-3.5 sm:px-5 sm:py-4">{footer}</div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export { CartSheet };
