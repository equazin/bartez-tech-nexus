import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, Sparkles, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/models/products";
import type {
  BuilderCurrency,
  BuilderGoal,
  BuilderMode,
  BuilderPriority,
  BuilderSlotKey,
  SelectedBuilderItems,
} from "@/models/pcBuilder";
import { track } from "@/lib/marketingTracker";
import { supabase } from "@/lib/supabase";
import { resolveProductImageUrl } from "@/lib/productImage";
import { usePcBuilds } from "@/hooks/usePcBuilds";
import {
  getPcBuildDiscount,
  type PcBuildDiscountDetails,
  assessCandidateCompatibility,
  buildSlotCandidates,
  getBuilderSlotLabel,
  createGuidedBaseSelection,
  evaluatePcCompatibility,
} from "@/lib/pcBuilder";
import { BuilderModeToggle } from "@/components/b2b/builder/BuilderModeToggle";
import { BuilderStepWizard } from "@/components/b2b/builder/BuilderStepWizard";
import { BuilderSlotsGrid } from "@/components/b2b/builder/BuilderSlotsGrid";
import { BuilderCompatibilityPanel } from "@/components/b2b/builder/BuilderCompatibilityPanel";
import { BuilderSummaryCard } from "@/components/b2b/builder/BuilderSummaryCard";
import { BuilderSaveDraftDialog } from "@/components/b2b/builder/BuilderSaveDraftDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PcBuilderPageProps {
  profileId?: string;
  clientName: string;
  products: Product[];
  currency: "ARS" | "USD";
  formatPrice: (value: number) => string;
  getLineTotal: (product: Product, quantity: number) => number;
  onAddToCart: (product: Product, quantity: number) => void;
  onCreateQuote: (
    items: Array<{ slotKey: BuilderSlotKey; product: Product; quantity: number }>,
    buildId?: string,
    discount?: PcBuildDiscountDetails,
  ) => Promise<boolean>;
}

function getDefaultDraftName(goal: BuilderGoal): string {
  const goalLabel = goal === "office" ? "Oficina" : goal === "gaming" ? "Gaming" : "Workstation";
  return `Armado ${goalLabel} ${new Date().toLocaleDateString("es-AR")}`;
}

