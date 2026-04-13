import { FilePlus2, FolderClock, ShieldCheck, Trash2, Zap } from "lucide-react";
import type { Product } from "@/models/products";
import { BUILDER_SLOT_CONFIG, type BuildCompatibilityResult, type PcBuildDraft, type SelectedBuilderItems } from "@/models/pcBuilder";

interface BuilderSummaryCardProps {
  selectedItems: SelectedBuilderItems;
  total: number;
  discountedTotal: number;
  discountAmount: number;
  discountPercentage: number;
  discountLabel: string;
  formatPrice: (value: number) => string;
  getLineTotal: (product: Product, quantity: number) => number;
  compatibility: BuildCompatibilityResult;
  drafts: PcBuildDraft[];
  currentDraftId?: string;
  onLoadDraft: (draftId: string) => void;
  onDeleteDraft: (draftId: string) => void;
  onOpenSaveDraft: () => void;
}

function compatibilityTone(state: BuildCompatibilityResult["state"]): string {
  if (state === "compatible") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
  if (state === "incomplete") return "border-amber-500/20 bg-amber-500/10 text-amber-700";
  return "border-destructive/20 bg-destructive/10 text-destructive";
}

function compatibilityLabel(state: BuildCompatibilityResult["state"]): string {
  if (state === "compatible") return "Compatible";
  if (state === "incomplete") return "Incompleto";
  return "Con bloqueos";
}

export function BuilderSummaryCard({
  selectedItems,
  total,
  discountedTotal,
  discountAmount,
  discountPercentage,
  discountLabel,
  formatPrice,
  getLineTotal,
  compatibility,
  drafts,
  currentDraftId,
  onLoadDraft,
  onDeleteDraft,
  onOpenSaveDraft,
}: BuilderSummaryCardProps) {
  return (
    <aside className="overflow-hidden rounded-[28px] border border-emerald-500/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-4 shadow-[0_24px_60px_-48px_rgba(16,185,129,0.8)]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Resumen del armado</p>
        <button
          type="button"
          onClick={onOpenSaveDraft}
          className="inline-flex items-center gap-1 rounded-xl border border-border/70 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <FilePlus2 size={12} />
          Borrador
        </button>
      </div>

      <div className="mt-3 rounded-[24px] border border-emerald-500/20 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_40%),linear-gradient(135deg,rgba(236,253,245,1),rgba(255,255,255,1))] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700">{discountLabel}</p>
            <p className="mt-1 text-3xl font-black tracking-tight text-foreground">{formatPrice(discountedTotal)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Total original <span className="line-through">{formatPrice(total)}</span>
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-white/85 px-3 py-2 text-right shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Bundle</p>
            <p className="text-xl font-black text-emerald-700">{discountPercentage}%</p>
            <p className="text-[11px] text-emerald-700/80">-{formatPrice(discountAmount)}</p>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className={`rounded-2xl border px-3 py-2 ${compatibilityTone(compatibility.state)}`}>
            <div className="flex items-center gap-2">
              <ShieldCheck size={13} />
              <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Estado</span>
            </div>
            <p className="mt-1 text-sm font-semibold">{compatibilityLabel(compatibility.state)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-white/85 px-3 py-2">
            <div className="flex items-center gap-2 text-emerald-700">
              <Zap size={13} />
              <span className="text-[11px] font-bold uppercase tracking-[0.16em]">Fuente sugerida</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {compatibility.recommendedPsuW}W para un consumo estimado de {compatibility.estimatedPowerW}W
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {BUILDER_SLOT_CONFIG.map((slot) => {
          const selected = selectedItems[slot.key];
          return (
            <div key={slot.key} className="rounded-2xl border border-border/70 bg-white px-3 py-2.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{slot.label}</p>
                {!slot.required && <span className="text-[10px] text-muted-foreground">Opcional</span>}
              </div>
              {selected ? (
                <div className="mt-1 space-y-0.5">
                  <p className="line-clamp-2 text-[13px] font-semibold leading-5 text-foreground">{selected.product.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    x{selected.quantity} · {formatPrice(getLineTotal(selected.product, selected.quantity))}
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">Sin seleccionar</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-2xl border border-border/70 bg-white px-3 py-3 shadow-sm">
        <p className="mb-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <FolderClock size={12} />
          Reanudar borrador
        </p>
        {drafts.length === 0 ? (
          <p className="text-xs text-muted-foreground">Todavia no hay borradores guardados.</p>
        ) : (
          <div className="space-y-2">
            <select
              value={currentDraftId ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                if (value) onLoadDraft(value);
              }}
              className="w-full rounded-xl border border-border/70 bg-card px-2.5 py-2 text-xs text-foreground outline-none"
            >
              <option value="">Seleccionar borrador...</option>
              {drafts.map((draft) => (
                <option key={draft.id} value={draft.id}>
                  {draft.name}
                </option>
              ))}
            </select>
            {currentDraftId ? (
              <button
                type="button"
                onClick={() => onDeleteDraft(currentDraftId)}
                className="inline-flex items-center gap-1 rounded-xl border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] font-semibold text-destructive transition hover:bg-destructive/20"
              >
                <Trash2 size={11} />
                Eliminar borrador
              </button>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
