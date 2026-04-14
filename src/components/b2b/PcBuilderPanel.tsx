import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronsUpDown, Cpu, FolderOpen, HardDrive, Monitor, Package, Save, Share, ShoppingCart, Sparkles, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SurfaceCard } from "@/components/ui/surface-card";
import { usePcBuilds } from "@/hooks/usePcBuilds";
import type { PriceResult } from "@/hooks/usePricing";
import { resolveProductImageUrl } from "@/lib/productImage";
import type { PcBuildDraft, PcBuilderGoal, PcBuilderMode, PcBuilderPriority, PcBuildItemDraft } from "@/models/pcBuilder";
import type { Product } from "@/models/products";
import {
  buildPcCatalogEntries,
  estimatePsuRequirement,
  evaluatePcCompatibility,
  getCanonicalKeyLabel,
  getPcBuildProfilePreset,
  getPcBuildDiscount,
  PC_COMPONENT_LABELS,
  PC_COMPONENT_ORDER,
  PC_COMPONENT_PREREQUISITES,
  PC_REQUIRED_COMPONENTS,
  type PcBuildSelection,
  type PcCatalogEntry,
  type PcComponentType,
} from "@/lib/pcBuilder";

export interface PcBuilderQuoteInput {
  buildId?: string;
  discount: { percentage: number; amount: number; label: string };
  items: Array<{ componentType: PcComponentType; product: Product; quantity: number; pricing: PriceResult }>;
}

interface PcBuilderPanelProps {
  products: Product[];
  computePrice: (product: Product, quantity: number) => PriceResult;
  formatPrice: (value: number) => string;
  onAddToCart: (product: Product, quantity: number) => void;
  profileId?: string;
  clientName?: string;
  currency: "USD" | "ARS";
  isAdmin?: boolean;
  allProducts?: Product[];
  onCreateQuote?: (input: PcBuilderQuoteInput) => Promise<boolean>;
}

function getProductDisplayName(product: Product): string {
  return product.name_custom?.trim() || product.name_original?.trim() || product.name;
}

function shallowEqualSelection(left: PcBuildSelection, right: PcBuildSelection): boolean {
  return PC_COMPONENT_ORDER.every((componentType) => left[componentType] === right[componentType]);
}

function shallowEqualQuantity(
  left: Partial<Record<PcComponentType, number>>,
  right: Partial<Record<PcComponentType, number>>,
): boolean {
  return PC_COMPONENT_ORDER.every((componentType) => (left[componentType] ?? 1) === (right[componentType] ?? 1));
}

function toDraftItems(
  selected: Array<{ componentType: PcComponentType; entry: PcCatalogEntry; quantity: number }>,
): PcBuildItemDraft[] {
  return selected.map((line) => ({
    slotKey: line.componentType,
    productId: line.entry.product.id,
    quantity: line.quantity,
    compatibilityState: "compatible",
  }));
}

function rankByPriority(
  options: PcCatalogEntry[],
  componentType: PcComponentType,
  priority: PcBuilderPriority,
  goal: PcBuilderGoal,
  computePrice: (product: Product, quantity: number) => PriceResult,
): PcCatalogEntry[] {
  const byPrice = [...options].sort(
    (left, right) => computePrice(left.product, 1).totalWithIVA - computePrice(right.product, 1).totalWithIVA,
  );

  if (priority === "price" || goal === "office") return byPrice;
  if (priority === "performance" || (goal === "gaming" && componentType === "gpu")) {
    return [...options].sort((left, right) => {
      const leftScore = (left.specs.tdp_w ?? 0) + (left.specs.wattage ?? 0) + computePrice(left.product, 1).totalWithIVA / 1000;
      const rightScore = (right.specs.tdp_w ?? 0) + (right.specs.wattage ?? 0) + computePrice(right.product, 1).totalWithIVA / 1000;
      return rightScore - leftScore;
    });
  }
  return byPrice;
}

