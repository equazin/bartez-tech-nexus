import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Cpu,
  FolderOpen,
  Gamepad2,
  HardDrive,
  Lock,
  Monitor,
  Package,
  Pencil,
  Save,
  Server,
  Share,
  ShoppingCart,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  Zap,
  ZapOff,
} from "lucide-react";
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

/* ─────────────────────────────────────── types ─────────────────────────────────────── */

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

/* ─────────────────────────────── build presets (templates) ─────────────────────────── */

interface BuildPreset {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  goal: PcBuilderGoal;
  priority: PcBuilderPriority;
  colorClass: string;
  badgeClass: string;
}

const BUILD_PRESETS: BuildPreset[] = [
  {
    id: "office",
    icon: <BriefcaseBusiness size={18} />,
    label: "Oficina",
    description: "Estable, silencioso y eficiente para tareas administrativas",
    goal: "office",
    priority: "price",
    colorClass: "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10",
    badgeClass: "text-blue-600 dark:text-blue-300",
  },
  {
    id: "gaming",
    icon: <Gamepad2 size={18} />,
    label: "Gaming",
    description: "Alto rendimiento gráfico para juegos y entretenimiento",
    goal: "gaming",
    priority: "performance",
    colorClass: "border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10",
    badgeClass: "text-violet-600 dark:text-violet-300",
  },
  {
    id: "workstation",
    icon: <Server size={18} />,
    label: "Workstation",
    description: "Multitarea intensa: diseño, render, desarrollo y análisis",
    goal: "workstation",
    priority: "balanced",
    colorClass: "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10",
    badgeClass: "text-emerald-600 dark:text-emerald-300",
  },
];

/* ─────────────────────────────── component slot icons ──────────────────────────────── */

const SLOT_ICONS: Record<PcComponentType, React.ElementType> = {
  cpu: Cpu,
  motherboard: Zap,
  ram: TrendingUp,
  gpu: Monitor,
  storage: HardDrive,
  storage_secondary: HardDrive,
  psu: Zap,
  case: Package,
  cooler: Sparkles,
  monitor: Monitor,
};

/* ──────────────────────────────────── helpers ──────────────────────────────────────── */

function getProductDisplayName(product: Product): string {
  return product.name_custom?.trim() || product.name_original?.trim() || product.name;
}

function shallowEqualSelection(left: PcBuildSelection, right: PcBuildSelection): boolean {
  return PC_COMPONENT_ORDER.every((t) => left[t] === right[t]);
}

function shallowEqualQuantity(
  left: Partial<Record<PcComponentType, number>>,
  right: Partial<Record<PcComponentType, number>>,
): boolean {
  return PC_COMPONENT_ORDER.every((t) => (left[t] ?? 1) === (right[t] ?? 1));
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
    (l, r) => computePrice(l.product, 1).totalWithIVA - computePrice(r.product, 1).totalWithIVA,
  );
  if (priority === "price" || goal === "office") return byPrice;
  if (priority === "performance" || (goal === "gaming" && componentType === "gpu")) {
    return [...options].sort((l, r) => {
      const ls = (l.specs.tdp_w ?? 0) + (l.specs.wattage ?? 0) + computePrice(l.product, 1).totalWithIVA / 1000;
      const rs = (r.specs.tdp_w ?? 0) + (r.specs.wattage ?? 0) + computePrice(r.product, 1).totalWithIVA / 1000;
      return rs - ls;
    });
  }
  return byPrice;
}

