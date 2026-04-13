import { Search, Trash2 } from "lucide-react";
import type { Product } from "@/models/products";
import {
  BUILDER_SLOT_CONFIG,
  type BuilderSlotKey,
  type CandidateCompatibility,
  type SelectedBuilderItems,
} from "@/models/pcBuilder";
import { parsePsuWattage } from "@/lib/pcBuilder";

interface BuilderSlotsGridProps {
  selectedItems: SelectedBuilderItems;
  candidatesBySlot: Record<BuilderSlotKey, Product[]>;
  loading?: boolean;
  estimatedPowerW: number;
  recommendedPsuW: number;
  searchBySlot: Partial<Record<BuilderSlotKey, string>>;
  onSearchBySlotChange: (slotKey: BuilderSlotKey, value: string) => void;
  onSelectProduct: (slotKey: BuilderSlotKey, product: Product) => void;
  onPreviewProduct: (slotKey: BuilderSlotKey, product: Product) => void;
  onClearSlot: (slotKey: BuilderSlotKey) => void;
  onQuantityChange: (slotKey: BuilderSlotKey, quantity: number) => void;
  assessCandidate: (slotKey: BuilderSlotKey, product: Product) => CandidateCompatibility;
  getLineTotal: (product: Product, quantity: number) => number;
  formatPrice: (value: number) => string;
}

function stateBadgeClass(state: CandidateCompatibility["state"]): string {
  if (state === "compatible") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (state === "incomplete") return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  if (state === "incompatible") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-border/70 bg-muted/20 text-muted-foreground";
}

function stateLabel(state: CandidateCompatibility["state"]): string {
  if (state === "compatible") return "Compatible";
  if (state === "incomplete") return "Incompleto";
  if (state === "incompatible") return "Bloqueado";
  return "Sin validar";
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function BuilderSlotsGrid({
  selectedItems,
  candidatesBySlot,
  loading = false,
  estimatedPowerW,
  recommendedPsuW,
  searchBySlot,
  onSearchBySlotChange,
  onSelectProduct,
  onPreviewProduct,
  onClearSlot,
  onQuantityChange,
  assessCandidate,
  getLineTotal,
  formatPrice,
}: BuilderSlotsGridProps) {
  return (
    <section className="rounded-[26px] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(249,250,251,0.98))] p-4 shadow-[0_20px_50px_-45px_rgba(16,185,129,0.85)] md:p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Armado por Slots</p>
      <h2 className="mt-2 text-lg font-bold text-foreground">Elegi componentes core + monitor</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Cada slot valida compatibilidad en tiempo real y muestra solo opciones listas para seleccionar.
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {BUILDER_SLOT_CONFIG.map((slot) => {
          const selected = selectedItems[slot.key];
          const rawSearch = searchBySlot[slot.key] ?? "";
          const normalizedSearch = normalize(rawSearch);
          const filteredCandidates = candidatesBySlot[slot.key]
            .map((candidate) => ({
              candidate,
              state: assessCandidate(slot.key, candidate),
            }))
            .filter(({ candidate, state }) => {
              if (state.state !== "compatible") return false;
              if (!normalizedSearch) return true;
              const bag = normalize(`${candidate.name} ${candidate.sku} ${candidate.brand_name} ${candidate.category}`);
              return bag.includes(normalizedSearch);
            })
            .slice(0, 8);

          return (
            <div key={slot.key} className="rounded-2xl border border-border/70 bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-foreground">{slot.label}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    slot.required
                      ? "border border-primary/30 bg-primary/10 text-primary"
                      : "border border-border/70 bg-muted/30 text-muted-foreground"
                  }`}
                >
                  {slot.required ? "Obligatorio" : "Opcional"}
                </span>
              </div>

              {selected ? (
                <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[13px] font-semibold leading-5 text-foreground">{selected.product.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {selected.product.sku ? `SKU ${selected.product.sku} · ` : ""}
                        {formatPrice(getLineTotal(selected.product, selected.quantity))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onClearSlot(slot.key)}
                      className="rounded-lg border border-border/70 bg-card p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      title={`Quitar ${slot.label}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Cantidad</span>
                    <input
                      type="number"
                      min={1}
                      value={selected.quantity}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        onQuantityChange(slot.key, Number.isFinite(next) && next > 0 ? Math.floor(next) : 1);
                      }}
                      className="w-20 rounded-lg border border-border/70 bg-card px-2 py-1 text-sm text-foreground outline-none"
                    />
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Todavia no seleccionaste componente.</p>
              )}

              <label className="mt-3 flex items-center gap-2 rounded-xl border border-border/70 bg-card px-2.5 py-2">
                <Search size={13} className="text-muted-foreground" />
                <input
                  value={rawSearch}
                  onChange={(event) => onSearchBySlotChange(slot.key, event.target.value)}
                  placeholder={`Buscar ${slot.label}`}
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>

              {slot.key === "psu" ? (
                <div className="mt-2 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-3 py-2">
                  <p className="text-[11px] font-semibold text-emerald-700">Guia de watts para esta configuracion</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Consumo estimado: <span className="font-semibold text-foreground">{estimatedPowerW}W</span> · recomendado:
                    <span className="font-semibold text-foreground"> {recommendedPsuW}W</span> o mas.
                  </p>
                </div>
              ) : null}

              <div className="mt-2 space-y-1.5">
                {loading ? (
                  <p className="rounded-xl border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                    Cargando componentes de {slot.label}...
                  </p>
                ) : filteredCandidates.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                    No hay componentes de {slot.label} disponibles con el filtro actual.
                  </p>
                ) : (
                  filteredCandidates.map(({ candidate, state: candidateState }) => (
                    <div
                      key={`${slot.key}-${candidate.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => onPreviewProduct(slot.key, candidate)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onPreviewProduct(slot.key, candidate);
                        }
                      }}
                      className="w-full rounded-xl border border-border/70 bg-card px-3 py-2 text-left transition hover:border-primary/30 hover:bg-primary/5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-[13px] font-semibold leading-5 text-foreground">{candidate.name}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {candidate.sku ? `SKU ${candidate.sku} · ` : ""}
                            {formatPrice(getLineTotal(candidate, 1))}
                          </p>
                          {slot.key === "psu" && parsePsuWattage(candidate) ? (
                            <p className="mt-1 text-[11px] font-medium text-emerald-700">
                              Potencia declarada: {parsePsuWattage(candidate)}W · recomendado para este armado: {recommendedPsuW}W
                            </p>
                          ) : null}
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${stateBadgeClass(candidateState.state)}`}>
                          {stateLabel(candidateState.state)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">Click para ver preview</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectProduct(slot.key, candidate);
                          }}
                          className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-semibold text-primary-foreground transition hover:opacity-90"
                        >
                          Seleccionar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
