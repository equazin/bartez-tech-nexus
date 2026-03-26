import { useState } from "react";
import { Quote, QuoteStatus } from "@/models/quote";
import { useCurrency } from "@/context/CurrencyContext";
import {
  FileText, ChevronDown, ChevronRight, RotateCcw, Trash2, ClipboardList,
  Clock, CheckCircle2, XCircle, Eye, Send, Ban, AlertTriangle,
} from "lucide-react";

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_MAP: Record<QuoteStatus, { label: string; className: string; icon: any }> = {
  draft:    { label: "Borrador",  className: "bg-[#1f1f1f] text-[#a3a3a3] border-[#2a2a2a]",      icon: FileText },
  sent:     { label: "Enviada",   className: "bg-blue-500/15 text-blue-400 border-blue-500/30",    icon: Send },
  viewed:   { label: "Vista",     className: "bg-purple-500/15 text-purple-400 border-purple-500/30", icon: Eye },
  approved: { label: "Aprobada",  className: "bg-green-500/15 text-green-400 border-green-500/30",  icon: CheckCircle2 },
  rejected: { label: "Rechazada", className: "bg-red-500/15 text-red-400 border-red-500/30",        icon: XCircle },
  expired:  { label: "Expirada",  className: "bg-amber-500/15 text-amber-400 border-amber-500/30",  icon: AlertTriangle },
};

function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const { label, className, icon: Icon } = STATUS_MAP[status] ?? STATUS_MAP.draft;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${className}`}>
      <Icon size={10} /> {label}
    </span>
  );
}

// ── Status selector ───────────────────────────────────────────────────────────
const STATUS_OPTIONS: QuoteStatus[] = ["draft", "sent", "viewed", "approved", "rejected", "expired"];

function StatusDropdown({
  current, onSelect,
}: { current: QuoteStatus; onSelect: (s: QuoteStatus) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-[#737373] hover:text-white transition px-2 py-1 rounded-lg hover:bg-[#1f1f1f] border border-transparent hover:border-[#262626]"
      >
        <Clock size={10} /> Estado
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl shadow-black/60 py-1 min-w-[140px]">
          {STATUS_OPTIONS.map((s) => {
            const { label, icon: Icon } = STATUS_MAP[s];
            return (
              <button
                key={s}
                onClick={() => { onSelect(s); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition hover:bg-[#222] ${
                  current === s ? "text-[#2D9F6A]" : "text-[#a3a3a3]"
                }`}
              >
                <Icon size={11} /> {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface QuoteListProps {
  quotes: Quote[];
  isDark: boolean;
  onLoad: (quote: Quote) => void;
  onUpdateStatus: (id: number, status: QuoteStatus) => void;
  onDelete: (id: number) => void;
  onGoToCatalog: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function QuoteList({ quotes, isDark, onLoad, onUpdateStatus, onDelete, onGoToCatalog }: QuoteListProps) {
  const { formatPrice, currency, formatUSD, formatARS } = useCurrency();
  const dk = (d: string, l: string) => isDark ? d : l;
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (quotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-600">
        <ClipboardList size={36} className="mb-3 opacity-20" />
        <p className="text-sm font-medium text-gray-500">Todavía no guardaste ninguna cotización</p>
        <p className="text-xs text-gray-700 mt-1">Armá un carrito y guardalo como cotización</p>
        <button onClick={onGoToCatalog} className="mt-3 text-xs text-[#2D9F6A] hover:underline">
          Ver catálogo
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 max-w-3xl">
      {quotes.map((q) => {
        const isExpanded = expanded.has(q.id);
        return (
          <div key={q.id} className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl overflow-hidden`}>

            {/* Header row */}
            <div className={`flex items-center justify-between px-5 py-3.5 border-b ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}`}>
              <div className="flex items-center gap-3 min-w-0">
                {/* Expand toggle */}
                <button
                  onClick={() => toggle(q.id)}
                  className={`${dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#a3a3a3] hover:text-[#525252]")} transition shrink-0`}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">
                      COT-{String(q.id).padStart(4, "0")}
                    </span>
                    <QuoteStatusBadge status={q.status} />
                  </div>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    {new Date(q.created_at).toLocaleDateString("es-AR", {
                      day: "2-digit", month: "long", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                    {" · "}
                    {q.items.length} {q.items.length === 1 ? "producto" : "productos"}
                    {" · "}
                    {q.currency}
                  </p>
                </div>
              </div>

              {/* Right: total + actions */}
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <span className="text-base font-extrabold text-[#2D9F6A] tabular-nums hidden sm:block">
                  {formatPrice(q.total)}
                </span>
                <StatusDropdown current={q.status} onSelect={(s) => onUpdateStatus(q.id, s)} />
                <button
                  onClick={() => onLoad(q)}
                  title="Cargar al carrito"
                  className={`flex items-center gap-1 text-[11px] ${dk("text-[#737373] hover:text-white border-[#2a2a2a] hover:border-[#333] hover:bg-[#1f1f1f]", "text-[#737373] hover:text-[#171717] border-[#e5e5e5] hover:border-[#d4d4d4] hover:bg-[#f5f5f5]")} transition px-2 py-1 rounded-lg border`}
                >
                  <RotateCcw size={10} /> Reutilizar
                </button>
                <button
                  onClick={() => onDelete(q.id)}
                  title="Eliminar"
                  className="p-1.5 text-gray-600 hover:text-red-400 transition rounded-lg hover:bg-red-500/5"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Expanded: item list */}
            {isExpanded && (
              <div className="px-5 py-3 space-y-1.5">
                {q.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`${dk("text-gray-300", "text-[#525252]")} truncate`}>{item.name}</span>
                      <span className="text-gray-600 shrink-0">×{item.quantity}</span>
                      <span className={`text-[10px] font-mono ${dk("text-[#525252] bg-[#171717]", "text-[#a3a3a3] bg-[#f0f0f0]")} px-1.5 py-0.5 rounded shrink-0`}>
                        IVA {item.ivaRate}%
                      </span>
                    </div>
                    <span className="text-[#2D9F6A] font-semibold tabular-nums shrink-0 ml-4">
                      {formatPrice(item.totalWithIVA)}
                    </span>
                  </div>
                ))}

                {/* Totals mini-summary */}
                <div className={`mt-3 pt-3 border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")} flex flex-col items-end gap-1`}>
                  <div className="flex gap-6 text-xs text-gray-600">
                    <span>Subtotal s/IVA <span className="font-semibold text-gray-400">{formatPrice(q.subtotal)}</span></span>
                    <span>IVA <span className="font-semibold text-gray-400">+ {formatPrice(q.ivaTotal)}</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Total c/IVA</span>
                    <span className="text-lg font-extrabold text-[#2D9F6A] tabular-nums">{formatPrice(q.total)}</span>
                    <span className="text-[10px] text-gray-700 font-mono">
                      {currency === "USD" ? formatARS(q.total) : formatUSD(q.total)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
