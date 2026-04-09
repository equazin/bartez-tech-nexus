import { useState } from "react";
import { Quote, QuoteStatus } from "@/models/quote";
import { useCurrency } from "@/context/CurrencyContext";
import { toggleSetValue } from "@/lib/toggleSet";
import {
  FileText, ChevronDown, ChevronRight, RotateCcw, Trash2, ClipboardList,
  Clock, CheckCircle2, XCircle, Eye, Send, AlertTriangle, Copy, ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceCard } from "@/components/ui/surface-card";

// Quote lifecycle stepper ------------------------------------------------------

type StepState = "done" | "active" | "pending" | "skipped";

interface QuoteStep {
  status: QuoteStatus;
  label: string;
}

const QUOTE_FLOW: QuoteStep[] = [
  { status: "draft", label: "Borrador" },
  { status: "sent", label: "Enviada" },
  { status: "viewed", label: "Vista" },
  { status: "approved", label: "Aprobada" },
  { status: "converted", label: "Pedido" },
];

const TERMINAL_STATUSES = new Set<QuoteStatus>(["rejected", "expired"]);

function getStepState(stepStatus: QuoteStatus, currentStatus: QuoteStatus): StepState {
  if (TERMINAL_STATUSES.has(currentStatus)) return "skipped";
  const flowOrder = QUOTE_FLOW.map((step) => step.status);
  const stepIdx = flowOrder.indexOf(stepStatus);
  const currentIdx = flowOrder.indexOf(currentStatus);
  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "active";
  return "pending";
}

