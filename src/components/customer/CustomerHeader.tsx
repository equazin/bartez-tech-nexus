import { useState } from "react";
import {
  Building2, Phone, CreditCard, AlertTriangle, CheckCircle2,
  Ban, UserX, ChevronDown, Plus, DollarSign, ShoppingBag,
  ArrowLeft,
} from "lucide-react";
import type { ClientDetail, ClientEstado } from "@/lib/api/clientDetail";
import { updateClientProfile, registrarPago } from "@/lib/api/clientDetail";
import { useCurrency } from "@/context/CurrencyContext";
import { formatMoneyInPreferredCurrency } from "@/lib/money";

// ── Estado badge ──────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<ClientEstado, {
  label: string; icon: any; cls: string; dot: string;
}> = {
  activo:    { label: "Activo",    icon: CheckCircle2, cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", dot: "bg-emerald-400" },
  inactivo:  { label: "Inactivo",  icon: UserX,        cls: "text-gray-400 bg-gray-500/10 border-gray-500/30",         dot: "bg-gray-500"   },
  bloqueado: { label: "Bloqueado", icon: Ban,           cls: "text-red-400 bg-red-500/10 border-red-500/30",            dot: "bg-red-400"    },
};

// ── Credit bar ────────────────────────────────────────────────────────────────

function CreditBar({ used, limit, isDark }: { used: number; limit: number; isDark: boolean }) {
  const { currency, exchangeRate } = useCurrency();
  const dk = (d: string, l: string) => (isDark ? d : l);
  if (limit <= 0) return null;

  const pct     = Math.min((used / limit) * 100, 100);
  const barCls  = pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-[#2D9F6A]";
  const textCls = pct >= 100 ? "text-red-400" : pct >= 75 ? "text-amber-400" : "text-[#2D9F6A]";

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={dk("text-[#737373]", "text-[#737373]")}>Crédito utilizado</span>
        <span className={`font-bold tabular-nums ${textCls}`}>
          {formatMoneyInPreferredCurrency(used, "ARS", currency, exchangeRate.rate, 0)} / {formatMoneyInPreferredCurrency(limit, "ARS", currency, exchangeRate.rate, 0)}
        </span>
      </div>
      <div className={`h-2 rounded-full ${dk("bg-[#1f1f1f]", "bg-[#e8e8e8]")}`}>
        <div
          className={`h-full rounded-full transition-all ${barCls}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-[#525252]">
        <span>{pct.toFixed(0)}% utilizado</span>
        <span>Disponible: {formatMoneyInPreferredCurrency(Math.max(0, limit - used), "ARS", currency, exchangeRate.rate, 0)}</span>
      </div>
    </div>
  );
}

// ── Pago modal (inline) ───────────────────────────────────────────────────────

function PagoModal({
  client,
  isDark,
  onClose,
  onDone,
}: {
  client: ClientDetail;
  isDark: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const [monto, setMonto]   = useState("");
  const [desc, setDesc]     = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  async function submit() {
    const v = parseFloat(monto);
    if (!v || v <= 0) { setErr("Ingresá un monto válido"); return; }
    setSaving(true);
    setErr("");
    try {
      await registrarPago(client.id, v, desc || undefined);
      onDone();
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error al registrar pago");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`${dk("bg-[#111] border-[#2a2a2a]", "bg-white border-[#e5e5e5]")} border rounded-2xl p-6 w-full max-w-sm shadow-2xl`}>
        <h3 className={`font-bold mb-4 ${dk("text-white", "text-[#171717]")}`}>
          Registrar pago — {client.company_name}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#737373] mb-1 block">Monto</label>
            <input
              type="number"
              min="0"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-[#f5f5f5] border-[#e0e0e0] text-[#171717]")}`}
            />
          </div>
          <div>
            <label className="text-xs text-[#737373] mb-1 block">Descripción (opcional)</label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Transferencia / Cheque…"
              className={`w-full border rounded-lg px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-[#f5f5f5] border-[#e0e0e0] text-[#171717]")}`}
            />
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className={`flex-1 border rounded-lg py-2 text-sm transition ${dk("border-[#2a2a2a] text-[#737373] hover:text-white", "border-[#e0e0e0] text-[#737373] hover:text-[#171717]")}`}
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 bg-[#2D9F6A] hover:bg-[#25875a] disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition"
          >
            {saving ? "Guardando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  client: ClientDetail;
  isDark?: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onNewOrder?: () => void;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function CustomerHeader({
  client,
  isDark = true,
  onBack,
  onRefresh,
  onNewOrder,
}: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const estado = ESTADO_CONFIG[client.estado] ?? ESTADO_CONFIG.activo;
  const EstadoIcon = estado.icon;

  const [estadoOpen, setEstadoOpen] = useState(false);
  const [pagoOpen, setPagoOpen]     = useState(false);
  const [updatingEstado, setUpdatingEstado] = useState(false);

  async function changeEstado(next: ClientEstado) {
    setEstadoOpen(false);
    if (next === client.estado) return;
    setUpdatingEstado(true);
    try {
      await updateClientProfile(client.id, { estado: next });
      onRefresh();
    } finally {
      setUpdatingEstado(false);
    }
  }

  return (
    <>
      {pagoOpen && (
        <PagoModal
          client={client}
          isDark={isDark}
          onClose={() => setPagoOpen(false)}
          onDone={onRefresh}
        />
      )}

      <div className={`${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl p-5 space-y-4`}>

        {/* ── Row 1: back + nombre + estado + acciones ── */}
        <div className="flex items-start gap-3 flex-wrap">

          {/* Back */}
          <button
            onClick={onBack}
            className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center border transition shrink-0 ${dk("border-[#2a2a2a] text-[#737373] hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")}`}
          >
            <ArrowLeft size={14} />
          </button>

          {/* Avatar + nombre */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-[#2D9F6A]/20 flex items-center justify-center shrink-0">
              <Building2 size={18} className="text-[#2D9F6A]" />
            </div>
            <div className="min-w-0">
              <h1 className={`font-bold text-base leading-tight truncate ${dk("text-white", "text-[#171717]")}`}>
                {client.company_name || client.contact_name}
              </h1>
              <p className="text-xs text-[#737373] truncate">
                {client.contact_name}
                {client.razon_social && client.razon_social !== client.company_name
                  ? ` · ${client.razon_social}` : ""}
              </p>
            </div>
          </div>

          {/* Estado dropdown */}
          <div className="relative">
            <button
              onClick={() => setEstadoOpen((o) => !o)}
              disabled={updatingEstado}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition ${estado.cls} ${updatingEstado ? "opacity-50" : ""}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${estado.dot}`} />
              <EstadoIcon size={11} />
              <span className="font-medium">{estado.label}</span>
              <ChevronDown size={11} />
            </button>
            {estadoOpen && (
              <div className={`absolute right-0 top-full mt-1.5 w-40 border rounded-xl shadow-2xl z-20 overflow-hidden ${dk("bg-[#111] border-[#2a2a2a]", "bg-white border-[#e5e5e5]")}`}>
                {(Object.keys(ESTADO_CONFIG) as ClientEstado[]).map((e) => {
                  const cfg = ESTADO_CONFIG[e];
                  const Ic  = cfg.icon;
                  return (
                    <button
                      key={e}
                      onClick={() => changeEstado(e)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition ${dk("hover:bg-[#1a1a1a]", "hover:bg-[#f5f5f5]")} ${client.estado === e ? dk("bg-[#1a1a1a]", "bg-[#f5f5f5]") : ""}`}
                    >
                      <Ic size={12} className={cfg.cls.split(" ")[0]} />
                      <span className={dk("text-[#a3a3a3]", "text-[#525252]")}>{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagoOpen(true)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${dk("border-[#2a2a2a] text-[#737373] hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")}`}
            >
              <DollarSign size={12} /> Pago
            </button>
            {onNewOrder && (
              <button
                onClick={onNewOrder}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#2D9F6A] hover:bg-[#25875a] text-white transition"
              >
                <ShoppingBag size={12} /> Pedido
              </button>
            )}
          </div>
        </div>

        {/* ── Row 2: info chips ── */}
        <div className="flex flex-wrap gap-3">
          {client.phone && (
            <span className={`flex items-center gap-1.5 text-xs ${dk("text-[#737373]", "text-[#525252]")}`}>
              <Phone size={11} /> {client.phone}
            </span>
          )}
          {client.cuit && (
            <span className={`flex items-center gap-1.5 text-xs ${dk("text-[#737373]", "text-[#525252]")}`}>
              CUIT: {client.cuit}
            </span>
          )}
          {client.ciudad && (
            <span className={`text-xs ${dk("text-[#737373]", "text-[#525252]")}`}>
              {[client.ciudad, client.provincia].filter(Boolean).join(", ")}
            </span>
          )}
          <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md border ${dk("border-[#2a2a2a] text-[#737373]", "border-[#e5e5e5] text-[#737373]")}`}>
            <CreditCard size={10} /> {client.precio_lista}
          </span>
          {client.credit_limit > 0 && client.credit_used >= client.credit_limit && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <AlertTriangle size={11} /> Crédito agotado
            </span>
          )}
        </div>

        {/* ── Row 3: credit bar ── */}
        {client.credit_limit > 0 && (
          <CreditBar
            used={client.credit_used}
            limit={client.credit_limit}
            isDark={isDark}
          />
        )}

      </div>

      {/* Click-outside to close dropdown */}
      {estadoOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setEstadoOpen(false)} />
      )}
    </>
  );
}
