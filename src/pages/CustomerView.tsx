import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ShoppingBag, FileText, Receipt,
  Wallet, Settings, Loader2, Upload, ExternalLink,
  CreditCard, CheckCircle2, XCircle, AlertTriangle,
  Save, Calendar, Shield,
} from "lucide-react";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { NotesFeed } from "@/components/customer/NotesFeed";
import {
  fetchClientProfile,
  fetchClientOrders,
  fetchClientQuotes,
  fetchClientInvoices,
  fetchAccountMovements,
  fetchClientNotes,
  updateClientProfile,
  type ClientDetail,
  type ClientOrder,
  type ClientQuote,
  type AccountMovement,
  type ClientNote,
  type PrecioLista,
  type ProfileTaxStatus,
} from "@/lib/api/clientDetail";
import type { Invoice } from "@/lib/api/invoices";
import { supabase } from "@/lib/supabase";
import { useCurrency } from "@/context/CurrencyContext";

// ── Tab config ────────────────────────────────────────────────────────────────

type Tab = "resumen" | "pedidos" | "cotizaciones" | "facturas" | "cuenta" | "credito" | "datos";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "resumen",      label: "Resumen",         icon: LayoutDashboard },
  { id: "pedidos",      label: "Pedidos",          icon: ShoppingBag     },
  { id: "cotizaciones", label: "Cotizaciones",     icon: FileText        },
  { id: "facturas",     label: "Facturas",         icon: Receipt         },
  { id: "cuenta",       label: "Cuenta",           icon: Wallet          },
  { id: "credito",      label: "Crédito",          icon: CreditCard      },
  { id: "datos",        label: "Datos",            icon: Settings        },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: "En revisión", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  approved:  { label: "Aprobado",    cls: "bg-green-500/15 text-green-400 border-green-500/30"   },
  preparing: { label: "Preparando",  cls: "bg-blue-500/15 text-blue-400 border-blue-500/30"      },
  shipped:   { label: "Enviado",     cls: "bg-purple-500/15 text-purple-400 border-purple-500/30"},
  dispatched:{ label: "Despachado",  cls: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"},
  delivered: { label: "Entregado",   cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"},
  rejected:  { label: "Rechazado",   cls: "bg-red-500/15 text-red-400 border-red-500/30"         },
};

const QUOTE_STATUS: Record<string, { label: string; cls: string }> = {
  draft:    { label: "Borrador",  cls: "bg-gray-500/15 text-gray-400 border-gray-500/30"       },
  sent:     { label: "Enviada",   cls: "bg-blue-500/15 text-blue-400 border-blue-500/30"       },
  viewed:   { label: "Vista",     cls: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  approved: { label: "Aprobada",  cls: "bg-green-500/15 text-green-400 border-green-500/30"    },
  rejected: { label: "Rechazada", cls: "bg-red-500/15 text-red-400 border-red-500/30"          },
  expired:  { label: "Expirada",  cls: "bg-amber-500/15 text-amber-400 border-amber-500/30"    },
};

const INVOICE_STATUS: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Borrador",  cls: "bg-gray-500/15 text-gray-400 border-gray-500/30"    },
  sent:      { label: "Enviada",   cls: "bg-blue-500/15 text-blue-400 border-blue-500/30"    },
  paid:      { label: "Pagada",    cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"},
  overdue:   { label: "Vencida",   cls: "bg-red-500/15 text-red-400 border-red-500/30"       },
  cancelled: { label: "Cancelada", cls: "bg-gray-500/15 text-gray-400 border-gray-500/30"    },
};

const MOV_CONFIG: Record<string, { label: string; sign: string; cls: string }> = {
  factura:     { label: "Factura",       sign: "+", cls: "text-red-400"     },
  pago:        { label: "Pago",          sign: "−", cls: "text-emerald-400" },
  nota_credito:{ label: "Nota crédito",  sign: "−", cls: "text-blue-400"   },
  ajuste:      { label: "Ajuste",        sign: "±", cls: "text-amber-400"  },
};

const TAX_STATUS_OPTIONS: Array<{ value: ProfileTaxStatus; label: string }> = [
  { value: "no_especificado", label: "No especificado" },
  { value: "responsable_inscripto", label: "Responsable Inscripto" },
  { value: "monotributista", label: "Monotributista" },
  { value: "exento", label: "Exento" },
  { value: "consumidor_final", label: "Consumidor Final" },
];

function StatusBadge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

// ── Resumen Tab ───────────────────────────────────────────────────────────────

function ResumenTab({
  client, orders, invoices, movements, notes, isDark, onNotesRefresh,
}: {
  client: ClientDetail;
  orders: ClientOrder[];
  invoices: Invoice[];
  movements: AccountMovement[];
  notes: ClientNote[];
  isDark: boolean;
  onNotesRefresh: () => void;
}) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const { formatPrice } = useCurrency();

  const activeOrders  = orders.filter((o) => !["delivered","rejected"].includes(o.status));
  const lastOrder     = orders[0];
  const pendingInv    = invoices.filter((i) => ["sent","overdue"].includes(i.status));
  const saldo         = movements.reduce((s, m) => s + m.monto, 0);

  const kpis = [
    {
      label: "Saldo cuenta",
      value: formatPrice(Math.abs(saldo)),
      sub:   saldo < 0 ? "a favor" : saldo > 0 ? "debe" : "al día",
      cls:   saldo > 0 ? "text-red-400" : saldo < 0 ? "text-emerald-400" : dk("text-white","text-[#171717]"),
    },
    {
      label: "Crédito disponible",
      value: client.credit_limit > 0
        ? formatPrice(Math.max(0, client.credit_limit - client.credit_used))
        : "Sin límite",
      sub:   client.credit_limit > 0
        ? `Límite: ${formatPrice(client.credit_limit)}`
        : undefined,
      cls: dk("text-white","text-[#171717]"),
    },
    {
      label: "Pedidos activos",
      value: String(activeOrders.length),
      sub:   `${orders.length} en total`,
      cls: dk("text-white","text-[#171717]"),
    },
    {
      label: "Facturas pendientes",
      value: String(pendingInv.length),
      sub:   pendingInv.length > 0
        ? formatPrice(pendingInv.reduce((s, i) => s + i.total, 0))
        : "Ninguna",
      cls: pendingInv.length > 0 ? "text-amber-400" : dk("text-white","text-[#171717]"),
    },
  ];

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className={`${dk("bg-[#111] border-[#1f1f1f]","bg-white border-[#e5e5e5]")} border rounded-xl px-4 py-3`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252] mb-1">{k.label}</p>
            <p className={`text-xl font-extrabold tabular-nums ${k.cls}`}>{k.value}</p>
            {k.sub && <p className="text-[10px] text-[#525252] mt-0.5">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Última compra */}
      {lastOrder && (
        <div className={`${dk("bg-[#111] border-[#1f1f1f]","bg-white border-[#e5e5e5]")} border rounded-xl px-4 py-3 flex items-center justify-between`}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252] mb-1">Última compra</p>
            <p className={`text-sm font-semibold ${dk("text-white","text-[#171717]")}`}>
              {lastOrder.order_number ?? `#${String(lastOrder.id).slice(0,8)}`}
              {" · "}
              <span className="text-[#2D9F6A]">{formatPrice(lastOrder.total)}</span>
            </p>
            <p className="text-[10px] text-[#525252] mt-0.5">{fmtDate(lastOrder.created_at)}</p>
          </div>
          <StatusBadge
            label={(ORDER_STATUS[lastOrder.status] ?? { label: lastOrder.status, cls: "" }).label}
            cls={(ORDER_STATUS[lastOrder.status] ?? { cls: "" }).cls}
          />
        </div>
      )}

      {/* Actividad reciente */}
      <div className={`${dk("bg-[#111] border-[#1f1f1f]","bg-white border-[#e5e5e5]")} border rounded-xl divide-y ${dk("divide-[#1a1a1a]","divide-[#f0f0f0]")}`}>
        <p className={`px-4 py-2.5 text-xs font-bold ${dk("text-[#737373]","text-[#737373]")}`}>
          Actividad reciente
        </p>
        {orders.slice(0, 3).map((o) => (
          <div key={o.id} className="px-4 py-2.5 flex items-center justify-between">
            <div>
              <p className={`text-xs font-medium ${dk("text-[#d4d4d4]","text-[#171717]")}`}>
                Pedido {o.order_number ?? `#${String(o.id).slice(0,8)}`}
              </p>
              <p className="text-[10px] text-[#525252]">{fmtDate(o.created_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold tabular-nums ${dk("text-white","text-[#171717]")}`}>
                {formatPrice(o.total)}
              </span>
              <StatusBadge
                label={(ORDER_STATUS[o.status] ?? { label: o.status, cls: "" }).label}
                cls={(ORDER_STATUS[o.status] ?? { cls: "" }).cls}
              />
            </div>
          </div>
        ))}
        {orders.length === 0 && (
          <p className="px-4 py-6 text-xs text-[#525252] text-center">Sin actividad aún</p>
        )}
      </div>

      {/* Notas CRM */}
      <NotesFeed
        clientId={client.id}
        notes={notes}
        isDark={isDark}
        onAdd={onNotesRefresh}
      />
    </div>
  );
}

// ── Pedidos Tab ───────────────────────────────────────────────────────────────

function PedidosTab({ orders, isDark }: { orders: ClientOrder[]; isDark: boolean }) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const { formatPrice } = useCurrency();

  return (
    <div className={`${dk("bg-[#111] border-[#1f1f1f]","bg-white border-[#e5e5e5]")} border rounded-xl overflow-hidden`}>
      <div className={`grid grid-cols-[1fr_100px_90px_90px] gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest ${dk("bg-[#0a0a0a] text-[#525252]","bg-[#f5f5f5] text-[#a3a3a3]")}`}>
        <span>Pedido</span><span>Fecha</span><span className="text-right">Total</span><span className="text-right">Estado</span>
      </div>
      {orders.length === 0 && (
        <p className="text-center text-xs text-[#525252] py-10">Sin pedidos</p>
      )}
      {orders.map((o) => (
        <div key={o.id} className={`grid grid-cols-[1fr_100px_90px_90px] gap-2 px-4 py-2.5 border-t items-center ${dk("border-[#1a1a1a] odd:bg-[#0d0d0d]","border-[#f0f0f0] odd:bg-[#fafafa]")}`}>
          <div>
            <p className={`text-xs font-medium ${dk("text-[#d4d4d4]","text-[#171717]")}`}>
              {o.order_number ?? `#${String(o.id).slice(0,8)}`}
            </p>
            <p className="text-[10px] text-[#525252]">
              {o.products?.length ?? 0} producto{o.products?.length !== 1 ? "s" : ""}
            </p>
          </div>
          <span className="text-xs text-[#737373]">{fmtDate(o.created_at)}</span>
          <span className={`text-xs font-bold tabular-nums text-right ${dk("text-white","text-[#171717]")}`}>
            {formatPrice(o.total)}
          </span>
          <div className="flex justify-end">
            <StatusBadge
              label={(ORDER_STATUS[o.status] ?? { label: o.status, cls: "" }).label}
              cls={(ORDER_STATUS[o.status] ?? { cls: "" }).cls}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Cotizaciones Tab ──────────────────────────────────────────────────────────

function CotizacionesTab({ quotes, isDark }: { quotes: ClientQuote[]; isDark: boolean }) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const { formatPrice } = useCurrency();

  return (
    <div className={`${dk("bg-[#111] border-[#1f1f1f]","bg-white border-[#e5e5e5]")} border rounded-xl overflow-hidden`}>
      <div className={`grid grid-cols-[1fr_100px_80px_100px_90px] gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest ${dk("bg-[#0a0a0a] text-[#525252]","bg-[#f5f5f5] text-[#a3a3a3]")}`}>
        <span>Cotización</span><span>Fecha</span><span>Moneda</span><span className="text-right">Total</span><span className="text-right">Estado</span>
      </div>
      {quotes.length === 0 && (
        <p className="text-center text-xs text-[#525252] py-10">Sin cotizaciones</p>
      )}
      {quotes.map((q) => (
        <div key={q.id} className={`grid grid-cols-[1fr_100px_80px_100px_90px] gap-2 px-4 py-2.5 border-t items-center ${dk("border-[#1a1a1a] odd:bg-[#0d0d0d]","border-[#f0f0f0] odd:bg-[#fafafa]")}`}>
          <span className={`text-xs font-medium ${dk("text-[#d4d4d4]","text-[#171717]")}`}>
            #{q.id}
            {q.converted_to_order_id ? <span className="ml-1 text-[#525252]">(convertida)</span> : null}
          </span>
          <span className="text-xs text-[#737373]">{fmtDate(q.created_at)}</span>
          <span className="text-xs text-[#737373]">{q.currency}</span>
          <span className={`text-xs font-bold tabular-nums text-right ${dk("text-white","text-[#171717]")}`}>
            {formatPrice(q.total)}
          </span>
          <div className="flex justify-end">
            <StatusBadge
              label={(QUOTE_STATUS[q.status] ?? { label: q.status, cls: "" }).label}
              cls={(QUOTE_STATUS[q.status] ?? { cls: "" }).cls}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Facturas Tab ──────────────────────────────────────────────────────────────

function FacturasTab({
  invoices, clientId, isDark, onRefresh,
}: {
  invoices: Invoice[];
  clientId: string;
  isDark: boolean;
  onRefresh: () => void;
}) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const { formatPrice } = useCurrency();
  const fileRef  = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null); // invoice id being uploaded
  const [uploadErr, setUploadErr] = useState("");

  async function handlePdfUpload(inv: Invoice, file: File) {
    // Validate MIME
    if (file.type !== "application/pdf") {
      setUploadErr(`${inv.invoice_number}: Solo se aceptan archivos PDF`);
      return;
    }
    setUploading(inv.id);
    setUploadErr("");
    try {
      const path = `${clientId}/${inv.id}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("invoices")
        .upload(path, file, { upsert: true, contentType: "application/pdf" });
      if (upErr) throw new Error(upErr.message);

      const { data: urlData } = supabase.storage
        .from("invoices")
        .getPublicUrl(path);

      const { error: dbErr } = await supabase
        .from("invoices")
        .update({ pdf_url: urlData.publicUrl })
        .eq("id", inv.id);
      if (dbErr) throw new Error(dbErr.message);

      onRefresh();
    } catch (e: unknown) {
      setUploadErr(e instanceof Error ? e.message : "Error al subir PDF");
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="space-y-2">
      {uploadErr && (
        <p className="text-xs text-red-400 px-1">{uploadErr}</p>
      )}
      {/* Hidden file input — shared, triggered per-row */}
      <input ref={fileRef} type="file" accept="application/pdf" className="hidden" />

      <div className={`${dk("bg-[#111] border-[#1f1f1f]","bg-white border-[#e5e5e5]")} border rounded-xl overflow-hidden`}>
        <div className={`grid grid-cols-[1fr_95px_85px_90px_80px_50px] gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest ${dk("bg-[#0a0a0a] text-[#525252]","bg-[#f5f5f5] text-[#a3a3a3]")}`}>
          <span>Factura</span><span>Emisión</span><span>Vencim.</span>
          <span className="text-right">Total</span><span className="text-right">Estado</span>
          <span className="text-right">PDF</span>
        </div>
        {invoices.length === 0 && (
          <p className="text-center text-xs text-[#525252] py-10">Sin facturas</p>
        )}
        {invoices.map((inv) => (
          <div key={inv.id} className={`grid grid-cols-[1fr_95px_85px_90px_80px_50px] gap-2 px-4 py-2.5 border-t items-center ${dk("border-[#1a1a1a] odd:bg-[#0d0d0d]","border-[#f0f0f0] odd:bg-[#fafafa]")}`}>
            <span className={`text-xs font-medium truncate ${dk("text-[#d4d4d4]","text-[#171717]")}`}>
              {inv.invoice_number}
            </span>
            <span className="text-xs text-[#737373]">{fmtDate(inv.created_at)}</span>
            <span className={`text-xs ${inv.status === "overdue" ? "text-red-400" : "text-[#737373]"}`}>
              {inv.due_date ? fmtDate(inv.due_date) : "—"}
            </span>
            <span className={`text-xs font-bold tabular-nums text-right ${dk("text-white","text-[#171717]")}`}>
              {formatPrice(inv.total)}
            </span>
            <div className="flex justify-end">
              <StatusBadge
                label={(INVOICE_STATUS[inv.status] ?? { label: inv.status, cls: "" }).label}
                cls={(INVOICE_STATUS[inv.status] ?? { cls: "" }).cls}
              />
            </div>
            {/* PDF upload / view */}
            <div className="flex justify-end">
              {uploading === inv.id ? (
                <Loader2 size={13} className="animate-spin text-[#2D9F6A]" />
              ) : inv.pdf_url ? (
                <a
                  href={inv.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  title="Ver PDF"
                  className="text-[#2D9F6A] hover:text-[#25875a] transition"
                >
                  <ExternalLink size={13} />
                </a>
              ) : (
                <button
                  title="Subir PDF"
                  onClick={() => {
                    const input = fileRef.current;
                    if (!input) return;
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handlePdfUpload(inv, file);
                      input.value = "";
                    };
                    input.click();
                  }}
                  className={`transition ${dk("text-[#525252] hover:text-white","text-[#aaa] hover:text-[#171717]")}`}
                >
                  <Upload size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Cuenta Corriente Tab ──────────────────────────────────────────────────────

function CuentaTab({ movements, isDark }: { movements: AccountMovement[]; isDark: boolean }) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const { formatPrice } = useCurrency();

  // Saldo acumulado (de más reciente a más antiguo → invertir para calcular)
  const ordered  = [...movements].reverse();
  let running    = 0;
  const withBalance = ordered.map((m) => {
    running += m.monto;
    return { ...m, balance: running };
  }).reverse();

  const saldoActual = movements.reduce((s, m) => s + m.monto, 0);
  const cfg = MOV_CONFIG;

  return (
    <div className="space-y-4">
      {/* Saldo actual */}
      <div className={`${dk("bg-[#111] border-[#1f1f1f]","bg-white border-[#e5e5e5]")} border rounded-xl px-4 py-3 flex items-center justify-between`}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#525252] mb-1">Saldo actual</p>
          <p className={`text-2xl font-extrabold tabular-nums ${saldoActual > 0 ? "text-red-400" : saldoActual < 0 ? "text-emerald-400" : dk("text-white","text-[#171717]")}`}>
            {saldoActual === 0 ? "—" : formatPrice(Math.abs(saldoActual))}
          </p>
          <p className="text-[10px] text-[#525252] mt-0.5">
            {saldoActual > 0 ? "debe" : saldoActual < 0 ? "a favor" : "al día"}
          </p>
        </div>
        <p className="text-xs text-[#525252]">{movements.length} movimiento{movements.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Tabla */}
      <div className={`${dk("bg-[#111] border-[#1f1f1f]","bg-white border-[#e5e5e5]")} border rounded-xl overflow-hidden`}>
        <div className={`grid grid-cols-[90px_110px_1fr_90px_90px] gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest ${dk("bg-[#0a0a0a] text-[#525252]","bg-[#f5f5f5] text-[#a3a3a3]")}`}>
          <span>Fecha</span><span>Tipo</span><span>Descripción</span>
          <span className="text-right">Monto</span><span className="text-right">Saldo</span>
        </div>
        {withBalance.length === 0 && (
          <p className="text-center text-xs text-[#525252] py-10">Sin movimientos</p>
        )}
        {withBalance.map((m) => {
          const mc = cfg[m.tipo] ?? { label: m.tipo, sign: "+", cls: "text-[#737373]" };
          return (
            <div key={m.id} className={`grid grid-cols-[90px_110px_1fr_90px_90px] gap-2 px-4 py-2.5 border-t items-center ${dk("border-[#1a1a1a] odd:bg-[#0d0d0d]","border-[#f0f0f0] odd:bg-[#fafafa]")}`}>
              <span className="text-xs text-[#737373]">{fmtDate(m.fecha)}</span>
              <span className={`text-xs font-medium ${mc.cls}`}>{mc.label}</span>
              <span className="text-xs text-[#525252] truncate">{m.descripcion ?? "—"}</span>
              <span className={`text-xs font-bold tabular-nums text-right ${mc.cls}`}>
                {mc.sign}{formatPrice(Math.abs(m.monto))}
              </span>
              <span className={`text-xs font-bold tabular-nums text-right ${m.balance > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {formatPrice(Math.abs(m.balance))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Crédito Tab ───────────────────────────────────────────────────────────────

const PAYMENT_TERMS_OPTIONS = [
  { value: 0,   label: "Contado (0 días)" },
  { value: 15,  label: "15 días" },
  { value: 30,  label: "30 días" },
  { value: 45,  label: "45 días" },
  { value: 60,  label: "60 días" },
  { value: 90,  label: "90 días" },
  { value: 120, label: "120 días" },
];

function CreditoTab({
  client,
  isDark,
  onRefresh,
}: {
  client: ClientDetail;
  isDark: boolean;
  onRefresh: () => void;
}) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const { formatPrice } = useCurrency();

  const [form, setForm] = useState({
    credit_limit:       client.credit_limit ?? 0,
    payment_terms:      client.payment_terms ?? 30,
    credit_approved:    client.credit_approved ?? false,
    credit_review_date: client.credit_review_date ?? "",
    notas_credito:      client.notas_credito ?? "",
    max_order_value:    client.max_order_value ?? 0,
    estado:             client.estado,
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [err,    setErr]    = useState("");

  const creditUsed      = client.credit_used ?? 0;
  const creditAvail     = Math.max(0, form.credit_limit - creditUsed);
  const creditPct       = form.credit_limit > 0 ? Math.min(100, (creditUsed / form.credit_limit) * 100) : 0;
  const danger          = creditPct >= 80;

  async function save() {
    setSaving(true); setSaved(false); setErr("");
    try {
      await updateClientProfile(client.id, {
        credit_limit:       form.credit_limit,
        payment_terms:      form.payment_terms,
        credit_approved:    form.credit_approved,
        credit_review_date: form.credit_review_date || undefined,
        notas_credito:      form.notas_credito,
        max_order_value:    form.max_order_value,
        estado:             form.estado,
      } as Parameters<typeof updateClientProfile>[1]);
      setSaved(true);
      onRefresh();
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = `w-full border rounded-lg px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-[#f5f5f5] border-[#e0e0e0] text-[#171717]")}`;
  const labelCls = "text-xs text-[#737373] mb-1 block font-medium";

  return (
    <div className="space-y-4">

      {/* Estado de crédito overview */}
      <div className={`${dk("bg-[#111] border-[#1f1f1f]","bg-white border-[#e5e5e5]")} border rounded-xl p-5`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard size={15} className="text-[#2D9F6A]" />
            <h3 className={`text-sm font-bold ${dk("text-white","text-[#171717]")}`}>Estado de Crédito</h3>
          </div>
          {/* Approval badge */}
          {form.credit_approved ? (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 size={10} /> Aprobado
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30">
              <XCircle size={10} /> No aprobado
            </span>
          )}
        </div>

        {/* Credit bar */}
        {form.credit_limit > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#737373]">Uso de crédito</span>
              <span className={`text-xs font-bold tabular-nums ${danger ? "text-red-400" : "text-[#2D9F6A]"}`}>
                {formatPrice(creditUsed)} / {formatPrice(form.credit_limit)}
              </span>
            </div>
            <div className={`h-2 rounded-full ${dk("bg-[#1c1c1c]","bg-[#e5e5e5]")} overflow-hidden`}>
              <div
                className={`h-full rounded-full transition-all ${danger ? "bg-red-500" : creditPct >= 60 ? "bg-amber-400" : "bg-[#2D9F6A]"}`}
                style={{ width: `${creditPct}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-[#525252]">Disponible: <span className={`font-bold ${danger ? "text-red-400" : "text-[#2D9F6A]"}`}>{formatPrice(creditAvail)}</span></span>
              <span className="text-[10px] text-[#525252]">{creditPct.toFixed(0)}% usado</span>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className={`rounded-lg px-3 py-2.5 ${dk("bg-[#0d0d0d]","bg-[#f9f9f9]")}`}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#525252]">Términos de pago</p>
            <p className={`text-sm font-bold ${dk("text-white","text-[#171717]")} mt-0.5`}>
              {form.payment_terms === 0 ? "Contado" : `${form.payment_terms} días`}
            </p>
          </div>
          <div className={`rounded-lg px-3 py-2.5 ${dk("bg-[#0d0d0d]","bg-[#f9f9f9]")}`}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#525252]">Máx. por pedido</p>
            <p className={`text-sm font-bold ${dk("text-white","text-[#171717]")} mt-0.5`}>
              {form.max_order_value > 0 ? formatPrice(form.max_order_value) : "Sin límite"}
            </p>
          </div>
          <div className={`rounded-lg px-3 py-2.5 ${dk("bg-[#0d0d0d]","bg-[#f9f9f9]")}`}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#525252]">Próx. revisión</p>
            <p className={`text-sm font-bold ${dk("text-white","text-[#171717]")} mt-0.5`}>
              {form.credit_review_date
                ? new Date(form.credit_review_date).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
                : "—"}
            </p>
          </div>
        </div>

        {/* Alert if credit_approved but estado = bloqueado */}
        {form.credit_approved && form.estado === "bloqueado" && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertTriangle size={12} />
            La cuenta está bloqueada aunque el crédito esté aprobado
          </div>
        )}
      </div>

      {/* Edit form */}
      <div className={`${dk("bg-[#111] border-[#1f1f1f]","bg-white border-[#e5e5e5]")} border rounded-xl p-5 space-y-4`}>
        <div className="flex items-center gap-2 mb-2">
          <Shield size={14} className="text-[#2D9F6A]" />
          <h3 className={`text-sm font-bold ${dk("text-white","text-[#171717]")}`}>Configuración de Crédito</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Crédito aprobado toggle */}
          <div className="flex items-center justify-between md:col-span-2 p-3 rounded-lg border ${dk('border-[#262626]','border-[#e0e0e0]')}">
            <div>
              <p className={`text-sm font-semibold ${dk("text-white","text-[#171717]")}`}>Crédito aprobado</p>
              <p className="text-xs text-[#737373] mt-0.5">El cliente puede comprar a crédito</p>
            </div>
            <button
              onClick={() => setForm((f) => ({ ...f, credit_approved: !f.credit_approved }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.credit_approved ? "bg-[#2D9F6A]" : dk("bg-[#333]","bg-[#d4d4d4]")
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                form.credit_approved ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
          </div>

          {/* Estado cuenta */}
          <div>
            <label className={labelCls}>Estado de cuenta</label>
            <select
              value={form.estado}
              onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value as ClientDetail["estado"] }))}
              className={inputCls}
            >
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
              <option value="bloqueado">Bloqueado</option>
            </select>
          </div>

          {/* Términos de pago */}
          <div>
            <label className={labelCls}>Términos de pago</label>
            <select
              value={form.payment_terms}
              onChange={(e) => setForm((f) => ({ ...f, payment_terms: Number(e.target.value) }))}
              className={inputCls}
            >
              {PAYMENT_TERMS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Límite de crédito */}
          <div>
            <label className={labelCls}>Límite de crédito (ARS)</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={form.credit_limit}
              onChange={(e) => setForm((f) => ({ ...f, credit_limit: Number(e.target.value) }))}
              className={inputCls}
              placeholder="0 = sin límite"
            />
          </div>

          {/* Máximo por pedido */}
          <div>
            <label className={labelCls}>Máximo por pedido (ARS)</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={form.max_order_value}
              onChange={(e) => setForm((f) => ({ ...f, max_order_value: Number(e.target.value) }))}
              className={inputCls}
              placeholder="0 = sin límite"
            />
          </div>

          {/* Próxima revisión */}
          <div>
            <label className={labelCls}>
              <Calendar size={11} className="inline mr-1" />
              Próxima revisión de crédito
            </label>
            <input
              type="date"
              value={form.credit_review_date}
              onChange={(e) => setForm((f) => ({ ...f, credit_review_date: e.target.value }))}
              className={inputCls}
            />
          </div>

          {/* Notas de crédito */}
          <div className="md:col-span-2">
            <label className={labelCls}>Notas internas de crédito</label>
            <textarea
              rows={3}
              value={form.notas_credito}
              onChange={(e) => setForm((f) => ({ ...f, notas_credito: e.target.value }))}
              placeholder="Historial de garantías, avales, condiciones especiales…"
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {err && <p className="text-xs text-red-400">{err}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 bg-[#2D9F6A] hover:bg-[#25875a] disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? "Guardando…" : saved ? "¡Guardado!" : "Guardar cambios"}
          </button>
          {saved && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 size={12} /> Guardado correctamente</span>}
        </div>
      </div>

      {/* Approved by info */}
      {client.credit_approved_at && (
        <div className={`${dk("bg-[#111] border-[#1f1f1f]","bg-white border-[#e5e5e5]")} border rounded-xl px-4 py-3 flex items-center gap-2 text-xs text-[#525252]`}>
          <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
          Crédito aprobado el {new Date(client.credit_approved_at).toLocaleDateString("es-AR", {
            day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
          })}
        </div>
      )}
    </div>
  );
}

// ── Datos Tab (ex Config) ─────────────────────────────────────────────────────

function DatosTab({
  client,
  isDark,
  onRefresh,
}: {
  client: ClientDetail;
  isDark: boolean;
  onRefresh: () => void;
}) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const [form, setForm]   = useState({ ...client, tax_status: client.tax_status ?? "no_especificado" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    await updateClientProfile(client.id, {
      company_name:   form.company_name,
      contact_name:   form.contact_name,
      razon_social:   form.razon_social,
      cuit:           form.cuit,
      tax_status:     form.tax_status,
      phone:          form.phone,
      direccion:      form.direccion,
      ciudad:         form.ciudad,
      provincia:      form.provincia,
      credit_limit:   form.credit_limit,
      precio_lista:   form.precio_lista,
      notas_internas: form.notas_internas,
    });
    setSaving(false);
    setSaved(true);
    onRefresh();
    setTimeout(() => setSaved(false), 2000);
  }

  const field = (
    label: string,
    key: keyof typeof form,
    type: "text" | "number" = "text"
  ) => (
    <div>
      <label className="text-xs text-[#737373] mb-1 block">{label}</label>
      <input
        type={type}
        value={(form[key] as string | number) ?? ""}
        onChange={(e) =>
          setForm((f) => ({
            ...f,
            [key]: type === "number" ? Number(e.target.value) : e.target.value,
          }))
        }
        className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]","bg-[#f5f5f5] border-[#e0e0e0] text-[#171717]")}`}
      />
    </div>
  );

  return (
    <div className={`${dk("bg-[#111] border-[#1f1f1f]","bg-white border-[#e5e5e5]")} border rounded-xl p-5`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {field("Empresa / Nombre", "company_name")}
        {field("Contacto", "contact_name")}
        {field("Razón social", "razon_social")}
        {field("CUIT", "cuit")}
        <div>
          <label className="text-xs text-[#737373] mb-1 block">Condición fiscal</label>
          <select
            value={form.tax_status ?? "no_especificado"}
            onChange={(e) => setForm((f) => ({ ...f, tax_status: e.target.value as ProfileTaxStatus }))}
            className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white","bg-[#f5f5f5] border-[#e0e0e0] text-[#171717]")}`}
          >
            {TAX_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {field("Teléfono", "phone")}
        {field("Dirección", "direccion")}
        {field("Ciudad", "ciudad")}
        {field("Provincia", "provincia")}
        {field("Límite de crédito", "credit_limit", "number")}
        <div>
          <label className="text-xs text-[#737373] mb-1 block">Lista de precios</label>
          <select
            value={form.precio_lista}
            onChange={(e) => setForm((f) => ({ ...f, precio_lista: e.target.value as PrecioLista }))}
            className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white","bg-[#f5f5f5] border-[#e0e0e0] text-[#171717]")}`}
          >
            <option value="standard">Standard</option>
            <option value="mayorista">Mayorista</option>
            <option value="distribuidor">Distribuidor</option>
            <option value="especial">Especial</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-[#737373] mb-1 block">Notas internas</label>
          <textarea
            rows={3}
            value={form.notas_internas ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, notas_internas: e.target.value }))}
            className={`w-full border rounded-lg px-3 py-2 text-sm outline-none resize-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]","bg-[#f5f5f5] border-[#e0e0e0] text-[#171717]")}`}
          />
        </div>
      </div>
      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={save}
          disabled={saving}
          className="bg-[#2D9F6A] hover:bg-[#25875a] disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition"
        >
          {saving ? "Guardando…" : saved ? "¡Guardado!" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CustomerView() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("resumen");

  const [client,    setClient]    = useState<ClientDetail | null>(null);
  const [orders,    setOrders]    = useState<ClientOrder[]>([]);
  const [quotes,    setQuotes]    = useState<ClientQuote[]>([]);
  const [invoices,  setInvoices]  = useState<Invoice[]>([]);
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [notes,     setNotes]     = useState<ClientNote[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [p, o, q, inv, mov, n] = await Promise.all([
        fetchClientProfile(id),
        fetchClientOrders(id),
        fetchClientQuotes(id),
        fetchClientInvoices(id),
        fetchAccountMovements(id),
        fetchClientNotes(id),
      ]);
      setClient(p);
      setOrders(o);
      setQuotes(q);
      setInvoices(inv);
      setMovements(mov);
      setNotes(n);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar cliente");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Dark mode: match admin preference (dark by default) ─────────────────
  const isDark = true;
  const dk = (d: string, l: string) => (isDark ? d : l);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dk("bg-[#0a0a0a]","bg-[#fafafa]")}`}>
        <Loader2 className="animate-spin text-[#2D9F6A]" size={28} />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-4 ${dk("bg-[#0a0a0a] text-white","bg-[#fafafa] text-[#171717]")}`}>
        <p className="text-sm text-red-400">{error || "Cliente no encontrado"}</p>
        <button
          onClick={() => navigate("/admin")}
          className="text-xs text-[#2D9F6A] hover:underline"
        >
          Volver al admin
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${dk("bg-[#0a0a0a]","bg-[#fafafa]")}`}>
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Header */}
        <CustomerHeader
          client={client}
          isDark={isDark}
          onBack={() => navigate("/admin")}
          onRefresh={load}
        />

        {/* Tab nav */}
        <div className={`flex gap-0.5 p-1 rounded-xl border ${dk("bg-[#0d0d0d] border-[#1f1f1f]","bg-white border-[#e5e5e5]")}`}>
          {TABS.map(({ id: tid, label, icon: Icon }) => {
            const active = activeTab === tid;
            return (
              <button
                key={tid}
                onClick={() => setActiveTab(tid)}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg transition font-medium ${
                  active
                    ? "bg-[#2D9F6A] text-white"
                    : dk("text-[#737373] hover:text-white hover:bg-[#1a1a1a]","text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")
                }`}
              >
                <Icon size={12} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "resumen"      && <ResumenTab      client={client} orders={orders} invoices={invoices} movements={movements} notes={notes} isDark={isDark} onNotesRefresh={load} />}
        {activeTab === "pedidos"      && <PedidosTab      orders={orders}   isDark={isDark} />}
        {activeTab === "cotizaciones" && <CotizacionesTab quotes={quotes}   isDark={isDark} />}
        {activeTab === "facturas"     && <FacturasTab     invoices={invoices} clientId={client.id} isDark={isDark} onRefresh={load} />}
        {activeTab === "cuenta"       && <CuentaTab       movements={movements} isDark={isDark} />}
        {activeTab === "credito"      && <CreditoTab      client={client} isDark={isDark} onRefresh={load} />}
        {activeTab === "datos"        && <DatosTab        client={client} isDark={isDark} onRefresh={load} />}

      </div>
    </div>
  );
}