function QuoteStatusStepper({ status }: { status: QuoteStatus }) {
  const isTerminal = TERMINAL_STATUSES.has(status);

  return (
    <div className="flex w-full items-center gap-0">
      {QUOTE_FLOW.map((step, index) => {
        const state: StepState = getStepState(step.status, status);
        const isLast = index === QUOTE_FLOW.length - 1;

        const dotCls = isTerminal
          ? "border-destructive/30 bg-destructive/5 text-destructive/70"
          : state === "done"
            ? "border-primary bg-primary text-primary-foreground"
            : state === "active"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground";

        const labelCls = isTerminal
          ? "text-destructive/70"
          : state === "done"
            ? "text-primary"
            : state === "active"
              ? "font-semibold text-primary"
              : "text-muted-foreground";

        return (
          <div key={step.status} className="flex min-w-0 flex-1 items-center">
            <div className="flex shrink-0 flex-col items-center gap-1">
              <div className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold transition-all ${dotCls}`}>
                {state === "done" && !isTerminal ? <CheckCircle2 size={11} /> : index + 1}
              </div>
              <span className={`whitespace-nowrap text-[9px] ${labelCls}`}>{step.label}</span>
            </div>
            {!isLast ? <div className={`mx-1 mb-3.5 h-px flex-1 ${state === "done" && !isTerminal ? "bg-primary" : "bg-border"}`} /> : null}
          </div>
        );
      })}
      {isTerminal ? (
        <div className="ml-2 flex shrink-0 flex-col items-center gap-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10">
            {status === "rejected" ? <XCircle size={11} className="text-destructive" /> : <AlertTriangle size={11} className="text-amber-500" />}
          </div>
          <span className="text-[9px] text-destructive/70">{status === "rejected" ? "Rechazada" : "Expirada"}</span>
        </div>
      ) : null}
    </div>
  );
}

// Status config ----------------------------------------------------------------
const STATUS_MAP: Record<QuoteStatus, { label: string; className: string; icon: LucideIcon }> = {
  draft: { label: "Borrador", className: "border-border bg-muted/50 text-muted-foreground", icon: FileText },
  sent: { label: "Enviada", className: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400", icon: Send },
  viewed: { label: "Vista", className: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400", icon: Eye },
  approved: { label: "Aprobada", className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
  rejected: { label: "Rechazada", className: "border-destructive/20 bg-destructive/10 text-destructive", icon: XCircle },
  converted: { label: "Convertida", className: "border-primary/20 bg-primary/10 text-primary", icon: ShoppingBag },
  expired: { label: "Expirada", className: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400", icon: AlertTriangle },
};

function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const { label, className, icon: Icon } = STATUS_MAP[status] ?? STATUS_MAP.draft;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      <Icon size={10} /> {label}
    </span>
  );
}

function getExpiryCountdown(expiresAt: string | undefined, status: QuoteStatus): { label: string; className: string } | null {
  if (!expiresAt || ["expired", "rejected", "converted"].includes(status)) return null;
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return null;
  const diffH = diffMs / 3_600_000;
  if (diffH > 72) return null;
  const diffD = Math.floor(diffH / 24);
  const label = diffH < 24 ? `vence en ${Math.ceil(diffH)}h` : `vence en ${diffD}d`;
  const className = diffH < 24
    ? "border-red-500/30 bg-red-500/10 text-red-500"
    : "border-amber-500/30 bg-amber-500/10 text-amber-500";
  return { label, className };
}

const STATUS_OPTIONS: QuoteStatus[] = ["draft", "sent", "viewed", "approved", "rejected", "converted", "expired"];

function StatusDropdown({ current, onSelect }: { current: QuoteStatus; onSelect: (s: QuoteStatus) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button type="button" variant="toolbar" size="sm" className="h-8 rounded-xl px-2.5 text-[11px]" onClick={() => setOpen((prev) => !prev)}>
        <Clock size={10} /> Estado
      </Button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-2xl border border-border/70 bg-card py-1 shadow-xl">
          {STATUS_OPTIONS.map((status) => {
            const { label, icon: Icon } = STATUS_MAP[status];
            return (
              <button
                key={status}
                onClick={() => {
                  onSelect(status);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-secondary ${current === status ? "text-primary" : "text-foreground"}`}
              >
                <Icon size={11} /> {label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

interface QuoteListProps {
  quotes: Quote[];
  isDark?: boolean;
  onLoad: (quote: Quote) => void;
  onUpdateStatus: (id: number, status: QuoteStatus) => void;
  onDelete: (id: number) => void;
  onGoToCatalog: () => void;
  onDuplicate?: (id: number) => void;
  onConvertToOrder?: (quote: Quote) => void;
}

export function QuoteList({ quotes, isDark: _isDark, onLoad, onUpdateStatus, onDelete, onGoToCatalog, onDuplicate, onConvertToOrder }: QuoteListProps) {
  void _isDark;
  const { formatPrice, currency, formatUSD, formatARS } = useCurrency();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setExpanded((prev) => toggleSetValue(prev, id));
  }

  if (quotes.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList size={22} />}
        title="Todavia no guardaste cotizaciones"
        description="Arma un carrito y guardalo como propuesta para reutilizarlo o convertirlo mas tarde."
        actionLabel="Ver catalogo"
        onAction={onGoToCatalog}
        className="rounded-[24px] border border-border/70 bg-card py-20"
      />
    );
  }

  return (
    <div className="space-y-3">
      {quotes.map((quote) => {
        const isExpanded = expanded.has(quote.id);
        const expiryCountdown = getExpiryCountdown(quote.expires_at, quote.status);
        return (
          <SurfaceCard key={quote.id} tone="default" padding="none" className="overflow-hidden rounded-[24px] border border-border/70 bg-card shadow-sm">
            <div className="border-b border-border/70 px-5 pb-2 pt-4">
              <QuoteStatusStepper status={quote.status} />
            </div>

            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <button onClick={() => toggle(quote.id)} className="mt-1 rounded-xl p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground">
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">COT-{String(quote.id).padStart(4, "0")}</span>
                    {quote.version != null && quote.version > 1 ? <Badge variant="outline" className="text-[10px]">v{quote.version}</Badge> : null}
                    {quote.order_id != null ? <Badge variant="secondary" className="text-[10px]">Pedido creado</Badge> : null}
                    <QuoteStatusBadge status={quote.status} />
                    {expiryCountdown && (
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${expiryCountdown.className}`}>
                        <Clock size={9} />
                        {expiryCountdown.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(quote.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {quote.items.length} {quote.items.length === 1 ? "producto" : "productos"}
                    {" · "}
                    {quote.currency}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <span className="mr-1 hidden text-lg font-bold tabular-nums text-primary sm:block">{formatPrice(quote.total)}</span>
                <StatusDropdown current={quote.status} onSelect={(status) => onUpdateStatus(quote.id, status)} />
                <Button type="button" variant="toolbar" size="sm" className="h-8 rounded-xl text-[11px]" onClick={() => onLoad(quote)}>
                  <RotateCcw size={10} /> Reutilizar
                </Button>
                {onDuplicate ? (
                  <Button type="button" variant="toolbar" size="sm" className="h-8 rounded-xl text-[11px]" onClick={() => onDuplicate(quote.id)}>
                    <Copy size={10} /> Duplicar
                  </Button>
                ) : null}
                {onConvertToOrder && !quote.order_id ? (
                  <Button type="button" variant="secondary" size="sm" className="h-8 rounded-xl text-[11px]" onClick={() => onConvertToOrder(quote)}>
                    <ShoppingBag size={10} /> Pedido
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => onDelete(quote.id)}>
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>

            {isExpanded ? (
              <div className="space-y-3 px-5 py-4">
                <div className="space-y-1.5">
                  {quote.items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/70 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">{item.name}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span>x{item.quantity}</span>
                          <Badge variant="outline" className="text-[10px]">IVA {item.ivaRate}%</Badge>
                        </div>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums text-primary">{formatPrice(item.totalWithIVA)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col items-end gap-1 border-t border-border/70 pt-3">
                  <div className="flex flex-wrap gap-6 text-xs text-muted-foreground">
                    <span>Subtotal <span className="font-semibold text-foreground">{formatPrice(quote.subtotal)}</span></span>
                    <span>IVA <span className="font-semibold text-foreground">+ {formatPrice(quote.ivaTotal)}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <span className="text-lg font-bold tabular-nums text-primary">{formatPrice(quote.total)}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{currency === "USD" ? formatARS(quote.total) : formatUSD(quote.total)}</span>
                  </div>
                </div>
              </div>
            ) : null}
          </SurfaceCard>
        );
      })}
    </div>
  );
}
