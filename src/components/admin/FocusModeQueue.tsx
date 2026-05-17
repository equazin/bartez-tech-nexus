import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Keyboard, X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface FocusQueueItem {
  id: string | number;
  title: string;
  subtitle?: string;
  amountLabel?: string;
  /** Free-form metadata blocks rendered when the item is expanded. */
  details?: Array<{ label: string; value: string }>;
}

export interface FocusModeQueueProps {
  items: FocusQueueItem[];
  /** Header shown above the queue (e.g. "Aprobaciones pendientes"). */
  title?: string;
  onApprove: (item: FocusQueueItem) => Promise<void> | void;
  onReject: (item: FocusQueueItem) => Promise<void> | void;
  onClose: () => void;
  /** Optional: callback when an item gets focused (e.g. to log impressions). */
  onFocus?: (item: FocusQueueItem) => void;
}

/**
 * Keyboard-driven queue: ↑/↓ move, A approve, R reject, Space expand, Esc close.
 *
 * Designed for admin staff dispatching dozens of pending orders/quotes/clients
 * per day. Stays self-contained — the parent owns the source list and only
 * gets approve/reject callbacks with the selected item.
 */
export function FocusModeQueue({
  items,
  title = "Modo foco",
  onApprove,
  onReject,
  onClose,
  onFocus,
}: FocusModeQueueProps) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const safeItems = useMemo(() => items ?? [], [items]);
  const current = safeItems[index] ?? null;

  useEffect(() => {
    if (index >= safeItems.length) {
      setIndex(Math.max(0, safeItems.length - 1));
    }
  }, [index, safeItems.length]);

  useEffect(() => {
    if (current) onFocus?.(current);
  }, [current, onFocus]);

  const handleApprove = useCallback(async () => {
    if (!current || busy) return;
    setBusy("approve");
    try {
      await onApprove(current);
    } finally {
      setBusy(null);
    }
  }, [busy, current, onApprove]);

  const handleReject = useCallback(async () => {
    if (!current || busy) return;
    setBusy("reject");
    try {
      await onReject(current);
    } finally {
      setBusy(null);
    }
  }, [busy, current, onReject]);

  useEffect(() => {
    function handler(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      switch (event.key) {
        case "ArrowDown":
        case "j":
          event.preventDefault();
          setIndex((i) => Math.min(safeItems.length - 1, i + 1));
          setExpanded(false);
          break;
        case "ArrowUp":
        case "k":
          event.preventDefault();
          setIndex((i) => Math.max(0, i - 1));
          setExpanded(false);
          break;
        case " ":
          event.preventDefault();
          setExpanded((v) => !v);
          break;
        case "a":
        case "A":
          event.preventDefault();
          void handleApprove();
          break;
        case "r":
        case "R":
          event.preventDefault();
          void handleReject();
          break;
        case "Escape":
          event.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleApprove, handleReject, onClose, safeItems.length]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLDivElement>(`[data-focus-index="${index}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [index]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      <header className="flex items-center justify-between border-b border-border/70 px-6 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Modo foco</p>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex">
            <Keyboard size={14} />
            ↑↓ navegar · A aprobar · R rechazar · Espacio detalle · Esc salir
          </span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label="Cerrar modo foco"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[360px_1fr]">
        <div ref={listRef} className="flex flex-col gap-1 overflow-y-auto rounded-2xl border border-border/70 bg-card p-2">
          {safeItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No hay items pendientes.</div>
          ) : (
            safeItems.map((item, i) => (
              <button
                key={item.id}
                type="button"
                data-focus-index={i}
                onClick={() => { setIndex(i); setExpanded(false); }}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
                  i === index
                    ? "bg-primary/10 text-foreground ring-1 ring-primary/40"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{item.title}</p>
                  {item.subtitle ? <p className="truncate text-[11px] text-muted-foreground">{item.subtitle}</p> : null}
                </div>
                {item.amountLabel ? (
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-primary">{item.amountLabel}</span>
                ) : null}
              </button>
            ))
          )}
        </div>

        <div className="overflow-y-auto rounded-2xl border border-border/70 bg-card p-6">
          {current ? (
            <div className="flex h-full flex-col">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Item activo</p>
                  <h3 className="mt-1 text-2xl font-bold text-foreground">{current.title}</h3>
                  {current.subtitle ? <p className="mt-1 text-sm text-muted-foreground">{current.subtitle}</p> : null}
                </div>
                {current.amountLabel ? (
                  <p className="text-2xl font-bold tabular-nums text-primary">{current.amountLabel}</p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-4 inline-flex items-center gap-1.5 self-start rounded-xl border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? "Ocultar detalle" : "Ver detalle (Espacio)"}
              </button>

              {expanded && current.details && current.details.length > 0 ? (
                <dl className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-background/70 p-4 text-sm sm:grid-cols-2">
                  {current.details.map((d) => (
                    <div key={d.label}>
                      <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{d.label}</dt>
                      <dd className="mt-1 text-sm text-foreground">{d.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              <div className="mt-auto flex flex-wrap gap-3 border-t border-border/70 pt-6">
                <button
                  type="button"
                  onClick={() => { void handleApprove(); }}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:opacity-60"
                >
                  <Check size={16} /> Aprobar <kbd className="ml-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px]">A</kbd>
                </button>
                <button
                  type="button"
                  onClick={() => { void handleReject(); }}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-2 rounded-xl bg-destructive px-5 py-3 text-sm font-bold text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-60"
                >
                  <X size={16} /> Rechazar <kbd className="ml-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px]">R</kbd>
                </button>
                <span className="ml-auto self-center text-xs text-muted-foreground">
                  {index + 1} / {safeItems.length}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">Sin items para procesar 🎉</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
