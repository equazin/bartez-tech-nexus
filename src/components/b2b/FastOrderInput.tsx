import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ClipboardPaste,
  Keyboard,
  PackageSearch,
  Plus,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { getAvailableStock } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { displayName, type Product } from "@/models/products";

type QuickSuggestion = {
  product: Product;
  score: number;
};

const MAX_SUGGESTIONS = 12;

interface FastOrderInputProps {
  quickSku: string;
  setQuickSku: (value: string) => void;
  quickError: string;
  handleQuickOrder: () => void;
  products: Product[];
  cartSnapshot: Record<number, number>;
  onQuickAddProduct: (product: Product, qty?: number) => void;
  formatQuickPrice: (product: Product) => string;
}

function normalizeQuickText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseQuickEntry(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return { skuQuery: "", quantity: 1 };

  // Accept: SKU qty, SKU;qty, SKU,qty, SKU x qty
  const withQuantity = trimmed.match(/^(.+?)(?:\s*[xX]\s*|\s*[;,]\s*|\s+)(\d+)$/);
  const skuQuery = (withQuantity?.[1] ?? trimmed).trim();
  const quantity = Number.parseInt(withQuantity?.[2] ?? "1", 10);

  return {
    skuQuery,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
  };
}

export function FastOrderInput({
  quickSku,
  setQuickSku,
  quickError,
  handleQuickOrder,
  products,
  cartSnapshot,
  onQuickAddProduct,
  formatQuickPrice,
}: FastOrderInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const submittedRef = useRef(false);
  const pendingSuccessRef = useRef("");

  const [keepFocus, setKeepFocus] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkValue, setBulkValue] = useState("");
  const [localSuccess, setLocalSuccess] = useState("");
  const [localError, setLocalError] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState("");

  const { skuQuery, quantity } = useMemo(() => parseQuickEntry(quickSku), [quickSku]);

  const suggestions = useMemo<QuickSuggestion[]>(() => {
    const query = normalizeQuickText(skuQuery);
    if (!query) return [];

    return products
      .filter((product) => product.sku || product.name)
      .map((product) => {
        const sku = normalizeQuickText(product.sku ?? "");
        const name = normalizeQuickText(displayName(product));
        const brand = normalizeQuickText(product.brand_name ?? "");
        let score = -1;

        if (sku === query) score = 100;
        else if (sku.startsWith(query)) score = 90;
        else if (sku.includes(query)) score = 75;
        else if (name.startsWith(query)) score = 60;
        else if (name.includes(query)) score = 45;
        else if (brand.startsWith(query)) score = 35;
        else if (brand.includes(query)) score = 20;

        return { product, score };
      })
      .filter((entry) => entry.score >= 0)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return displayName(left.product).localeCompare(displayName(right.product), "es");
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [products, skuQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [quickSku]);

  useEffect(() => {
    if (!localSuccess) return undefined;
    const timeout = window.setTimeout(() => setLocalSuccess(""), 1800);
    return () => window.clearTimeout(timeout);
  }, [localSuccess]);

  useEffect(() => {
    if (!localError) return undefined;
    const timeout = window.setTimeout(() => setLocalError(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [localError]);

  useEffect(() => {
    if (!bulkFeedback) return undefined;
    const timeout = window.setTimeout(() => setBulkFeedback(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [bulkFeedback]);

  useEffect(() => {
    if (!quickError) return;
    pendingSuccessRef.current = "";
  }, [quickError]);

  useEffect(() => {
    if (!keepFocus) return undefined;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [keepFocus]);

  useEffect(() => {
    if (!submittedRef.current || !keepFocus || quickSku.trim() !== "") return;
    submittedRef.current = false;
    if (pendingSuccessRef.current) {
      setLocalSuccess(pendingSuccessRef.current);
      pendingSuccessRef.current = "";
    }
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [keepFocus, quickSku]);

  useEffect(() => () => {
    if (blurTimeoutRef.current) window.clearTimeout(blurTimeoutRef.current);
  }, []);

  function resolveExactProduct(rawSku: string) {
    const normalized = normalizeQuickText(rawSku);
    if (!normalized) return null;

    return (
      products.find((product) =>
        [product.sku, product.external_id, String(product.id)]
          .map((value) => normalizeQuickText(value ?? ""))
          .includes(normalized),
      ) ?? null
    );
  }

  function submitResolvedProduct(product: Product, qty: number) {
    const available = getAvailableStock(product);
    const inCart = cartSnapshot[product.id] ?? 0;
    const toAdd = Math.min(qty, Math.max(0, available - inCart));

    if (toAdd <= 0) {
      setLocalError(`Sin stock para ${product.sku ?? product.id}`);
      return;
    }

    onQuickAddProduct(product, toAdd);
    submittedRef.current = true;
    setQuickSku("");
    setShowSuggestions(false);
    pendingSuccessRef.current = `${product.sku ?? product.id} x${toAdd} agregado`;
  }

  function submitCurrentEntry() {
    const exactProduct = resolveExactProduct(skuQuery);
    if (exactProduct) {
      submittedRef.current = true;
      pendingSuccessRef.current = `${exactProduct.sku ?? exactProduct.id} x${quantity} agregado`;
      handleQuickOrder();
      setShowSuggestions(false);
      return;
    }

    const selectedSuggestion = suggestions[activeIndex]?.product ?? suggestions[0]?.product;
    if (selectedSuggestion) {
      submitResolvedProduct(selectedSuggestion, quantity);
      return;
    }

    submittedRef.current = true;
    handleQuickOrder();
    setShowSuggestions(false);
  }

  function handleBulkImport() {
    const lines = bulkValue
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));

    if (lines.length === 0) {
      setBulkFeedback("Pega al menos una linea con SKU y cantidad.");
      return;
    }

    const stagedCart = { ...cartSnapshot };
    let addedLines = 0;
    const issues: string[] = [];

    lines.forEach((line, index) => {
      const { skuQuery: lineSku, quantity: lineQty } = parseQuickEntry(line);
      if (!lineSku) {
        issues.push(`L${index + 1}: formato invalido`);
        return;
      }

      const product = resolveExactProduct(lineSku);
      if (!product) {
        issues.push(`L${index + 1}: SKU ${lineSku} no encontrado`);
        return;
      }

      const available = getAvailableStock(product);
      const inCart = stagedCart[product.id] ?? 0;
      const toAdd = Math.min(lineQty, Math.max(0, available - inCart));

      if (toAdd <= 0) {
        issues.push(`L${index + 1}: sin stock para ${lineSku}`);
        return;
      }

      onQuickAddProduct(product, toAdd);
      stagedCart[product.id] = inCart + toAdd;
      addedLines += 1;
    });

    submittedRef.current = addedLines > 0;
    setBulkFeedback(
      issues.length > 0
        ? `${addedLines} lineas agregadas. ${issues[0]}${issues.length > 1 ? ` (+${issues.length - 1})` : ""}`
        : `${addedLines} lineas agregadas al carrito.`,
    );

    if (addedLines > 0) {
      setBulkValue("");
      setShowBulkDialog(false);
      setQuickSku("");
      if (keepFocus) {
        window.requestAnimationFrame(() => inputRef.current?.focus());
      }
    }
  }

  return (
    <>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
        <div className="relative min-w-0">
          <Sparkles size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Carga rapida: SKU [qty]"
            value={quickSku}
            onChange={(event) => {
              setQuickSku(event.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              blurTimeoutRef.current = window.setTimeout(() => setShowSuggestions(false), 120);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && suggestions.length > 0) {
                event.preventDefault();
                setShowSuggestions(true);
                setActiveIndex((current) => (current + 1) % suggestions.length);
                return;
              }

              if (event.key === "ArrowUp" && suggestions.length > 0) {
                event.preventDefault();
                setShowSuggestions(true);
                setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
                return;
              }

              if (event.key === "Escape") {
                setShowSuggestions(false);
                return;
              }

              if (event.key === "Enter") {
                event.preventDefault();
                submitCurrentEntry();
              }
            }}
            className="h-12 rounded-2xl border-border/80 bg-surface pl-9 pr-10 font-mono text-xs shadow-sm"
          />
          {showSuggestions && suggestions.length > 0 ? (
            <div className="absolute top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl shadow-black/5">
              <ScrollArea className="max-h-72">
                <div className="p-2">
                  {suggestions.map(({ product }, index) => {
                    const available = getAvailableStock(product);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          submitResolvedProduct(product, quantity);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left transition",
                          index === activeIndex ? "bg-primary/8 text-foreground" : "hover:bg-secondary/80",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{displayName(product)}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="font-mono">{product.sku ?? "sin-sku"}</span>
                            {product.brand_name ? <span>{product.brand_name}</span> : null}
                            <span>stock {available}</span>
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-foreground">{formatQuickPrice(product)}</p>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 lg:contents">
          <Button type="button" className="h-12 w-full rounded-2xl px-4 lg:w-auto" onClick={submitCurrentEntry}>
          <Plus size={13} />
          Anadir
        </Button>

          <Button
            type="button"
            variant="toolbar"
            size="default"
            className="h-12 w-full rounded-2xl px-4 lg:w-auto"
            onClick={() => setShowBulkDialog(true)}
          >
          <ClipboardPaste size={13} />
          Pegar lista
          </Button>

          <Button
            type="button"
            variant={keepFocus ? "soft" : "toolbar"}
            size="default"
            className="h-12 w-full rounded-2xl px-4 lg:w-auto"
            onClick={() => setKeepFocus((current) => !current)}
            title="Mantener foco para carga continua"
          >
          <Keyboard size={13} />
          {keepFocus ? "Foco fijo" : "Foco manual"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-1 text-[11px]">
        <Badge variant="muted" className="rounded-full">
          <PackageSearch size={11} />
          SKU qty, SKU;qty o SKU x qty + Enter
        </Badge>
        {localSuccess ? (
          <Badge variant="success" className="rounded-full text-primary">
            <CheckCircle2 size={11} />
            {localSuccess}
          </Badge>
        ) : null}
        {bulkFeedback ? <span className="text-muted-foreground">{bulkFeedback}</span> : null}
      </div>

      {localError || quickError ? <p className="px-1 text-[11px] text-destructive">{localError || quickError}</p> : null}

      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-xl rounded-3xl border-border/80 bg-card p-0">
          <DialogHeader className="border-b border-border/70 px-6 py-5">
            <DialogTitle className="text-xl font-semibold text-foreground">Carga masiva por SKU</DialogTitle>
            <DialogDescription>
              Pega una linea por producto. Formatos: <span className="font-mono">SKU cantidad</span>, <span className="font-mono">SKU;cantidad</span>, <span className="font-mono">SKU x cantidad</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-6 py-5">
            <Textarea
              value={bulkValue}
              onChange={(event) => setBulkValue(event.target.value)}
              placeholder={"HUA001 5\nHPN181 2\n213779 10"}
              className="min-h-[240px] rounded-2xl border-border/80 bg-surface font-mono text-sm leading-6"
            />
            <div className="rounded-2xl border border-dashed border-border/70 bg-surface px-4 py-3 text-xs text-muted-foreground">
              Se respeta el carrito actual, el stock disponible y la logica existente de compra.
            </div>
          </div>

          <DialogFooter className="border-t border-border/70 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setShowBulkDialog(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleBulkImport}>
              Agregar lineas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