export function PcBuilderPage({
  profileId,
  clientName,
  products,
  currency,
  formatPrice,
  getLineTotal,
  onAddToCart,
  onCreateQuote,
}: PcBuilderPageProps) {
  const [mode, setMode] = useState<BuilderMode>("guided");
  const [goal, setGoal] = useState<BuilderGoal>("office");
  const [priority, setPriority] = useState<BuilderPriority>("balanced");
  const [budgetCurrency, setBudgetCurrency] = useState<BuilderCurrency>(currency);
  const [budgetMin, setBudgetMin] = useState<number | undefined>(undefined);
  const [budgetMax, setBudgetMax] = useState<number | undefined>(undefined);
  const [selectedItems, setSelectedItems] = useState<SelectedBuilderItems>({});
  const [searchBySlot, setSearchBySlot] = useState<Partial<Record<BuilderSlotKey, string>>>({});
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState<string | undefined>(undefined);
  const [builderCatalogProducts, setBuilderCatalogProducts] = useState<Product[]>([]);
  const [builderCatalogLoading, setBuilderCatalogLoading] = useState(true);
  const [builderCatalogError, setBuilderCatalogError] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<{ slotKey: BuilderSlotKey; product: Product } | null>(null);

  const { drafts, saveDraft, deleteDraft, getDraft } = usePcBuilds(profileId);
  const builderProducts = useMemo(
    () => (builderCatalogProducts.length > 0 ? builderCatalogProducts : builderCatalogError ? products : []),
    [builderCatalogError, builderCatalogProducts, products],
  );

  const candidatesBySlot = useMemo(() => buildSlotCandidates(builderProducts), [builderProducts]);

  useEffect(() => {
    let active = true;

    async function loadBuilderCatalog() {
      setBuilderCatalogLoading(true);
      setBuilderCatalogError(null);

      const pageSize = 1000;
      const allProducts: Product[] = [];
      let from = 0;
      let keepLoading = true;

      while (keepLoading) {
        const { data, error } = await supabase
          .from("portal_products")
          .select("*")
          .eq("active", true)
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);

        if (!active) return;

        if (error) {
          setBuilderCatalogProducts([]);
          setBuilderCatalogError(error.message);
          setBuilderCatalogLoading(false);
          return;
        }

        const batch = (data as Product[]) ?? [];
        allProducts.push(...batch);
        keepLoading = batch.length === pageSize;
        from += pageSize;
      }

      setBuilderCatalogProducts(allProducts);
      setBuilderCatalogLoading(false);
    }

    void loadBuilderCatalog();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void track("builder_open", { source: "b2b_portal", mode }, profileId ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compatibility = useMemo(() => evaluatePcCompatibility(selectedItems, goal), [selectedItems, goal]);

  const selectedEntries = useMemo(
    () =>
      (Object.entries(selectedItems) as Array<[BuilderSlotKey, SelectedBuilderItems[BuilderSlotKey]]>)
        .filter((entry): entry is [BuilderSlotKey, NonNullable<SelectedBuilderItems[BuilderSlotKey]>] => Boolean(entry[1])),
    [selectedItems],
  );

  const total = useMemo(
    () => selectedEntries.reduce((sum, [, item]) => sum + getLineTotal(item.product, item.quantity), 0),
    [selectedEntries, getLineTotal],
  );
  const buildDiscount = useMemo(() => getPcBuildDiscount(total, currency), [currency, total]);
  const discountedTotal = useMemo(() => Math.max(0, total - buildDiscount.amount), [buildDiscount.amount, total]);
  const selectedSlotsCount = selectedEntries.length;
  const completedRequiredCount = 6 - compatibility.missingRequiredSlots.length;

  const assessCandidate = useCallback(
    (slotKey: BuilderSlotKey, product: Product) => assessCandidateCompatibility(slotKey, product, selectedItems, goal),
    [selectedItems, goal],
  );

  function handleModeChange(nextMode: BuilderMode) {
    setMode(nextMode);
    void track("builder_mode_change", { mode: nextMode }, profileId ?? null);
  }

  function handleGenerateBase() {
    const guidedSelection = createGuidedBaseSelection({
      candidatesBySlot,
      goal,
      priority,
      budgetMin,
      budgetMax,
    });
    setSelectedItems(guidedSelection);
    toast.success("Base recomendada cargada. Ahora podés ajustar cada slot.");
  }

  function handleSelectProduct(slotKey: BuilderSlotKey, product: Product) {
    setSelectedItems((prev) => ({
      ...prev,
      [slotKey]: {
        product,
        quantity: prev[slotKey]?.quantity ?? 1,
      },
    }));
    void track("builder_slot_select", { slot_key: slotKey, product_id: product.id }, profileId ?? null);
  }

  function handleClearSlot(slotKey: BuilderSlotKey) {
    setSelectedItems((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  }

  function handleQuantityChange(slotKey: BuilderSlotKey, quantity: number) {
    setSelectedItems((prev) => {
      const current = prev[slotKey];
      if (!current) return prev;
      return {
        ...prev,
        [slotKey]: {
          ...current,
          quantity,
        },
      };
    });
  }

  function handleSearchBySlotChange(slotKey: BuilderSlotKey, value: string) {
    setSearchBySlot((prev) => ({ ...prev, [slotKey]: value }));
  }

  function handlePreviewProduct(slotKey: BuilderSlotKey, product: Product) {
    setPreviewItem({ slotKey, product });
  }

  async function handleSaveDraft(name: string) {
    if (!profileId) {
      toast.error("No se pudo guardar: falta sesión de cliente.");
      return;
    }

    const items = selectedEntries.map(([slotKey, selected]) => ({
      slotKey,
      productId: selected.product.id,
      quantity: selected.quantity,
      locked: false,
      compatibilityState: assessCandidate(slotKey, selected.product).state,
      notes: undefined,
    }));

    const saved = await saveDraft({
      id: currentDraftId,
      name,
      mode,
      goal,
      budgetMin,
      budgetMax,
      currency: budgetCurrency,
      priority,
      status: "draft",
      items,
    });

    if (!saved) {
      toast.error("No se pudo guardar el borrador.");
      return;
    }

    setCurrentDraftId(saved.id);
    toast.success("Borrador guardado.");
    void track("builder_save_draft", { build_id: saved.id, item_count: items.length }, profileId);
  }

  function handleLoadDraft(draftId: string) {
    const draft = getDraft(draftId);
    if (!draft) return;

    const nextSelection: SelectedBuilderItems = {};
    for (const item of draft.items) {
      const product = builderProducts.find((candidate) => candidate.id === item.productId);
      if (!product) continue;
      nextSelection[item.slotKey] = {
        product,
        quantity: item.quantity,
      };
    }

    setCurrentDraftId(draft.id);
    setMode(draft.mode);
    setGoal(draft.goal ?? "office");
    setBudgetMin(draft.budgetMin);
    setBudgetMax(draft.budgetMax);
    setBudgetCurrency(draft.currency);
    setPriority(draft.priority ?? "balanced");
    setSelectedItems(nextSelection);
    toast.success(`Borrador "${draft.name}" cargado.`);
  }

  async function handleDeleteDraft(draftId: string) {
    const ok = await deleteDraft(draftId);
    if (!ok) {
      toast.error("No se pudo eliminar el borrador.");
      return;
    }
    if (currentDraftId === draftId) setCurrentDraftId(undefined);
    toast.success("Borrador eliminado.");
  }

  function ensureCompatibilityBeforeFinalize(action: "quote" | "cart"): boolean {
    if (compatibility.canFinalize) return true;
    const firstError = compatibility.issues.find((issue) => issue.severity === "error");
    const fallback = "El armado tiene bloqueos de compatibilidad.";
    toast.error(firstError?.title ?? fallback, {
      description: firstError?.description ?? "Corregí los conflictos antes de finalizar.",
    });
    void track(
      "builder_compatibility_blocked",
      {
        action,
        state: compatibility.state,
        error_count: compatibility.issues.filter((issue) => issue.severity === "error").length,
        first_error: firstError?.id ?? null,
      },
      profileId ?? null,
    );
    return false;
  }

  async function handleAddBuildToCart() {
    if (!ensureCompatibilityBeforeFinalize("cart")) return;

    for (const [, selected] of selectedEntries) {
      onAddToCart(selected.product, selected.quantity);
    }

    if (profileId) {
      const metadataKey = `b2b_cart_source_${profileId}`;
      localStorage.setItem(
        metadataKey,
        JSON.stringify({
          source: "pc_builder",
          build_id: currentDraftId,
          discount_pct: buildDiscount.percentage,
          bundle_items: selectedEntries.map(([slotKey, selected]) => ({
            slotKey,
            productId: selected.product.id,
            quantity: selected.quantity,
          })),
          updated_at: new Date().toISOString(),
        }),
      );
    }

    toast.success("Armado agregado al carrito.");
    void track("builder_added_to_cart", { build_id: currentDraftId ?? null, item_count: selectedEntries.length }, profileId ?? null);
  }

  async function handleCreateQuote() {
    if (!ensureCompatibilityBeforeFinalize("quote")) return;

    const ok = await onCreateQuote(
      selectedEntries.map(([slotKey, selected]) => ({
        slotKey,
        product: selected.product,
        quantity: selected.quantity,
      })),
      currentDraftId,
      buildDiscount,
    );

    if (!ok) {
      toast.error("No se pudo crear la cotización.");
      return;
    }

    void track("builder_quote_created", { build_id: currentDraftId ?? null, item_count: selectedEntries.length }, profileId ?? null);
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-4 pb-8">
      <section className="overflow-hidden rounded-[28px] border border-emerald-500/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(240,253,248,0.96))] px-4 py-5 shadow-[0_24px_80px_-48px_rgba(16,185,129,0.65)] md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Armador PC / Cotizador</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground">Armá una PC compatible y cotizá en el mismo flujo</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cuenta: <span className="font-semibold text-foreground">{clientName}</span>. Podés guardar borradores, convertir a cotización y cargar al carrito.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/70 bg-white/85 p-3 shadow-sm backdrop-blur lg:min-w-[320px]">
            <div className="flex items-center gap-2 text-emerald-700">
              <Wallet size={14} />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Vista comercial</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Total armado</p>
            <p className="text-2xl font-black tracking-tight text-foreground">{formatPrice(total)}</p>
            <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">Total con descuento bundle</p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-emerald-700">{formatPrice(discountedTotal)}</p>
                  <p className="text-xs text-emerald-700/80">Ahorras {formatPrice(buildDiscount.amount)} con el armado completo.</p>
                </div>
                <BuilderModeToggle mode={mode} onChange={handleModeChange} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[22px] border border-border/70 bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-700">
            <Sparkles size={14} />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]">Descuento activo</p>
          </div>
          <p className="mt-2 text-2xl font-black text-foreground">{buildDiscount.percentage}%</p>
          <p className="text-xs text-muted-foreground">Ahorro proyectado: {formatPrice(buildDiscount.amount)} sobre el armado actual.</p>
        </div>
        <div className="rounded-[22px] border border-border/70 bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-700">
            <Zap size={14} />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]">Watts recomendados</p>
          </div>
          <p className="mt-2 text-2xl font-black text-foreground">{compatibility.recommendedPsuW}W</p>
          <p className="text-xs text-muted-foreground">Consumo estimado del build: {compatibility.estimatedPowerW}W.</p>
        </div>
        <div className="rounded-[22px] border border-border/70 bg-card px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-700">
            <ShieldCheck size={14} />
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]">Avance</p>
          </div>
          <p className="mt-2 text-2xl font-black text-foreground">{selectedSlotsCount}/8</p>
          <p className="text-xs text-muted-foreground">
            {completedRequiredCount}/6 obligatorios cubiertos · {compatibility.state === "compatible" ? "armado listo" : "todavia con revision"}.
          </p>
        </div>
      </section>

      {mode === "guided" ? (
        <BuilderStepWizard
          goal={goal}
          onGoalChange={setGoal}
          budgetMin={budgetMin}
          budgetMax={budgetMax}
          onBudgetMinChange={setBudgetMin}
          onBudgetMaxChange={setBudgetMax}
          budgetCurrency={budgetCurrency}
          onBudgetCurrencyChange={setBudgetCurrency}
          priority={priority}
          onPriorityChange={setPriority}
          onGenerateBase={handleGenerateBase}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <BuilderSlotsGrid
            selectedItems={selectedItems}
            candidatesBySlot={candidatesBySlot}
            loading={builderCatalogLoading}
            estimatedPowerW={compatibility.estimatedPowerW}
            recommendedPsuW={compatibility.recommendedPsuW}
            searchBySlot={searchBySlot}
            onSearchBySlotChange={handleSearchBySlotChange}
            onSelectProduct={handleSelectProduct}
            onPreviewProduct={handlePreviewProduct}
            onClearSlot={handleClearSlot}
            onQuantityChange={handleQuantityChange}
            assessCandidate={assessCandidate}
            getLineTotal={getLineTotal}
            formatPrice={formatPrice}
          />
          <BuilderCompatibilityPanel compatibility={compatibility} />
        </div>

        <div className="space-y-4">
          <details className="rounded-2xl border border-border/70 bg-card p-3 lg:hidden">
            <summary className="cursor-pointer text-sm font-bold text-foreground">Ver resumen del armado</summary>
            <div className="mt-3">
              <BuilderSummaryCard
                selectedItems={selectedItems}
                total={total}
                discountedTotal={discountedTotal}
                discountAmount={buildDiscount.amount}
                discountPercentage={buildDiscount.percentage}
                discountLabel={buildDiscount.label}
                formatPrice={formatPrice}
                getLineTotal={getLineTotal}
                compatibility={compatibility}
                drafts={drafts}
                currentDraftId={currentDraftId}
                onLoadDraft={handleLoadDraft}
                onDeleteDraft={handleDeleteDraft}
                onOpenSaveDraft={() => setSaveDialogOpen(true)}
              />
            </div>
          </details>

          <div className="hidden lg:sticky lg:top-4 lg:block">
            <BuilderSummaryCard
              selectedItems={selectedItems}
              total={total}
              discountedTotal={discountedTotal}
              discountAmount={buildDiscount.amount}
              discountPercentage={buildDiscount.percentage}
              discountLabel={buildDiscount.label}
              formatPrice={formatPrice}
              getLineTotal={getLineTotal}
              compatibility={compatibility}
              drafts={drafts}
              currentDraftId={currentDraftId}
              onLoadDraft={handleLoadDraft}
              onDeleteDraft={handleDeleteDraft}
              onOpenSaveDraft={() => setSaveDialogOpen(true)}
            />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-20 rounded-[24px] border border-emerald-500/20 bg-white/92 p-3 shadow-[0_-24px_80px_-56px_rgba(16,185,129,0.7)] backdrop-blur">
        <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-emerald-500/15 bg-emerald-500/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">Ahorro por armado completo</p>
            <p className="mt-1 text-sm text-muted-foreground">
              El bundle aplica <span className="font-semibold text-foreground">{buildDiscount.percentage}%</span> y deja el armado en{" "}
              <span className="font-bold text-foreground">{formatPrice(discountedTotal)}</span>.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground line-through">{formatPrice(total)}</p>
            <p className="text-lg font-black text-emerald-700">-{formatPrice(buildDiscount.amount)}</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void handleCreateQuote()}
            className="h-12 rounded-2xl border border-emerald-500/25 bg-emerald-500/12 text-sm font-bold text-emerald-700 transition hover:bg-emerald-600 hover:text-white"
          >
            Guardar cotización
          </button>
          <button
            type="button"
            onClick={() => void handleAddBuildToCart()}
            className="h-12 rounded-2xl border border-emerald-500 bg-emerald-600 text-sm font-bold text-white transition hover:bg-emerald-700"
          >
            Agregar al carrito
          </button>
        </div>
        {!compatibility.canFinalize ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Resolvé los bloqueos de compatibilidad para finalizar.
          </p>
        ) : null}
      </div>

      <BuilderSaveDraftDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        defaultName={getDefaultDraftName(goal)}
        onSave={handleSaveDraft}
      />

      <Dialog open={Boolean(previewItem)} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-2xl overflow-hidden rounded-[24px] border border-border/70 bg-card p-0">
          {previewItem ? (
            <div className="grid gap-0 md:grid-cols-[280px_minmax(0,1fr)]">
              <div className="border-b border-border/70 bg-muted/20 p-4 md:border-b-0 md:border-r">
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-background">
                  <img
                    src={resolveProductImageUrl(previewItem.product.image)}
                    alt={previewItem.product.name}
                    className="h-[240px] w-full object-contain"
                  />
                </div>
              </div>

              <div className="p-5">
                <DialogHeader>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                    Preview {getBuilderSlotLabel(previewItem.slotKey)}
                  </p>
                  <DialogTitle className="pr-8 text-lg font-black leading-6 text-foreground">
                    {previewItem.product.name}
                  </DialogTitle>
                </DialogHeader>

                <div className="mt-4 space-y-3">
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    {previewItem.product.category ? (
                      <span className="rounded-full border border-border/70 bg-muted/30 px-2 py-1">{previewItem.product.category}</span>
                    ) : null}
                    {previewItem.product.brand_name ? (
                      <span className="rounded-full border border-border/70 bg-muted/30 px-2 py-1">{previewItem.product.brand_name}</span>
                    ) : null}
                    {previewItem.product.sku ? (
                      <span className="rounded-full border border-border/70 bg-muted/30 px-2 py-1">SKU {previewItem.product.sku}</span>
                    ) : null}
                  </div>

                  <p className="text-sm font-semibold text-foreground">{formatPrice(getLineTotal(previewItem.product, 1))}</p>

                  <p className="text-sm leading-6 text-muted-foreground">
                    {previewItem.product.description?.trim() || "Sin descripcion comercial disponible para este producto."}
                  </p>
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectProduct(previewItem.slotKey, previewItem.product);
                      setPreviewItem(null);
                    }}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                  >
                    Seleccionar componente
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
