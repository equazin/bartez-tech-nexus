import React from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FastOrderInput } from "@/components/b2b/FastOrderInput";
import type { Product } from "@/models/products";

interface OperativeBarProps {
  // Fast order
  quickSku: string;
  setQuickSku: (s: string) => void;
  quickError: string;
  handleQuickOrder: () => void;
  quickProducts: Product[];
  cartSnapshot: Record<number, number>;
  onQuickAddProduct: (product: Product, qty?: number) => void;
  formatQuickPrice: (product: Product) => string;
  // Exports (only shown in catalog tab)
  activeTab: string;
  displayProducts: Product[];
  exportCatalogCSV: (products: Product[]) => void;
  handleExportCatalogPDF: () => void;
}

export const OperativeBar: React.FC<OperativeBarProps> = ({
  quickSku,
  setQuickSku,
  quickError,
  handleQuickOrder,
  quickProducts,
  cartSnapshot,
  onQuickAddProduct,
  formatQuickPrice,
  activeTab,
  displayProducts,
  exportCatalogCSV,
  handleExportCatalogPDF,
}) => {
  const isCatalog = activeTab === "catalog";

  return (
    <div
      className={cn(
        "operative-bar sticky top-[var(--header-height,72px)] z-30",
        "border-b border-border/60 bg-muted/40 backdrop-blur-md",
        "px-4 py-2.5 md:px-6",
        "shadow-[0_2px_8px_0_rgba(0,0,0,0.04)]",
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        {/* ── LEFT: Fast order input (takes most space) ─────────────────── */}
        <div className="min-w-0 w-full flex-1">
          <FastOrderInput
            quickSku={quickSku}
            setQuickSku={setQuickSku}
            quickError={quickError}
            handleQuickOrder={handleQuickOrder}
            products={quickProducts}
            cartSnapshot={cartSnapshot}
            onQuickAddProduct={onQuickAddProduct}
            formatQuickPrice={formatQuickPrice}
          />
        </div>

        {/* ── RIGHT: Export controls (catalog only) ──────────────────────── */}
        {isCatalog && (
          <div className="w-full lg:w-auto lg:shrink-0">
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-surface p-1 lg:flex lg:items-center lg:gap-1">
              <Button
                type="button"
                variant="toolbar"
                size="sm"
                className="h-10 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground sm:px-3 lg:h-9"
                onClick={() => exportCatalogCSV(displayProducts)}
              >
                <Download size={11} />
                CSV
              </Button>
              <Button
                type="button"
                variant="toolbar"
                size="sm"
                className="h-10 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground sm:px-3 lg:h-9"
                onClick={handleExportCatalogPDF}
              >
                <Download size={11} />
                PDF
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