interface PcComponentPickerProps {
  componentType: PcComponentType;
  options: PcCatalogEntry[];
  selectedProductId?: number;
  computePrice: (product: Product, quantity: number) => PriceResult;
  formatPrice: (value: number) => string;
  onSelect: (productIdRaw: string) => void;
  isAdmin?: boolean;
  allProducts?: Product[];
}

function PcComponentPicker({
  componentType,
  options,
  selectedProductId,
  computePrice,
  formatPrice,
  onSelect,
  isAdmin,
  allProducts = [],
}: PcComponentPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedEntry = selectedProductId ? options.find((entry) => entry.product.id === selectedProductId) ?? null : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-10 w-full justify-between rounded-xl border-border/70 bg-background px-3 py-2"
        >
          <div className="min-w-0 text-left">
            {selectedEntry ? (
              <>
                <p className="truncate text-sm font-medium text-foreground">{getProductDisplayName(selectedEntry.product)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatPrice(computePrice(selectedEntry.product, 1).totalWithIVA)}
                </p>
              </>
            ) : (
              <p className="truncate text-sm text-muted-foreground">Elegir {PC_COMPONENT_LABELS[componentType]}</p>
            )}
          </div>
          <ChevronsUpDown size={14} className="ml-2 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder={`Buscar ${PC_COMPONENT_LABELS[componentType]}...`} />
          <CommandList className="max-h-80 overflow-y-auto">
            <CommandEmpty>Sin resultados para el filtro actual.</CommandEmpty>
            
            <CommandGroup heading="Sugeridos (Compatibles)">
              {options.length === 0 && !isAdmin && (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-muted-foreground italic">No se encontraron productos compatibles en esta categoría.</p>
                </div>
              )}
              {options.map((entry) => {
                const isSelected = selectedProductId === entry.product.id;
                const imageSrc = resolveProductImageUrl(entry.product.image);
                return (
                  <CommandItem
                    key={entry.product.id}
                    value={`${entry.product.id} ${getProductDisplayName(entry.product)} ${entry.product.sku ?? ""} ${entry.product.brand_name ?? ""}`}
                    onSelect={() => {
                      onSelect(String(entry.product.id));
                      setOpen(false);
                    }}
                    className="flex items-start gap-2 py-2 cursor-pointer"
                  >
                    <img
                      src={imageSrc}
                      alt={getProductDisplayName(entry.product)}
                      className="h-10 w-10 shrink-0 rounded-md border border-border/70 bg-background object-contain p-1"
                      onError={(e) => { e.currentTarget.src = "/placeholder.png"; }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{getProductDisplayName(entry.product)}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <p className="text-[11px] font-medium text-primary/80">
                          {formatPrice(computePrice(entry.product, 1).totalWithIVA)}
                        </p>
                        <span className="text-[10px] text-muted-foreground/60">•</span>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {[
                            entry.specs.socket,
                            entry.specs.memory_type,
                            entry.specs.form_factor?.[0],
                            entry.specs.wattage ? `${entry.specs.wattage}W` : "",
                          ].filter(Boolean).join(" · ") || "Sin specs"}
                        </p>
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="mt-0.5 shrink-0 text-primary" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {isAdmin && allProducts.length > 0 && (
              <CommandGroup heading="Catálogo Completo (Admin - Forzar)">
                {allProducts
                  .filter(p => !options.some(o => o.product.id === p.id))
                  .slice(0, 50)
                  .map((product) => (
                    <CommandItem
                      key={product.id}
                      value={`admin-force ${product.id} ${product.name} ${product.sku ?? ""} ${product.brand_name ?? ""}`}
                      onSelect={() => {
                        onSelect(String(product.id));
                        setOpen(false);
                      }}
                      className="flex items-start gap-2 py-2 opacity-70 hover:opacity-100"
                    >
                      <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md border border-dashed border-border/70 bg-muted/30">
                        <Package size={16} className="text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{product.name}</p>
                        <p className="text-[10px] text-muted-foreground">SKU: {product.sku || "N/A"} • Bruta: {product.category || "General"}</p>
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}

            {selectedProductId && (
              <CommandGroup>
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onSelect("");
                    setOpen(false);
                  }}
                  className="justify-center text-xs text-red-500 font-medium py-2"
                >
                  Limpiar selección
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function PcBuilderPanel({
  products,
  computePrice,
  formatPrice,
  onAddToCart,
  profileId,
  clientName,
  currency,
  onCreateQuote,
}: PcBuilderPanelProps) {
  const [selection, setSelection] = useState<PcBuildSelection>({});
  const [quantities, setQuantities] = useState<Partial<Record<PcComponentType, number>>>({});
  const [cleanupMessages, setCleanupMessages] = useState<string[]>([]);
  const [mode, setMode] = useState<PcBuilderMode>("guided");
  const [goal, setGoal] = useState<PcBuilderGoal>("office");
  const [priority, setPriority] = useState<PcBuilderPriority>("balanced");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [draftName, setDraftName] = useState("");
  const [currentDraftId, setCurrentDraftId] = useState<string | undefined>(undefined);
  const [loadingDraftId, setLoadingDraftId] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [creatingQuote, setCreatingQuote] = useState(false);

  const { drafts, loading: draftsLoading, saveDraft, deleteDraft, getDraft } = usePcBuilds(profileId);

  const catalogEntries = useMemo(
    () => buildPcCatalogEntries(products, { includeInactive: false, includeUnknownType: false }),
    [products],
  );

  const entryByProductId = useMemo(() => {
    const map = new Map<number, PcCatalogEntry>();
    catalogEntries.forEach((entry) => map.set(entry.product.id, entry));
    return map;
  }, [catalogEntries]);

  const optionsByType = useMemo(() => {
    const grouped = {} as Record<PcComponentType, PcCatalogEntry[]>;
    PC_COMPONENT_ORDER.forEach((type) => {
      grouped[type] = catalogEntries.filter((entry) => entry.componentType === type && entry.eligible);
    });
    return grouped;
  }, [catalogEntries]);

  const buildSelectedEntryMap = useCallback(
    (draftSelection: PcBuildSelection): Partial<Record<PcComponentType, PcCatalogEntry>> => {
      const map: Partial<Record<PcComponentType, PcCatalogEntry>> = {};
      PC_COMPONENT_ORDER.forEach((type) => {
        const selectedProductId = draftSelection[type];
        if (!selectedProductId) return;
        const entry = entryByProductId.get(selectedProductId);
        if (!entry || !entry.eligible || entry.componentType !== type) return;
        map[type] = entry;
      });
      return map;
    },
    [entryByProductId],
  );

  const sanitizeSelection = useCallback(
    (draftSelection: PcBuildSelection, draftQuantities: Partial<Record<PcComponentType, number>>) => {
      const nextSelection: PcBuildSelection = {};
      const nextQuantities: Partial<Record<PcComponentType, number>> = {};
      const reasons: string[] = [];

      PC_COMPONENT_ORDER.forEach((type) => {
        const selectedProductId = draftSelection[type];
        if (!selectedProductId) return;
        const entry = entryByProductId.get(selectedProductId);
        if (!entry || entry.componentType !== type || !entry.eligible) {
          reasons.push(`${PC_COMPONENT_LABELS[type]} se limpió por falta de specs críticas.`);
          return;
        }
        const prerequisite = PC_COMPONENT_PREREQUISITES[type];
        if (prerequisite && !nextSelection[prerequisite]) return;
        const compatibility = evaluatePcCompatibility(
          buildSelectedEntryMap({ ...nextSelection, [type]: selectedProductId }),
          { quantities: draftQuantities, goal },
        );
        if (!compatibility.compatible) {
          reasons.push(`${PC_COMPONENT_LABELS[type]} se limpió: ${compatibility.reasons[0]}.`);
          return;
        }
        nextSelection[type] = selectedProductId;
        nextQuantities[type] = Math.max(1, Number(draftQuantities[type] ?? 1));
      });

      return { selection: nextSelection, quantities: nextQuantities, reasons: Array.from(new Set(reasons)) };
    },
    [buildSelectedEntryMap, entryByProductId, goal],
  );

  const applySanitizedState = useCallback(
    (nextSelection: PcBuildSelection, nextQuantities: Partial<Record<PcComponentType, number>>, notify = true) => {
      const sanitized = sanitizeSelection(nextSelection, nextQuantities);
      setSelection(sanitized.selection);
      setQuantities(sanitized.quantities);
      setCleanupMessages(sanitized.reasons);
      if (notify && sanitized.reasons.length > 0) toast.warning("Se limpiaron componentes incompatibles.");
    },
    [sanitizeSelection],
  );

  useEffect(() => {
    const sanitized = sanitizeSelection(selection, quantities);
    if (!shallowEqualSelection(selection, sanitized.selection) || !shallowEqualQuantity(quantities, sanitized.quantities)) {
      setSelection(sanitized.selection);
      setQuantities(sanitized.quantities);
      setCleanupMessages(sanitized.reasons);
    }
  }, [catalogEntries, quantities, sanitizeSelection, selection]);

  const selectedLineItems = useMemo(() => {
    return PC_COMPONENT_ORDER.flatMap((componentType) => {
      const selectedProductId = selection[componentType];
      if (!selectedProductId) return [];
      const entry = entryByProductId.get(selectedProductId);
      if (!entry) return [];
      const quantity = Math.max(1, Number(quantities[componentType] ?? 1));
      const pricing = computePrice(entry.product, quantity);
      return [{ componentType, entry, quantity, pricing }];
    });
  }, [computePrice, entryByProductId, quantities, selection]);

  const estimatedTotal = useMemo(
    () => selectedLineItems.reduce((sum, line) => sum + line.pricing.totalWithIVA, 0),
    [selectedLineItems],
  );
  const missingComponents = useMemo(
    () => PC_REQUIRED_COMPONENTS.filter((componentType) => !selection[componentType]),
    [selection],
  );
  const selectedRequiredCount = useMemo(
    () => PC_REQUIRED_COMPONENTS.filter((componentType) => Boolean(selection[componentType])).length,
    [selection],
  );
  const buildDiscount = useMemo(() => getPcBuildDiscount(estimatedTotal, currency), [currency, estimatedTotal]);
  const discountedTotal = useMemo(() => Math.max(0, estimatedTotal - buildDiscount.amount), [buildDiscount.amount, estimatedTotal]);
  const selectedEntryMap = useMemo(() => buildSelectedEntryMap(selection), [buildSelectedEntryMap, selection]);
  const profilePreset = useMemo(() => getPcBuildProfilePreset(goal), [goal]);
  const recommendedPsu = useMemo(
    () => estimatePsuRequirement(selectedEntryMap.cpu?.specs.tdp_w, selectedEntryMap.gpu?.specs.tdp_w, goal),
    [goal, selectedEntryMap.cpu?.specs.tdp_w, selectedEntryMap.gpu?.specs.tdp_w],
  );
  const compatibilitySnapshot = useMemo(
    () => evaluatePcCompatibility(selectedEntryMap, { quantities, goal }),
    [goal, quantities, selectedEntryMap],
  );

  const getFilteredOptionsForStep = useCallback(
    (componentType: PcComponentType): PcCatalogEntry[] => {
      const baseSelection: PcBuildSelection = { ...selection };
      delete baseSelection[componentType];

      const baseReasons = evaluatePcCompatibility(buildSelectedEntryMap(baseSelection), { quantities, goal }).reasons;
      return (optionsByType[componentType] ?? [])
        .filter((entry) => {
          const nextReasons = evaluatePcCompatibility(
            buildSelectedEntryMap({ ...baseSelection, [componentType]: entry.product.id }),
            { quantities, goal },
          ).reasons;
          return !nextReasons.some((reason) => !baseReasons.includes(reason));
        })
        .sort(
          (left, right) =>
            computePrice(left.product, 1).totalWithIVA - computePrice(right.product, 1).totalWithIVA,
        );
    },
    [buildSelectedEntryMap, computePrice, goal, optionsByType, quantities, selection],
  );

  const isBuildComplete = missingComponents.length === 0;
  const hasEligiblePcCatalog = catalogEntries.some((entry) => entry.eligible);

  const updateStepSelection = (componentType: PcComponentType, productIdRaw: string) => {
    const nextSelection = { ...selection };
    if (!productIdRaw) delete nextSelection[componentType];
    else nextSelection[componentType] = Number(productIdRaw);
    setCurrentDraftId(undefined);
    applySanitizedState(nextSelection, quantities);
  };

  const updateStepQuantity = (componentType: PcComponentType, nextQuantity: number) => {
    setCurrentDraftId(undefined);
    applySanitizedState(selection, {
      ...quantities,
      [componentType]: Math.max(1, Math.floor(nextQuantity || 1)),
    }, false);
  };

  const generateGuidedSelection = () => {
    const maxBudget = Number(budgetMax || 0);
    let runningTotal = 0;
    const nextSelection: PcBuildSelection = {};
    const nextQuantities: Partial<Record<PcComponentType, number>> = {};

    for (const componentType of PC_COMPONENT_ORDER) {
      const prerequisite = PC_COMPONENT_PREREQUISITES[componentType];
      if (prerequisite && !nextSelection[prerequisite]) continue;

      const candidates = (optionsByType[componentType] ?? []).filter((entry) =>
        evaluatePcCompatibility(buildSelectedEntryMap({ ...nextSelection, [componentType]: entry.product.id }), {
          quantities: nextQuantities,
          goal,
        }).compatible,
      );
      if (candidates.length === 0) continue;
      const ranked = rankByPriority(candidates, componentType, priority, goal, computePrice);
      let chosen = priority === "balanced" ? ranked[Math.floor((ranked.length - 1) / 2)] : ranked[0];
      const qty = componentType === "ram" && goal === "workstation" ? 2 : 1;
      if (maxBudget > 0) {
        const within = ranked.find((entry) => runningTotal + computePrice(entry.product, qty).totalWithIVA <= maxBudget);
        if (within) chosen = within;
      }
      nextSelection[componentType] = chosen.product.id;
      nextQuantities[componentType] = qty;
      runningTotal += computePrice(chosen.product, qty).totalWithIVA;
    }

    setCurrentDraftId(undefined);
    applySanitizedState(nextSelection, nextQuantities, false);
    toast.success("Base guiada generada.");
  };

  const handleSaveDraft = async () => {
    if (!profileId || selectedLineItems.length === 0) return;
    setSavingDraft(true);
    try {
      const saved = await saveDraft({
        id: currentDraftId,
        name: draftName.trim() || `Armado ${clientName ?? "Cliente"} ${new Date().toLocaleDateString("es-AR")}`,
        mode,
        goal,
        budgetMin: budgetMin ? Number(budgetMin) : undefined,
        budgetMax: budgetMax ? Number(budgetMax) : undefined,
        currency,
        priority,
        status: "draft",
        items: toDraftItems(selectedLineItems),
      });
      if (!saved) {
        toast.error("No se pudo guardar el borrador.");
        return;
      }
      setCurrentDraftId(saved.id);
      setDraftName(saved.name);
      toast.success("Borrador guardado.");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleLoadDraft = (draftId: string) => {
    if (!draftId) return;
    const draft = getDraft(draftId);
    if (!draft) return;
    const nextSelection: PcBuildSelection = {};
    const nextQuantities: Partial<Record<PcComponentType, number>> = {};
    draft.items.forEach((item) => {
      const entry = entryByProductId.get(item.productId);
      if (!entry?.componentType) return;
      nextSelection[entry.componentType] = item.productId;
      nextQuantities[entry.componentType] = item.quantity;
    });
    setMode(draft.mode);
    setGoal(draft.goal ?? "office");
    setPriority(draft.priority ?? "balanced");
    setBudgetMin(draft.budgetMin != null ? String(draft.budgetMin) : "");
    setBudgetMax(draft.budgetMax != null ? String(draft.budgetMax) : "");
    setCurrentDraftId(draft.id);
    setDraftName(draft.name);
    applySanitizedState(nextSelection, nextQuantities, false);
    toast.success(`Borrador "${draft.name}" cargado.`);
  };

  const handleDeleteDraft = async (draft: PcBuildDraft) => {
    const ok = await deleteDraft(draft.id);
    if (!ok) return toast.error("No se pudo eliminar el borrador.");
    if (currentDraftId === draft.id) {
      setCurrentDraftId(undefined);
      setDraftName("");
    }
    toast.success("Borrador eliminado.");
  };

  const handleAddAllToCart = () => {
    if (!isBuildComplete) return toast.error("Completá todos los pasos antes de agregar al carrito.");
    selectedLineItems.forEach((line) => onAddToCart(line.entry.product, line.quantity));
    toast.success("Configuración agregada al carrito.");
  };

  const handleCreateQuote = async () => {
    if (!onCreateQuote || !isBuildComplete) return;
    setCreatingQuote(true);
    try {
      const ok = await onCreateQuote({
        buildId: currentDraftId,
        discount: buildDiscount,
        items: selectedLineItems.map((line) => ({
          componentType: line.componentType,
          product: line.entry.product,
          quantity: line.quantity,
          pricing: line.pricing,
        })),
      });
      if (!ok) return toast.error("No se pudo crear la cotización.");
      toast.success("Cotización creada.");
    } finally {
      setCreatingQuote(false);
    }
  };

  if (!hasEligiblePcCatalog) {
    return (
      <EmptyState
        className="rounded-[24px]"
        icon={<Sparkles size={22} />}
        title="Armador PC sin productos elegibles"
        description="No hay componentes con specs críticas completas. Completá datos técnicos en Admin para habilitar el armador."
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Armador PC"
        title="Armado dependiente y compatible"
        description="Unificación completa: modo guiado/manual, borradores y cotización, manteniendo filtro estricto."
      />

      <SurfaceCard padding="md" className="rounded-[24px] border-border/70 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={mode === "guided" ? "default" : "outline"} onClick={() => setMode("guided")}>Guiado</Button>
          <Button size="sm" variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")}>Manual</Button>
          <Badge variant="muted">{selectedRequiredCount}/{PC_REQUIRED_COMPONENTS.length} obligatorios</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <select value={goal} onChange={(e) => setGoal(e.target.value as PcBuilderGoal)} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm">
            <option value="office">Objetivo: Oficina</option>
            <option value="gaming">Objetivo: Gaming</option>
            <option value="workstation">Objetivo: Workstation</option>
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value as PcBuilderPriority)} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm">
            <option value="price">Prioridad: Precio</option>
            <option value="balanced">Prioridad: Balance</option>
            <option value="performance">Prioridad: Performance</option>
          </select>
          <input value={budgetMin} onChange={(e) => setBudgetMin(e.target.value.replace(/[^\d.]/g, ""))} placeholder={`Presupuesto min (${currency})`} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm" />
          <input value={budgetMax} onChange={(e) => setBudgetMax(e.target.value.replace(/[^\d.]/g, ""))} placeholder={`Presupuesto max (${currency})`} className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm" />
        </div>
        {mode === "guided" && (
          <Button variant="outline" onClick={generateGuidedSelection}>
            <Sparkles size={14} />
            Generar base guiada
          </Button>
        )}
      </SurfaceCard>

      {cleanupMessages.length > 0 && (
        <SurfaceCard padding="sm" className="rounded-[20px] border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2 text-sm font-bold">
            <AlertTriangle size={16} className="text-amber-500" /> 
            Configuración ajustada automáticamente
          </div>
          <p className="mt-1 text-[11px] leading-relaxed opacity-90">
            Algunos componentes fueron removidos para mantener la compatibilidad técnica del equipo:
          </p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {cleanupMessages.map((msg) => (
              <li key={msg} className="flex items-start gap-1.5 text-[11px]">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                {msg}
              </li>
            ))}
          </ul>
        </SurfaceCard>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <SurfaceCard padding="md" className="rounded-[24px] border-border/70 space-y-3">
          {PC_COMPONENT_ORDER.map((componentType, index) => {
            const prerequisite = PC_COMPONENT_PREREQUISITES[componentType];
            const isBlocked = prerequisite ? !selection[prerequisite] : false;
            const options = getFilteredOptionsForStep(componentType);
            const selectedEntry = selection[componentType] ? entryByProductId.get(selection[componentType] as number) : null;
            return (
              <div key={componentType} className="rounded-xl border border-border/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{index + 1}. {PC_COMPONENT_LABELS[componentType]}</p>
                  <Badge variant="muted">{options.length} opciones</Badge>
                </div>
                {isBlocked ? (
                  <p className="mt-2 text-xs text-muted-foreground">Seleccioná antes {PC_COMPONENT_LABELS[prerequisite as PcComponentType]}.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <PcComponentPicker
                      componentType={componentType}
                      options={options}
                      selectedProductId={selection[componentType]}
                      computePrice={computePrice}
                      formatPrice={formatPrice}
                      onSelect={(value) => updateStepSelection(componentType, value)}
                    />
                    {selectedEntry && (
                      <div className="space-y-1">
                        <div className="text-xs text-muted-foreground">
                          {[
                            selectedEntry.specs.socket,
                            selectedEntry.specs.memory_type,
                            selectedEntry.specs.form_factor?.join(", "),
                            selectedEntry.specs.wattage ? `${selectedEntry.specs.wattage}W` : "",
                          ].filter(Boolean).join(" · ")}
                        </div>
                        <input
                          type="number"
                          min={1}
                          value={quantities[componentType] ?? 1}
                          onChange={(e) => updateStepQuantity(componentType, Number(e.target.value))}
                          className="h-8 w-24 rounded-lg border border-border/70 bg-background px-2 text-sm"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </SurfaceCard>

        <div className="space-y-4">
          <SurfaceCard padding="md" className="rounded-[24px] border-border/70 space-y-3">
            <p className="text-sm font-semibold">Resumen</p>
            <div className="text-xs text-muted-foreground">
              PSU recomendado: <span className="text-foreground font-semibold">{recommendedPsu}W</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[10px]">Perfil: {profilePreset.label}</Badge>
              <Badge variant="muted" className="text-[10px]">Ruido: {profilePreset.noise}</Badge>
              <Badge variant="muted" className="text-[10px]">Consumo: {profilePreset.power}</Badge>
              <Badge variant="muted" className="text-[10px]">Perf: {profilePreset.performance}</Badge>
            </div>
            <div className="grid grid-cols-5 gap-2 py-1">
              {PC_COMPONENT_ORDER.map((type) => {
                const isSelected = Boolean(selection[type]);
                const Icon = {
                  cpu: Cpu,
                  motherboard: Zap,
                  ram: Sparkles,
                  gpu: Monitor,
                  storage: HardDrive,
                  storage_secondary: HardDrive,
                  psu: Zap,
                  case: Sparkles,
                  cooler: Zap,
                  monitor: Monitor,
                }[type] || Check;
                return (
                  <div key={type} className={`flex flex-col items-center justify-center rounded-lg border p-2 transition-colors ${isSelected ? "border-primary/50 bg-primary/10 text-primary" : "border-border/40 bg-muted/20 text-muted-foreground/40"}`}>
                    <Icon size={16} />
                    <span className="mt-1 text-[8px] font-bold uppercase">{PC_COMPONENT_LABELS[type].split(" ")[0]}</span>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total estimado</p>
                  <p className="text-2xl font-black text-primary">{formatPrice(estimatedTotal)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Performance</p>
                  <div className="flex items-center gap-0.5 mt-0.5">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const score = goal === "gaming" ? 5 : goal === "workstation" ? 4 : 3;
                      return <Sparkles key={star} size={12} className={star <= score && isBuildComplete ? "text-amber-500 fill-amber-500" : "text-muted-foreground/30"} />;
                    })}
                  </div>
                </div>
              </div>
              <div className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Descuento por armado
                  </p>
                  <Badge variant={buildDiscount.percentage > 0 ? "success" : "muted"} className="text-[10px]">
                    {buildDiscount.percentage > 0 ? `${buildDiscount.percentage}%` : "0%"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                  Tramos: 2% / 4% / 5% según monto total.
                </p>
                {buildDiscount.percentage > 0 ? (
                  <p className="mt-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Ahorro: {formatPrice(buildDiscount.amount)} ({buildDiscount.label}) → Total final: {formatPrice(discountedTotal)}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-muted-foreground">Completá el armado para aplicar descuento por tramo.</p>
                )}
              </div>
              {isBuildComplete ? (
                <p className="mt-2 text-xs text-primary inline-flex items-center gap-1">
                  <CheckCircle2 size={13} /> Build completo y compatible
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Faltan: {missingComponents.map((type) => PC_COMPONENT_LABELS[type]).join(", ")}
                </p>
              )}
              {compatibilitySnapshot.warnings.length > 0 && (
                <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">Alertas técnicas</p>
                  <ul className="mt-1 space-y-1">
                    {compatibilitySnapshot.warnings.slice(0, 4).map((warning) => (
                      <li key={warning} className="text-xs text-amber-700 dark:text-amber-300">{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <Button className="w-full" disabled={!isBuildComplete} onClick={handleAddAllToCart}>
              <ShoppingCart size={14} />
              Agregar configuración al carrito
            </Button>
            {onCreateQuote && (
              <Button className="w-full" variant="outline" disabled={!isBuildComplete || creatingQuote} onClick={() => void handleCreateQuote()}>
                <Wallet size={14} />
                {creatingQuote ? "Generando cotización..." : "Guardar cotización"}
              </Button>
            )}
            <Button
              className="w-full"
              variant="ghost"
              size="sm"
              disabled={selectedLineItems.length === 0}
              onClick={() => {
                const text = selectedLineItems.map((l) => `${PC_COMPONENT_LABELS[l.componentType]}: ${getProductDisplayName(l.entry.product)}`).join("\n");
                void navigator.clipboard.writeText(`Mi configuracion PC Bartez:\n${text}\nTotal: ${formatPrice(estimatedTotal)}`);
                toast.success("Configuración copiada al portapapeles.");
              }}
            >
              <Share size={14} />
              Compartir configuración
            </Button>
            <div className="rounded-xl border border-border/70 bg-surface/70 px-3 py-2 text-xs text-muted-foreground">
              Specs usadas: {[getCanonicalKeyLabel("socket"), getCanonicalKeyLabel("memory_type"), getCanonicalKeyLabel("form_factor"), getCanonicalKeyLabel("interface")].join(", ")}.
            </div>
          </SurfaceCard>

          <SurfaceCard padding="md" className="rounded-[24px] border-border/70 space-y-3">
            <p className="text-sm font-semibold">Borradores</p>
            <input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Nombre del borrador" className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm" />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!profileId || savingDraft || selectedLineItems.length === 0} onClick={() => void handleSaveDraft()}>
                <Save size={14} />
                {savingDraft ? "Guardando..." : "Guardar"}
              </Button>
              <select value={loadingDraftId} onChange={(e) => setLoadingDraftId(e.target.value)} className="h-9 min-w-[160px] rounded-lg border border-border/70 bg-background px-3 text-sm">
                <option value="">Elegir</option>
                {drafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.name}</option>)}
              </select>
              <Button size="sm" variant="outline" disabled={!loadingDraftId} onClick={() => handleLoadDraft(loadingDraftId)}>
                <FolderOpen size={14} />
                Cargar
              </Button>
            </div>
            {draftsLoading ? (
              <p className="text-xs text-muted-foreground">Cargando borradores...</p>
            ) : (
              <div className="space-y-2">
                {drafts.slice(0, 4).map((draft) => (
                  <div key={draft.id} className="rounded-xl border border-border/70 p-2">
                    <p className="text-sm font-medium">{draft.name}</p>
                    <p className="text-xs text-muted-foreground">{draft.items.length} items</p>
                    <div className="mt-1 flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handleLoadDraft(draft.id)}>Cargar</Button>
                      <Button size="sm" variant="ghost" onClick={() => void handleDeleteDraft(draft)}>Eliminar</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