/* ────────────────────────────── PcComponentPicker ─────────────────────────────────── */

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
  const selectedEntry = selectedProductId ? options.find((e) => e.product.id === selectedProductId) ?? null : null;

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

            <CommandGroup heading="Compatibles">
              {options.length === 0 && !isAdmin && (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-muted-foreground italic">No se encontraron productos compatibles en esta categoría.</p>
                </div>
              )}
              {options.map((entry) => {
                const isSelected = selectedProductId === entry.product.id;
                const imageSrc = resolveProductImageUrl(entry.product.image);
                const stockOk = (entry.product.stock ?? 0) > 0;
                return (
                  <CommandItem
                    key={entry.product.id}
                    value={`${entry.product.id} ${getProductDisplayName(entry.product)} ${entry.product.sku ?? ""} ${entry.product.brand_name ?? ""}`}
                    onSelect={() => { onSelect(String(entry.product.id)); setOpen(false); }}
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
                        {!stockOk && (
                          <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 uppercase">Sin stock</span>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check size={14} className="mt-0.5 shrink-0 text-primary" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {isAdmin && allProducts.length > 0 && (
              <CommandGroup heading="Catálogo Completo (Admin — Forzar)">
                {allProducts
                  .filter((p) => !options.some((o) => o.product.id === p.id))
                  .slice(0, 50)
                  .map((product) => (
                    <CommandItem
                      key={product.id}
                      value={`admin-force ${product.id} ${product.name} ${product.sku ?? ""} ${product.brand_name ?? ""}`}
                      onSelect={() => { onSelect(String(product.id)); setOpen(false); }}
                      className="flex items-start gap-2 py-2 opacity-70 hover:opacity-100"
                    >
                      <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md border border-dashed border-border/70 bg-muted/30">
                        <Package size={16} className="text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{product.name}</p>
                        <p className="text-[10px] text-muted-foreground">SKU: {product.sku || "N/A"} · {product.category || "General"}</p>
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}

            {selectedProductId && (
              <CommandGroup>
                <CommandItem
                  value="__clear__"
                  onSelect={() => { onSelect(""); setOpen(false); }}
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

/* ────────────────────────────── SlotCompatibilityIndicator ─────────────────────────── */

type SlotStatus = "empty" | "selected-ok" | "selected-warning" | "selected-error" | "blocked";

function getSlotStatus(
  componentType: PcComponentType,
  isBlocked: boolean,
  isSelected: boolean,
  compatibilityWarnings: string[],
  compatibilityErrors: string[],
  psuUnderRated: boolean,
): SlotStatus {
  if (isBlocked) return "blocked";
  if (!isSelected) return "empty";
  if (componentType === "psu" && psuUnderRated) return "selected-error";
  if (compatibilityErrors.length > 0) return "selected-error";
  if (compatibilityWarnings.length > 0) return "selected-warning";
  return "selected-ok";
}

function SlotStatusBadge({ status }: { status: SlotStatus }) {
  if (status === "empty" || status === "blocked") return null;
  if (status === "selected-ok")
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15"><Check size={11} className="text-emerald-500" /></span>;
  if (status === "selected-warning")
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15"><AlertTriangle size={11} className="text-amber-500" /></span>;
  // error
  return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/15"><ZapOff size={11} className="text-red-500" /></span>;
}

/* ────────────────────────────────── main panel ─────────────────────────────────────── */

export function PcBuilderPanel({
  products,
  computePrice,
  formatPrice,
  onAddToCart,
  profileId,
  clientName,
  currency,
  isAdmin,
  allProducts,
  onCreateQuote,
}: PcBuilderPanelProps) {
  const [selection, setSelection] = useState<PcBuildSelection>({});
  const [quantities, setQuantities] = useState<Partial<Record<PcComponentType, number>>>({});
  const [fleetQty, setFleetQty] = useState(1);
  const [cleanupMessages, setCleanupMessages] = useState<string[]>([]);
  const [mode, setMode] = useState<PcBuilderMode>("guided");
  const [goal, setGoal] = useState<PcBuilderGoal>("office");
  const [priority, setPriority] = useState<PcBuilderPriority>("balanced");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [draftName, setDraftName] = useState("");
  const [currentDraftId, setCurrentDraftId] = useState<string | undefined>(undefined);
  const [editingDraftName, setEditingDraftName] = useState(false);
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
    catalogEntries.forEach((e) => map.set(e.product.id, e));
    return map;
  }, [catalogEntries]);

  const optionsByType = useMemo(() => {
    const grouped = {} as Record<PcComponentType, PcCatalogEntry[]>;
    PC_COMPONENT_ORDER.forEach((type) => {
      grouped[type] = catalogEntries.filter((e) => e.componentType === type && e.eligible);
    });
    return grouped;
  }, [catalogEntries]);

  const buildSelectedEntryMap = useCallback(
    (draftSelection: PcBuildSelection): Partial<Record<PcComponentType, PcCatalogEntry>> => {
      const map: Partial<Record<PcComponentType, PcCatalogEntry>> = {};
      PC_COMPONENT_ORDER.forEach((type) => {
        const id = draftSelection[type];
        if (!id) return;
        const entry = entryByProductId.get(id);
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
        const id = draftSelection[type];
        if (!id) return;
        const entry = entryByProductId.get(id);
        if (!entry || entry.componentType !== type || !entry.eligible) {
          reasons.push(`${PC_COMPONENT_LABELS[type]} se limpió por falta de specs críticas.`);
          return;
        }
        const prerequisite = PC_COMPONENT_PREREQUISITES[type];
        if (prerequisite && !nextSelection[prerequisite]) return;
        const compatibility = evaluatePcCompatibility(
          buildSelectedEntryMap({ ...nextSelection, [type]: id }),
          { quantities: draftQuantities, goal },
        );
        if (!compatibility.compatible) {
          reasons.push(`${PC_COMPONENT_LABELS[type]} se limpió: ${compatibility.reasons[0]}.`);
          return;
        }
        nextSelection[type] = id;
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
      const id = selection[componentType];
      if (!id) return [];
      const entry = entryByProductId.get(id);
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
  const fleetTotal = estimatedTotal * Math.max(1, fleetQty);
  const missingComponents = useMemo(
    () => PC_REQUIRED_COMPONENTS.filter((t) => !selection[t]),
    [selection],
  );
  const selectedRequiredCount = useMemo(
    () => PC_REQUIRED_COMPONENTS.filter((t) => Boolean(selection[t])).length,
    [selection],
  );
  const buildDiscount = useMemo(() => getPcBuildDiscount(fleetTotal, currency), [currency, fleetTotal]);
  const discountedTotal = useMemo(() => Math.max(0, fleetTotal - buildDiscount.amount), [buildDiscount.amount, fleetTotal]);
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
  const isBuildComplete = missingComponents.length === 0;
  const hasEligiblePcCatalog = catalogEntries.some((e) => e.eligible);
  const progressPercent = Math.round((selectedRequiredCount / PC_REQUIRED_COMPONENTS.length) * 100);

  // PSU under-rated check
  const psuEntry = selectedEntryMap.psu;
  const psuUnderRated = Boolean(psuEntry?.specs.wattage && psuEntry.specs.wattage < recommendedPsu);

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
          return !nextReasons.some((r) => !baseReasons.includes(r));
        })
        .sort((l, r) => computePrice(l.product, 1).totalWithIVA - computePrice(r.product, 1).totalWithIVA);
    },
    [buildSelectedEntryMap, computePrice, goal, optionsByType, quantities, selection],
  );

  /* ── actions ── */

  const updateStepSelection = (componentType: PcComponentType, productIdRaw: string) => {
    const nextSelection = { ...selection };
    if (!productIdRaw) delete nextSelection[componentType];
    else nextSelection[componentType] = Number(productIdRaw);
    setCurrentDraftId(undefined);
    applySanitizedState(nextSelection, quantities);
  };

  const updateStepQuantity = (componentType: PcComponentType, nextQuantity: number) => {
    setCurrentDraftId(undefined);
    applySanitizedState(selection, { ...quantities, [componentType]: Math.max(1, Math.floor(nextQuantity || 1)) }, false);
  };

  const applyPreset = (preset: BuildPreset) => {
    setGoal(preset.goal);
    setPriority(preset.priority);
    setMode("guided");
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
        const within = ranked.find((e) => runningTotal + computePrice(e.product, qty).totalWithIVA <= maxBudget);
        if (within) chosen = within;
      }
      nextSelection[componentType] = chosen.product.id;
      nextQuantities[componentType] = qty;
      runningTotal += computePrice(chosen.product, qty).totalWithIVA;
    }

    setCurrentDraftId(undefined);
    applySanitizedState(nextSelection, nextQuantities, false);
    toast.success("Build generado automáticamente.");
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
      if (!saved) { toast.error("No se pudo guardar el borrador."); return; }
      setCurrentDraftId(saved.id);
      setDraftName(saved.name);
      setEditingDraftName(false);
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
    if (currentDraftId === draft.id) { setCurrentDraftId(undefined); setDraftName(""); }
    toast.success("Borrador eliminado.");
  };

  const handleAddAllToCart = () => {
    if (!isBuildComplete) return toast.error("Completá todos los pasos antes de agregar al carrito.");
    const times = Math.max(1, fleetQty);
    selectedLineItems.forEach((line) => onAddToCart(line.entry.product, line.quantity * times));
    toast.success(`${times > 1 ? `${times} equipos` : "Configuración"} agregada al carrito.`);
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
          quantity: line.quantity * Math.max(1, fleetQty),
          pricing: line.pricing,
        })),
      });
      if (!ok) return toast.error("No se pudo crear la cotización.");
      toast.success("Cotización creada.");
    } finally {
      setCreatingQuote(false);
    }
  };

  /* ── empty state ── */

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

  /* ── render ── */

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <PageHeader
        eyebrow="Armador de PC"
        title="Armá tu equipo ideal — Compatible garantizado"
        description={`Seleccioná componentes paso a paso. El sistema valida la compatibilidad técnica en tiempo real.${clientName ? ` · Cliente: ${clientName}` : ""}`}
      />

      {/* ── Fleet quantity ── */}
      <SurfaceCard padding="sm" className="rounded-[20px] border-border/70">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users size={15} className="text-muted-foreground" />
            <span>¿Cuántos equipos iguales necesitás?</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={fleetQty <= 1}
              onClick={() => setFleetQty((v) => Math.max(1, v - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-background text-sm font-bold hover:bg-muted/50 disabled:opacity-40"
            >−</button>
            <input
              type="number"
              min={1}
              max={999}
              value={fleetQty}
              onChange={(e) => setFleetQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              className="h-8 w-14 rounded-lg border border-border/70 bg-background px-2 text-center text-sm font-semibold"
            />
            <button
              type="button"
              onClick={() => setFleetQty((v) => Math.min(999, v + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-background text-sm font-bold hover:bg-muted/50"
            >+</button>
          </div>
          {fleetQty > 1 && (
            <Badge variant="outline" className="text-[11px]">
              Total flota: {formatPrice(fleetTotal)}
            </Badge>
          )}
        </div>
      </SurfaceCard>

      {/* ── Build presets ── */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Empezar desde una plantilla</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {BUILD_PRESETS.map((preset) => {
            const isActive = goal === preset.goal;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`group relative flex cursor-pointer flex-col gap-1.5 rounded-2xl border p-4 text-left transition-all ${preset.colorClass} ${isActive ? "ring-2 ring-primary/40" : ""}`}
              >
                <div className={`flex items-center gap-2 font-semibold text-sm ${preset.badgeClass}`}>
                  {preset.icon}
                  {preset.label}
                  {isActive && <Check size={13} className="ml-auto" />}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{preset.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Mode + filters ── */}
      <SurfaceCard padding="md" className="rounded-[24px] border-border/70 space-y-3">
        {/* Mode toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-border/70 overflow-hidden">
            <button
              type="button"
              onClick={() => setMode("guided")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${mode === "guided" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted/50"}`}
            >
              Guiado
            </button>
            <button
              type="button"
              onClick={() => setMode("manual")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${mode === "manual" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted/50"}`}
            >
              Manual
            </button>
          </div>
          <Badge variant="muted">{selectedRequiredCount}/{PC_REQUIRED_COMPONENTS.length} obligatorios</Badge>
        </div>

        {/* Goal + Priority as button groups */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Objetivo</p>
            <div className="flex rounded-xl border border-border/70 overflow-hidden">
              {(["office", "gaming", "workstation"] as PcBuilderGoal[]).map((g) => {
                const icon = g === "office" ? <BriefcaseBusiness size={13} /> : g === "gaming" ? <Gamepad2 size={13} /> : <Server size={13} />;
                const label = g === "office" ? "Oficina" : g === "gaming" ? "Gaming" : "Workstation";
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGoal(g)}
                    className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${goal === g ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted/50"}`}
                  >
                    {icon}{label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Prioridad</p>
            <div className="flex rounded-xl border border-border/70 overflow-hidden">
              {(["price", "balanced", "performance"] as PcBuilderPriority[]).map((p) => {
                const label = p === "price" ? "Precio" : p === "balanced" ? "Balance" : "Performance";
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex flex-1 items-center justify-center py-2 text-xs font-medium transition-colors ${priority === p ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted/50"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Budget range */}
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder={`Presupuesto mín (${currency})`}
            className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary/40"
          />
          <input
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder={`Presupuesto máx (${currency})`}
            className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        {mode === "guided" && (
          <Button variant="outline" onClick={generateGuidedSelection} className="gap-2">
            <Sparkles size={14} />
            Generar configuración automáticamente
          </Button>
        )}
      </SurfaceCard>

      {/* ── Progress bar ── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progreso del armado</span>
          <span className="font-semibold text-foreground">{selectedRequiredCount} / {PC_REQUIRED_COMPONENTS.length} componentes obligatorios</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isBuildComplete ? "bg-emerald-500" : "bg-primary"}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ── Cleanup alerts ── */}
      {cleanupMessages.length > 0 && (
        <SurfaceCard padding="sm" className="rounded-[20px] border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2 text-sm font-bold">
            <AlertTriangle size={16} className="text-amber-500" />
            Configuración ajustada automáticamente
          </div>
          <p className="mt-1 text-[11px] leading-relaxed opacity-90">
            Algunos componentes fueron removidos para mantener la compatibilidad técnica:
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

      {/* ─────────────── Main grid: slots + summary ─────────────── */}
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">

        {/* ── Slots column ── */}
        <SurfaceCard padding="md" className="rounded-[24px] border-border/70 space-y-3">
          {PC_COMPONENT_ORDER.map((componentType, index) => {
            const prerequisite = PC_COMPONENT_PREREQUISITES[componentType];
            const isBlocked = prerequisite ? !selection[prerequisite] : false;
            const isSelected = Boolean(selection[componentType]);
            const options = getFilteredOptionsForStep(componentType);
            const selectedEntry = selection[componentType] ? entryByProductId.get(selection[componentType] as number) : null;
            const SlotIcon = SLOT_ICONS[componentType];
            const isRequired = PC_REQUIRED_COMPONENTS.includes(componentType);

            // Per-slot compatibility context
            const thisSlotCompatibility = isSelected
              ? evaluatePcCompatibility(buildSelectedEntryMap(selection), { quantities, goal })
              : null;
            const slotErrors = thisSlotCompatibility?.reasons ?? [];
            const slotWarnings = thisSlotCompatibility?.warnings ?? [];
            const slotStatus = getSlotStatus(componentType, isBlocked, isSelected, slotWarnings, slotErrors, psuUnderRated && componentType === "psu");

            // PSU inline warning
            const showPsuWarning = componentType === "psu" && psuUnderRated && isSelected;

            return (
              <div
                key={componentType}
                className={`rounded-xl border p-3 transition-colors ${
                  slotStatus === "selected-error" ? "border-red-500/30 bg-red-500/5" :
                  slotStatus === "selected-warning" ? "border-amber-500/30 bg-amber-500/5" :
                  slotStatus === "selected-ok" ? "border-emerald-500/20 bg-emerald-500/5" :
                  isBlocked ? "border-border/40 bg-muted/20 opacity-60" :
                  "border-border/70"
                }`}
              >
                {/* Slot header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${isSelected ? "bg-primary/10 text-primary" : "bg-muted/40 text-muted-foreground"}`}>
                      {isBlocked ? <Lock size={13} /> : <SlotIcon size={13} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">
                        {index + 1}. {PC_COMPONENT_LABELS[componentType]}
                        {!isRequired && <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(opcional)</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <SlotStatusBadge status={slotStatus} />
                    {!isBlocked && options.length > 0 && (
                      <Badge variant="muted" className="text-[10px]">{options.length}</Badge>
                    )}
                  </div>
                </div>

                {/* Slot body */}
                {isBlocked ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Seleccioná antes {PC_COMPONENT_LABELS[prerequisite as PcComponentType]}.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    <PcComponentPicker
                      componentType={componentType}
                      options={options}
                      selectedProductId={selection[componentType]}
                      computePrice={computePrice}
                      formatPrice={formatPrice}
                      onSelect={(value) => updateStepSelection(componentType, value)}
                      isAdmin={isAdmin}
                      allProducts={allProducts}
                    />
                    {selectedEntry && (
                      <div className="space-y-1.5">
                        {/* Specs chips */}
                        <div className="flex flex-wrap gap-1">
                          {[
                            selectedEntry.specs.socket,
                            selectedEntry.specs.memory_type,
                            selectedEntry.specs.form_factor?.join(", "),
                            selectedEntry.specs.wattage ? `${selectedEntry.specs.wattage}W` : "",
                            selectedEntry.specs.tdp_w ? `TDP ${selectedEntry.specs.tdp_w}W` : "",
                          ].filter(Boolean).map((chip) => (
                            <span key={chip} className="rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {chip}
                            </span>
                          ))}
                          {(selectedEntry.product.stock ?? 0) <= 0 && (
                            <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                              Sin stock — consultar
                            </span>
                          )}
                        </div>
                        {/* PSU under-rated inline alert */}
                        {showPsuWarning && (
                          <div className="flex items-start gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5">
                            <ZapOff size={13} className="mt-0.5 shrink-0 text-red-500" />
                            <p className="text-[11px] text-red-700 dark:text-red-300 font-medium leading-snug">
                              Fuente insuficiente: tiene {psuEntry?.specs.wattage}W pero el build requiere al menos <strong>{recommendedPsu}W</strong>. Elegí una fuente más potente.
                            </p>
                          </div>
                        )}
                        {/* Quantity per component */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground">Unidad(es):</span>
                          <input
                            type="number"
                            min={1}
                            value={quantities[componentType] ?? 1}
                            onChange={(e) => updateStepQuantity(componentType, Number(e.target.value))}
                            className="h-7 w-16 rounded-lg border border-border/70 bg-background px-2 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </SurfaceCard>

        {/* ── Summary + Actions column ── */}
        <div className="space-y-4">

          {/* Summary card */}
          <SurfaceCard padding="md" className="rounded-[24px] border-border/70 space-y-3">
            <p className="text-sm font-semibold">Resumen del build</p>

            {/* Component mini grid */}
            <div className="grid grid-cols-5 gap-2">
              {PC_COMPONENT_ORDER.map((type) => {
                const isSelected = Boolean(selection[type]);
                const Icon = SLOT_ICONS[type];
                return (
                  <div
                    key={type}
                    className={`flex flex-col items-center justify-center rounded-lg border p-2 transition-colors ${
                      isSelected ? "border-primary/50 bg-primary/10 text-primary" : "border-border/40 bg-muted/20 text-muted-foreground/40"
                    }`}
                  >
                    <Icon size={15} />
                    <span className="mt-1 text-[8px] font-bold uppercase leading-tight text-center">
                      {PC_COMPONENT_LABELS[type].split(" ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* PSU recommendation */}
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap size={12} />
                PSU recomendado
              </div>
              <span className={`text-xs font-bold ${psuUnderRated ? "text-red-500" : "text-foreground"}`}>
                {recommendedPsu}W
              </span>
            </div>

            {/* Profile badges */}
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[10px]">Perfil: {profilePreset.label}</Badge>
              <Badge variant="muted" className="text-[10px]">Ruido: {profilePreset.noise}</Badge>
              <Badge variant="muted" className="text-[10px]">Consumo: {profilePreset.power}</Badge>
            </div>

            {/* Price breakdown */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 space-y-2">
              {fleetQty > 1 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Precio por equipo</span>
                  <span className="font-semibold text-foreground">{formatPrice(estimatedTotal)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {fleetQty > 1 ? `Total (×${fleetQty} equipos)` : "Total estimado"}
                  </p>
                  <p className="text-2xl font-black text-primary">{formatPrice(fleetTotal)}</p>
                </div>
              </div>

              {/* Discount tier */}
              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Descuento por armado
                  </p>
                  <Badge variant={buildDiscount.percentage > 0 ? "success" : "muted"} className="text-[10px]">
                    {buildDiscount.percentage > 0 ? `${buildDiscount.percentage}%` : "0%"}
                  </Badge>
                </div>
                {buildDiscount.percentage > 0 ? (
                  <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Ahorro: {formatPrice(buildDiscount.amount)} ({buildDiscount.label}) → <span className="text-sm">{formatPrice(discountedTotal)}</span>
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">2% / 4% / 5% según monto total de la flota.</p>
                )}
              </div>

              {/* Build status */}
              {isBuildComplete ? (
                <p className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={13} /> Build completo y compatible
                </p>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground">Faltan componentes obligatorios:</p>
                  <p className="text-xs font-medium text-foreground/70">
                    {missingComponents.map((t) => PC_COMPONENT_LABELS[t]).join(", ")}
                  </p>
                </div>
              )}

              {/* Compatibility warnings */}
              {compatibilitySnapshot.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2">
                  <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300 font-semibold">
                    <AlertTriangle size={11} /> Alertas técnicas
                  </p>
                  <ul className="mt-1 space-y-1">
                    {compatibilitySnapshot.warnings.slice(0, 4).map((w) => (
                      <li key={w} className="text-xs text-amber-700 dark:text-amber-300">{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* CTAs */}
            <Button className="w-full" disabled={!isBuildComplete} onClick={handleAddAllToCart}>
              <ShoppingCart size={14} />
              {fleetQty > 1 ? `Agregar ${fleetQty} equipos al carrito` : "Agregar configuración al carrito"}
            </Button>
            {onCreateQuote && (
              <Button
                className="w-full"
                variant="outline"
                disabled={!isBuildComplete || creatingQuote}
                onClick={() => void handleCreateQuote()}
              >
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
                const text = selectedLineItems
                  .map((l) => `${PC_COMPONENT_LABELS[l.componentType]}: ${getProductDisplayName(l.entry.product)}`)
                  .join("\n");
                void navigator.clipboard.writeText(`Mi configuración PC Bartez:\n${text}\nTotal: ${formatPrice(fleetTotal)}`);
                toast.success("Configuración copiada al portapapeles.");
              }}
            >
              <Share size={14} />
              Compartir configuración
            </Button>
            <div className="rounded-xl border border-border/70 bg-surface/70 px-3 py-2 text-xs text-muted-foreground">
              Specs validadas: {[getCanonicalKeyLabel("socket"), getCanonicalKeyLabel("memory_type"), getCanonicalKeyLabel("form_factor"), getCanonicalKeyLabel("interface")].join(", ")}.
            </div>
          </SurfaceCard>

          {/* ── Drafts card ── */}
          <SurfaceCard padding="md" className="rounded-[24px] border-border/70 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Borradores guardados</p>
              {currentDraftId && (
                <Badge variant="success" className="text-[10px]">Cargado</Badge>
              )}
            </div>

            {/* Draft name input */}
            <div className="flex gap-2">
              {editingDraftName || !draftName ? (
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => setEditingDraftName(false)}
                  placeholder="Nombre del borrador"
                  autoFocus={editingDraftName}
                  className="h-9 flex-1 rounded-xl border border-border/70 bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                />
              ) : (
                <div
                  className="flex h-9 flex-1 cursor-pointer items-center gap-1.5 rounded-xl border border-border/70 bg-background px-3 text-sm hover:bg-muted/30"
                  onClick={() => setEditingDraftName(true)}
                >
                  <span className="truncate text-foreground">{draftName}</span>
                  <Pencil size={11} className="ml-auto shrink-0 text-muted-foreground" />
                </div>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={!profileId || savingDraft || selectedLineItems.length === 0}
                onClick={() => void handleSaveDraft()}
                className="shrink-0"
              >
                <Save size={13} />
                {savingDraft ? "..." : "Guardar"}
              </Button>
            </div>

            {/* Draft list */}
            {draftsLoading ? (
              <p className="text-xs text-muted-foreground">Cargando borradores...</p>
            ) : drafts.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No hay borradores guardados todavía.</p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
                {drafts.map((draft) => {
                  const isLoaded = currentDraftId === draft.id;
                  return (
                    <div
                      key={draft.id}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                        isLoaded ? "border-primary/40 bg-primary/5" : "border-border/60 hover:bg-muted/30"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleLoadDraft(draft.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-medium">{draft.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {draft.items.length} componentes · {draft.goal ?? "—"} · {draft.status}
                        </p>
                      </button>
                      {isLoaded ? (
                        <Check size={13} className="shrink-0 text-primary" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleDeleteDraft(draft)}
                          className="shrink-0 rounded p-1 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Eliminar borrador"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
