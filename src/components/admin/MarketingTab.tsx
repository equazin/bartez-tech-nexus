import { useEffect, useState, useMemo } from "react";
import {
  Ticket, Plus, Trash2, Calendar, Percent, DollarSign,
  CheckCircle2, XCircle, TrendingUp, Users, MousePointerClick,
  ShoppingCart, AlertTriangle, Activity, RefreshCw, BarChart3,
  Megaphone, Lightbulb, ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────

interface MarketingTabProps { isDark?: boolean; }

interface Coupon {
  id: string; code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number; min_purchase: number;
  max_uses?: number; used_count: number;
  expires_at?: string; is_active: boolean; created_at: string;
}

interface FunnelRow {
  week: string;
  visits: number; sessions: number; landing_views: number;
  cta_clicks: number; registrations: number; approvals: number;
  first_orders: number; active_campaigns: number;
  pct_visits_to_cta: number | null;
  pct_cta_to_reg: number | null;
  pct_reg_to_approved: number | null;
  pct_approved_to_order: number | null;
}

interface CampaignStat {
  campaign: string;
  clicks: number;
  registrations: number;
  orders: number;
}

type SubTab = "funnel" | "campaigns" | "insights" | "coupons";

// ── Helpers ───────────────────────────────────────────────────

const dk = (isDark: boolean) => (d: string, l: string) => isDark ? d : l;
const fmt = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("es-AR");
const fmtPct = (n: number | null | undefined) =>
  n == null ? "—" : `${Number(n).toFixed(1)}%`;

// ── Component ─────────────────────────────────────────────────

export function MarketingTab({ isDark = true }: MarketingTabProps) {
  const d = dk(isDark);
  const [subTab, setSubTab] = useState<SubTab>("funnel");

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <h2 className={`font-bold text-base ${d("text-white", "text-[#171717]")}`}>Marketing B2B</h2>
        <p className="text-xs text-[#737373] mt-0.5">Funnel de captación, campañas y cupones</p>
      </div>

      {/* Sub-tabs */}
      <div className={`flex gap-1 p-1 rounded-xl border ${d("border-[#1f1f1f] bg-[#0a0a0a]", "border-[#e5e5e5] bg-[#f5f5f5]")}`}>
        {([
          { id: "funnel",    label: "Funnel B2B",   icon: TrendingUp },
          { id: "campaigns", label: "Campañas",      icon: Megaphone },
          { id: "insights",  label: "Insights",      icon: Lightbulb },
          { id: "coupons",   label: "Cupones",        icon: Ticket },
        ] as { id: SubTab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`flex items-center gap-1.5 flex-1 justify-center text-xs px-3 py-2 rounded-lg font-medium transition ${
              subTab === id
                ? "bg-[#2D9F6A] text-white shadow"
                : d("text-[#737373] hover:text-white hover:bg-[#1a1a1a]", "text-[#525252] hover:text-[#171717] hover:bg-white")
            }`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {subTab === "funnel"    && <FunnelSection    isDark={isDark} />}
      {subTab === "campaigns" && <CampaignsSection isDark={isDark} />}
      {subTab === "insights"  && <InsightsSection  isDark={isDark} />}
      {subTab === "coupons"   && <CouponsSection   isDark={isDark} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// FUNNEL SECTION
// ══════════════════════════════════════════════════════════════

function FunnelSection({ isDark }: { isDark: boolean }) {
  const d = dk(isDark);
  const [rows, setRows] = useState<FunnelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"4w" | "12w" | "all">("4w");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("funnel_metrics")
        .select("*")
        .order("week", { ascending: false })
        .limit(period === "4w" ? 4 : period === "12w" ? 12 : 100);
      setRows((data as FunnelRow[]) ?? []);
      setLoading(false);
    }
    void load();
  }, [period]);

  // Totals across the selected period
  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({
      visits:       acc.visits       + (r.visits       ?? 0),
      sessions:     acc.sessions     + (r.sessions     ?? 0),
      cta_clicks:   acc.cta_clicks   + (r.cta_clicks   ?? 0),
      registrations:acc.registrations+ (r.registrations?? 0),
      approvals:    acc.approvals    + (r.approvals     ?? 0),
      first_orders: acc.first_orders + (r.first_orders  ?? 0),
    }),
    { visits: 0, sessions: 0, cta_clicks: 0, registrations: 0, approvals: 0, first_orders: 0 }
  ), [rows]);

  const conversionRate = (a: number, b: number) =>
    b === 0 ? null : Math.round((a / b) * 1000) / 10;

  const steps = [
    { label: "Visitas",       value: totals.visits,        icon: Activity,        color: "text-blue-400",   bg: "bg-blue-500/10"  },
    { label: "Click CTA",     value: totals.cta_clicks,    icon: MousePointerClick,color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Registros",     value: totals.registrations, icon: Users,           color: "text-purple-400", bg: "bg-purple-500/10"},
    { label: "Aprobados",     value: totals.approvals,     icon: CheckCircle2,    color: "text-[#2D9F6A]",  bg: "bg-[#2D9F6A]/10" },
    { label: "Primer pedido", value: totals.first_orders,  icon: ShoppingCart,    color: "text-emerald-400",bg: "bg-emerald-500/10"},
  ];

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <p className={`text-xs ${d("text-[#525252]","text-[#a3a3a3]")}`}>
          Acumulado del período seleccionado
        </p>
        <div className={`flex gap-1 p-0.5 rounded-lg border ${d("border-[#1f1f1f] bg-[#0d0d0d]","border-[#e5e5e5] bg-[#f5f5f5]")}`}>
          {(["4w","12w","all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-[11px] px-2.5 py-1 rounded-md transition ${
                period === p
                  ? "bg-[#2D9F6A] text-white"
                  : d("text-[#525252] hover:text-white","text-[#737373] hover:text-[#171717]")
              }`}
            >
              {p === "4w" ? "4 semanas" : p === "12w" ? "12 semanas" : "Todo"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-5 gap-3">
          {Array.from({length:5}).map((_,i) => (
            <div key={i} className={`h-24 rounded-xl animate-pulse ${d("bg-[#111]","bg-[#f0f0f0]")}`} />
          ))}
        </div>
      ) : (
        <>
          {/* Funnel steps */}
          <div className="grid grid-cols-5 gap-3">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const prevVal = i > 0 ? steps[i - 1].value : null;
              const pct = prevVal !== null ? conversionRate(step.value, prevVal) : null;
              return (
                <div key={step.label} className={`relative rounded-xl border p-3 ${d("border-[#1f1f1f] bg-[#0d0d0d]","border-[#e5e5e5] bg-white")}`}>
                  {i > 0 && (
                    <span className="absolute -left-2 top-1/2 -translate-y-1/2 z-10">
                      <ArrowRight size={12} className="text-[#404040]" />
                    </span>
                  )}
                  <div className={`inline-flex p-1.5 rounded-lg mb-2 ${step.bg}`}>
                    <Icon size={12} className={step.color} />
                  </div>
                  <p className={`text-xl font-bold leading-none ${d("text-white","text-[#171717]")}`}>
                    {fmt(step.value)}
                  </p>
                  <p className="text-[10px] text-[#737373] mt-1">{step.label}</p>
                  {pct !== null && (
                    <p className={`text-[10px] font-semibold mt-1 ${pct >= 30 ? "text-[#2D9F6A]" : pct >= 10 ? "text-amber-400" : "text-red-400"}`}>
                      {fmtPct(pct)} conversión
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Conversion rates summary */}
          <div className={`rounded-xl border p-4 ${d("border-[#1f1f1f] bg-[#0d0d0d]","border-[#e5e5e5] bg-white")}`}>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${d("text-[#525252]","text-[#a3a3a3]")}`}>
              Tasas de conversión entre pasos
            </p>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Visita → CTA",       a: totals.cta_clicks,    b: totals.visits },
                { label: "CTA → Registro",      a: totals.registrations, b: totals.cta_clicks },
                { label: "Registro → Aprobado", a: totals.approvals,     b: totals.registrations },
                { label: "Aprobado → Pedido",   a: totals.first_orders,  b: totals.approvals },
              ].map(({ label, a, b }) => {
                const pct = conversionRate(a, b);
                return (
                  <div key={label}>
                    <p className="text-[10px] text-[#737373]">{label}</p>
                    <p className={`text-lg font-bold mt-0.5 ${
                      pct == null ? d("text-[#404040]","text-[#c0c0c0]")
                      : pct >= 30  ? "text-[#2D9F6A]"
                      : pct >= 10  ? "text-amber-400"
                      : "text-red-400"
                    }`}>
                      {fmtPct(pct)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekly table */}
          {rows.length > 0 && (
            <div className={`rounded-xl border overflow-hidden ${d("border-[#1f1f1f]","border-[#e5e5e5]")}`}>
              <div className={`grid grid-cols-[1fr_repeat(5,80px)] gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wider ${d("bg-[#0d0d0d] text-[#525252]","bg-[#f5f5f5] text-[#a3a3a3]")}`}>
                <span>Semana</span>
                <span className="text-right">Visitas</span>
                <span className="text-right">CTAs</span>
                <span className="text-right">Registros</span>
                <span className="text-right">Aprobados</span>
                <span className="text-right">1er pedido</span>
              </div>
              {rows.map((row) => (
                <div key={row.week} className={`grid grid-cols-[1fr_repeat(5,80px)] gap-2 px-4 py-2.5 border-t text-xs ${d("border-[#1a1a1a] bg-[#111]","border-[#f0f0f0] bg-white")}`}>
                  <span className={d("text-[#a3a3a3]","text-[#525252]")}>
                    {new Date(row.week).toLocaleDateString("es-AR", { day:"2-digit", month:"short" })}
                  </span>
                  <span className={`text-right ${d("text-white","text-[#171717]")}`}>{fmt(row.visits)}</span>
                  <span className={`text-right ${d("text-white","text-[#171717]")}`}>{fmt(row.cta_clicks)}</span>
                  <span className={`text-right ${d("text-white","text-[#171717]")}`}>{fmt(row.registrations)}</span>
                  <span className={`text-right ${d("text-white","text-[#171717]")}`}>{fmt(row.approvals)}</span>
                  <span className={`text-right font-semibold text-[#2D9F6A]`}>{fmt(row.first_orders)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// CAMPAIGNS SECTION
// ══════════════════════════════════════════════════════════════

interface CampaignPerf {
  id: string; name: string; type: string; status: string;
  daily_budget: number | null; target_segment: string | null; source: string;
  impressions_30d: number; clicks_30d: number; cost_30d: number;
  conversions_30d: number; revenue_30d: number;
  roas_30d: number; cpl_30d: number | null;
  last_synced: string | null;
}

const EMPTY_CAMPAIGN = { name: "", type: "search", target_segment: "", daily_budget: "" };

function CampaignsSection({ isDark }: { isDark: boolean }) {
  const d = dk(isDark);
  const [campaigns, setCampaigns] = useState<CampaignPerf[]>([]);
  const [utmStats, setUtmStats]   = useState<CampaignStat[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ ...EMPTY_CAMPAIGN });
  const [saving, setSaving]       = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [syncMsg, setSyncMsg]     = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: perfData }, { data: evtData }] = await Promise.all([
      supabase.from("campaign_performance").select("*").order("clicks_30d", { ascending: false }),
      supabase.from("marketing_events").select("utm_campaign, event_type").not("utm_campaign", "is", null),
    ]);

    setCampaigns((perfData as CampaignPerf[]) ?? []);

    // UTM stats from events (complementary)
    const map: Record<string, CampaignStat> = {};
    for (const row of (evtData ?? []) as { utm_campaign: string; event_type: string }[]) {
      const c = row.utm_campaign;
      if (!map[c]) map[c] = { campaign: c, clicks: 0, registrations: 0, orders: 0 };
      if (row.event_type === "cta_click")             map[c].clicks++;
      if (row.event_type === "registration_complete") map[c].registrations++;
      if (row.event_type === "first_order")           map[c].orders++;
    }
    setUtmStats(Object.values(map).sort((a, b) => b.clicks - a.clicks));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSaving(true);
    const id = `manual_${Date.now()}`;
    await supabase.from("ad_campaigns").insert({
      id, name: form.name.trim(), type: form.type,
      target_segment: form.target_segment || null,
      daily_budget: form.daily_budget ? Number(form.daily_budget) : null,
      source: "manual",
    });
    setForm({ ...EMPTY_CAMPAIGN });
    setShowForm(false);
    setSaving(false);
    void load();
  }

  async function triggerSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-ads-sync`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      });
      const data = await res.json() as { ok: boolean; message?: string; synced?: number };
      setSyncMsg(data.ok ? `✓ ${data.synced ?? 0} registros sincronizados` : (data.message ?? "Sin credenciales configuradas"));
      if (data.ok) void load();
    } catch {
      setSyncMsg("Error al conectar con la función de sync");
    }
    setSyncing(false);
  }

  const inputCls = `w-full text-xs px-3 py-2 rounded-lg border ${d("bg-[#0d0d0d] border-[#2a2a2a] text-white","bg-white border-[#e5e5e5] text-[#171717]")}`;

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className={`text-xs flex-1 ${d("text-[#525252]","text-[#a3a3a3]")}`}>
          {campaigns.length} campañas · últimos 30 días
        </p>
        <button
          onClick={triggerSync} disabled={syncing}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${d("border-[#2a2a2a] text-[#737373] hover:text-white","border-[#e5e5e5] text-[#525252] hover:bg-[#f5f5f5]")}`}
          title="Sincronizar con Google Ads API"
        >
          <RefreshCw size={11} className={syncing ? "animate-spin" : ""} /> Sync Google Ads
        </button>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#2D9F6A]/15 text-[#2D9F6A] border border-[#2D9F6A]/30 hover:bg-[#2D9F6A]/25 transition"
        >
          <Plus size={11} /> Nueva campaña manual
        </button>
      </div>

      {syncMsg && (
        <p className={`text-xs px-3 py-2 rounded-lg border ${syncMsg.startsWith("✓") ? "text-[#2D9F6A] border-[#2D9F6A]/20 bg-[#2D9F6A]/5" : "text-amber-400 border-amber-500/20 bg-amber-500/5"}`}>
          {syncMsg}
        </p>
      )}

      {/* Create form */}
      {showForm && (
        <div className={`rounded-xl border p-4 space-y-3 ${d("border-[#2a2a2a] bg-[#0a0a0a]","border-[#e5e5e5] bg-[#fafafa]")}`}>
          <p className={`text-xs font-bold ${d("text-white","text-[#171717]")}`}>Nueva campaña manual</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Nombre</label>
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Ej: Search B2B Laptops MAY26" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Tipo</label>
              <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} className={inputCls}>
                <option value="search">Search</option>
                <option value="display">Display</option>
                <option value="remarketing">Remarketing</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Segmento</label>
              <select value={form.target_segment} onChange={e => setForm(f => ({...f, target_segment: e.target.value}))} className={inputCls}>
                <option value="">General</option>
                <option value="empresas">Empresas</option>
                <option value="resellers">Resellers</option>
                <option value="integradores">Integradores</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Budget diario (ARS)</label>
              <input type="number" value={form.daily_budget} onChange={e => setForm(f => ({...f, daily_budget: e.target.value}))} placeholder="0" className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving} className="text-xs px-4 py-1.5 rounded-lg bg-[#2D9F6A] text-white hover:bg-[#25885a] disabled:opacity-50 transition">
              {saving ? "Guardando..." : "Crear campaña"}
            </button>
            <button onClick={() => setShowForm(false)} className={`text-xs px-3 py-1.5 rounded-lg border ${d("border-[#2a2a2a] text-[#737373]","border-[#e5e5e5] text-[#525252]")} transition`}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({length:3}).map((_,i) => <div key={i} className={`h-14 rounded-xl animate-pulse ${d("bg-[#111]","bg-[#f0f0f0]")}`} />)}</div>
      ) : campaigns.length === 0 && utmStats.length === 0 ? (
        <div className={`rounded-xl border p-10 text-center ${d("border-[#1f1f1f] bg-[#0d0d0d]","border-[#e5e5e5] bg-white")}`}>
          <Megaphone size={28} className="mx-auto mb-3 text-[#404040]" />
          <p className={`text-sm font-semibold ${d("text-[#737373]","text-[#a3a3a3]")}`}>Sin campañas aún</p>
          <p className="text-xs text-[#525252] mt-1 max-w-sm mx-auto">
            Creá una campaña manual o configurá las credenciales de Google Ads API
            en Supabase Dashboard → Edge Functions → Secrets para sincronizar automáticamente.
          </p>
        </div>
      ) : (
        <>
          {/* Campaigns from DB */}
          {campaigns.length > 0 && (
            <div className={`rounded-xl border overflow-hidden ${d("border-[#1f1f1f]","border-[#e5e5e5]")}`}>
              <div className={`grid grid-cols-[1.5fr_70px_70px_80px_80px_80px_80px] gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider ${d("bg-[#0d0d0d] text-[#525252]","bg-[#f5f5f5] text-[#a3a3a3]")}`}>
                <span>Campaña</span>
                <span className="text-right">Clicks</span>
                <span className="text-right">Costo</span>
                <span className="text-right">Registros</span>
                <span className="text-right">CPL</span>
                <span className="text-right">ROAS</span>
                <span className="text-right">Estado</span>
              </div>
              {campaigns.map((c) => (
                <div key={c.id} className={`grid grid-cols-[1.5fr_70px_70px_80px_80px_80px_80px] gap-2 px-4 py-3 border-t text-xs items-center ${d("border-[#1a1a1a] bg-[#111]","border-[#f0f0f0] bg-white")}`}>
                  <div className="min-w-0">
                    <p className={`font-semibold truncate ${d("text-white","text-[#171717]")}`}>{c.name}</p>
                    <p className="text-[10px] text-[#525252]">{c.type}{c.target_segment ? ` · ${c.target_segment}` : ""}{c.source === "google_ads_api" ? " · API" : " · manual"}</p>
                  </div>
                  <span className={`text-right ${d("text-[#d4d4d4]","text-[#525252]")}`}>{fmt(c.clicks_30d)}</span>
                  <span className={`text-right ${d("text-[#d4d4d4]","text-[#525252]")}`}>{c.cost_30d > 0 ? `$${Math.round(c.cost_30d).toLocaleString("es-AR")}` : "—"}</span>
                  <span className={`text-right ${d("text-white","text-[#171717]")}`}>{fmt(c.conversions_30d)}</span>
                  <span className={`text-right ${c.cpl_30d && c.cpl_30d > 8000 ? "text-red-400" : c.cpl_30d ? "text-[#2D9F6A]" : d("text-[#525252]","text-[#a3a3a3]")}`}>
                    {c.cpl_30d ? `$${Math.round(c.cpl_30d).toLocaleString("es-AR")}` : "—"}
                  </span>
                  <span className={`text-right font-semibold ${c.roas_30d >= 3 ? "text-[#2D9F6A]" : c.roas_30d >= 1 ? "text-amber-400" : c.roas_30d > 0 ? "text-red-400" : d("text-[#525252]","text-[#a3a3a3]")}`}>
                    {c.roas_30d > 0 ? `${c.roas_30d}x` : "—"}
                  </span>
                  <span className={`text-right text-[10px] px-2 py-0.5 rounded-full ${c.status === "active" ? "text-green-400 bg-green-500/10" : "text-gray-400 bg-gray-500/10"}`}>
                    {c.status === "active" ? "Activa" : "Pausada"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* UTM-only stats (no campaign in DB) */}
          {utmStats.length > 0 && (
            <div>
              <p className={`text-[10px] uppercase tracking-widest font-bold mb-2 ${d("text-[#525252]","text-[#a3a3a3]")}`}>
                UTM detectados en tráfico (sin campaña registrada)
              </p>
              <div className={`rounded-xl border overflow-hidden ${d("border-[#1f1f1f]","border-[#e5e5e5]")}`}>
                {utmStats.map((s) => (
                  <div key={s.campaign} className={`grid grid-cols-[1fr_repeat(3,80px)] gap-2 px-4 py-2.5 border-t first:border-t-0 text-xs ${d("border-[#1a1a1a] bg-[#111]","border-[#f0f0f0] bg-white")}`}>
                    <span className={`font-mono truncate ${d("text-[#a3a3a3]","text-[#525252]")}`}>{s.campaign}</span>
                    <span className={`text-right ${d("text-white","text-[#171717]")}`}>{s.clicks}</span>
                    <span className={`text-right ${d("text-white","text-[#171717]")}`}>{s.registrations}</span>
                    <span className="text-right font-semibold text-[#2D9F6A]">{s.orders}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// INSIGHTS SECTION
// ══════════════════════════════════════════════════════════════

interface Insight {
  level: "ok" | "warn" | "critical";
  title: string;
  body: string;
}

function InsightsSection({ isDark }: { isDark: boolean }) {
  const d = dk(isDark);
  const [row, setRow] = useState<FunnelRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      // Last 4 weeks aggregated
      const { data } = await supabase
        .from("funnel_metrics")
        .select("*")
        .order("week", { ascending: false })
        .limit(4);

      if (!data || data.length === 0) { setLoading(false); return; }

      // Aggregate the 4 rows into one
      const agg = (data as FunnelRow[]).reduce(
        (acc, r) => ({
          ...acc,
          visits:        acc.visits        + (r.visits        ?? 0),
          cta_clicks:    acc.cta_clicks    + (r.cta_clicks    ?? 0),
          registrations: acc.registrations + (r.registrations ?? 0),
          approvals:     acc.approvals     + (r.approvals     ?? 0),
          first_orders:  acc.first_orders  + (r.first_orders  ?? 0),
          sessions:      acc.sessions      + (r.sessions      ?? 0),
          landing_views: acc.landing_views + (r.landing_views ?? 0),
          active_campaigns: Math.max(acc.active_campaigns, r.active_campaigns ?? 0),
          pct_visits_to_cta:    null,
          pct_cta_to_reg:       null,
          pct_reg_to_approved:  null,
          pct_approved_to_order:null,
          week: r.week,
        }),
        { visits:0, sessions:0, landing_views:0, cta_clicks:0, registrations:0,
          approvals:0, first_orders:0, active_campaigns:0,
          pct_visits_to_cta:null, pct_cta_to_reg:null,
          pct_reg_to_approved:null, pct_approved_to_order:null, week:"" }
      );
      setRow(agg as FunnelRow);
      setLoading(false);
    }
    void load();
  }, []);

  const insights = useMemo((): Insight[] => {
    if (!row || row.visits === 0) return [];
    const result: Insight[] = [];
    const pct = (a: number, b: number) => b === 0 ? 0 : (a / b) * 100;

    const visitToCTA = pct(row.cta_clicks, row.visits);
    const ctaToReg   = pct(row.registrations, row.cta_clicks);
    const regToApp   = pct(row.approvals, row.registrations);
    const appToOrder = pct(row.first_orders, row.approvals);

    // Visita → CTA
    if (visitToCTA < 1)
      result.push({ level:"critical", title:"CTA invisible", body:`Solo el ${visitToCTA.toFixed(1)}% de las visitas hacen click en "Solicitar cuenta". El botón necesita más visibilidad o el copy no convence.` });
    else if (visitToCTA < 3)
      result.push({ level:"warn", title:"CTA con baja conversión", body:`${visitToCTA.toFixed(1)}% de visitas a CTA. Un buen B2B landing convierte entre 3-8%. Probá ubicar el CTA más arriba en la página.` });
    else
      result.push({ level:"ok", title:"CTA con buen rendimiento", body:`${visitToCTA.toFixed(1)}% de visitas hacen click. Seguí así.` });

    // CTA → Registro
    if (row.cta_clicks > 0) {
      if (ctaToReg < 20)
        result.push({ level:"critical", title:"Alta fricción en el formulario", body:`Solo el ${ctaToReg.toFixed(1)}% de los clicks se registran. Simplificá el formulario o pedí menos datos al inicio.` });
      else if (ctaToReg < 50)
        result.push({ level:"warn", title:"Formulario con fricción moderada", body:`${ctaToReg.toFixed(1)}% de CTAs completan el registro. Considerá un flow de 2 pasos (email → datos empresa).` });
      else
        result.push({ level:"ok", title:"Formulario de registro fluido", body:`${ctaToReg.toFixed(1)}% de los clicks se convierten en registros.` });
    }

    // Registro → Aprobado
    if (row.registrations > 0) {
      if (regToApp < 30)
        result.push({ level:"warn", title:"Aprobación lenta o selectiva", body:`${regToApp.toFixed(1)}% de registros son aprobados. Si es por volumen de revisión, considerá automatizar la aprobación para cuentas con dominio empresarial.` });
      else
        result.push({ level:"ok", title:"Proceso de aprobación en orden", body:`${regToApp.toFixed(1)}% de registros son aprobados.` });
    }

    // Aprobado → 1er pedido
    if (row.approvals > 0) {
      if (appToOrder < 20)
        result.push({ level:"critical", title:"Clientes aprobados sin activar", body:`Solo el ${appToOrder.toFixed(1)}% de los aprobados hace su primer pedido. Enviá un email de bienvenida con un incentivo (ej: descuento primer pedido).` });
      else if (appToOrder < 50)
        result.push({ level:"warn", title:"Activación de clientes mejorable", body:`${appToOrder.toFixed(1)}% de aprobados convierten. Un onboarding guiado dentro del portal podría mejorar esto.` });
      else
        result.push({ level:"ok", title:"Buena activación de clientes", body:`${appToOrder.toFixed(1)}% de los aprobados hacen su primer pedido.` });
    }

    // Sin tráfico
    if (row.visits < 10)
      result.push({ level:"warn", title:"Volumen de tráfico bajo", body:"Menos de 10 visitas en las últimas 4 semanas. El tracking está activo pero el tráfico web es muy bajo para sacar conclusiones." });

    return result;
  }, [row]);

  if (loading) return (
    <div className="space-y-3">
      {Array.from({length:4}).map((_,i) => (
        <div key={i} className={`h-16 rounded-xl animate-pulse ${d("bg-[#111]","bg-[#f0f0f0]")}`} />
      ))}
    </div>
  );

  if (!row || row.visits === 0) return (
    <div className={`rounded-xl border p-10 text-center ${d("border-[#1f1f1f] bg-[#0d0d0d]","border-[#e5e5e5] bg-white")}`}>
      <BarChart3 size={28} className="mx-auto mb-3 text-[#404040]" />
      <p className={`text-sm font-semibold ${d("text-[#737373]","text-[#a3a3a3]")}`}>Sin datos suficientes</p>
      <p className="text-xs text-[#525252] mt-1">Los insights aparecerán cuando haya tráfico registrado.</p>
    </div>
  );

  const levelStyle: Record<Insight["level"], { border: string; bg: string; dot: string }> = {
    ok:       { border:"border-[#2D9F6A]/30", bg:"bg-[#2D9F6A]/5",  dot:"bg-[#2D9F6A]"   },
    warn:     { border:"border-amber-500/30", bg:"bg-amber-500/5",  dot:"bg-amber-400"    },
    critical: { border:"border-red-500/30",   bg:"bg-red-500/5",    dot:"bg-red-400"      },
  };

  return (
    <div className="space-y-3">
      <p className={`text-xs ${d("text-[#525252]","text-[#a3a3a3]")}`}>
        Basado en las últimas 4 semanas · {insights.filter(i=>i.level==="critical").length} críticos · {insights.filter(i=>i.level==="warn").length} advertencias
      </p>
      {insights.map((ins, i) => {
        const s = levelStyle[ins.level];
        return (
          <div key={i} className={`rounded-xl border p-4 flex gap-3 ${s.border} ${s.bg}`}>
            <span className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${s.dot}`} />
            <div>
              <p className={`text-xs font-semibold ${d("text-white","text-[#171717]")}`}>{ins.title}</p>
              <p className={`text-xs mt-0.5 ${d("text-[#a3a3a3]","text-[#525252]")}`}>{ins.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COUPONS SECTION (contenido original preservado)
// ══════════════════════════════════════════════════════════════

function CouponsSection({ isDark }: { isDark: boolean }) {
  const d = dk(isDark);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState(0);
  const [minPurchase, setMinPurchase] = useState(0);
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchCoupons = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    if (!error && data) setCoupons(data as Coupon[]);
    setLoading(false);
  };

  useEffect(() => { void fetchCoupons(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || value <= 0) return;
    setIsSaving(true);
    const { error } = await supabase.from("coupons").insert({
      code: code.trim().toUpperCase(), discount_type: type, discount_value: value,
      min_purchase: minPurchase, max_uses: maxUses ? parseInt(maxUses) : null,
      expires_at: expiresAt || null, is_active: true,
    });
    if (!error) { setShowForm(false); void fetchCoupons(); setCode(""); setValue(0); setMinPurchase(0); setMaxUses(""); setExpiresAt(""); }
    setIsSaving(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("coupons").update({ is_active: !current }).eq("id", id);
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, is_active: !current } : c));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este cupón permanentemente?")) return;
    await supabase.from("coupons").delete().eq("id", id);
    setCoupons(prev => prev.filter(c => c.id !== id));
  };

  const inputCls = `w-full rounded-lg border px-3 py-2 text-xs outline-none transition ${d("bg-[#0d0d0d] border-[#2a2a2a] text-white placeholder-[#525252] focus:border-[#2D9F6A]","bg-white border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]")}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className={`text-xs ${d("text-[#525252]","text-[#a3a3a3]")}`}>
          {coupons.filter(c => c.is_active).length} activos · {coupons.reduce((a,c)=>a+c.used_count,0)} usos totales
        </p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#2D9F6A]/15 text-[#2D9F6A] border border-[#2D9F6A]/30 hover:bg-[#2D9F6A]/25 transition-colors"
        >
          <Plus size={11} /> Nuevo cupón
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className={`rounded-xl border p-4 space-y-3 ${d("border-[#2a2a2a] bg-[#0a0a0a]","border-[#e5e5e5] bg-[#fafafa]")}`}>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Código</label>
              <input value={code} onChange={e=>setCode(e.target.value)} placeholder="BARTEZ2026" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Tipo</label>
              <select value={type} onChange={e=>setType(e.target.value as "percentage"|"fixed")} className={inputCls}>
                <option value="percentage">Porcentaje (%)</option>
                <option value="fixed">Monto fijo ($)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Valor</label>
              <div className="relative">
                <input type="number" value={value} onChange={e=>setValue(parseFloat(e.target.value))} className={inputCls} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#525252]">
                  {type==="percentage" ? <Percent size={11}/> : <DollarSign size={11}/>}
                </span>
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Compra mín.</label>
              <input type="number" value={minPurchase} onChange={e=>setMinPurchase(parseFloat(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Límite usos</label>
              <input type="number" value={maxUses} onChange={e=>setMaxUses(e.target.value)} placeholder="Sin límite" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Expiración</label>
              <input type="date" value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={isSaving} className="text-xs px-4 py-1.5 rounded-lg bg-[#2D9F6A] text-white hover:bg-[#25885a] disabled:opacity-50 transition-colors">
              {isSaving ? "Guardando..." : "Crear cupón"}
            </button>
            <button type="button" onClick={()=>setShowForm(false)} className={`text-xs px-3 py-1.5 rounded-lg border ${d("border-[#2a2a2a] text-[#737373] hover:text-white","border-[#e5e5e5] text-[#525252]")} transition-colors`}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({length:3}).map((_,i)=><div key={i} className={`h-12 rounded-xl animate-pulse ${d("bg-[#111]","bg-[#f0f0f0]")}`}/>)}</div>
      ) : coupons.length === 0 ? (
        <p className={`text-sm text-center py-10 ${d("text-[#525252]","text-[#a3a3a3]")}`}>No hay cupones creados</p>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${d("border-[#1f1f1f]","border-[#e5e5e5]")}`}>
          {coupons.map((coupon) => (
            <div key={coupon.id} className={`flex items-center gap-3 px-4 py-3 border-t first:border-t-0 text-xs ${d("border-[#1a1a1a] bg-[#111]","border-[#f0f0f0] bg-white")}`}>
              <span className={`font-mono font-bold ${d("text-white","text-[#171717]")}`}>{coupon.code}</span>
              <span className={`text-[#737373]`}>
                {coupon.discount_type==="percentage" ? `${coupon.discount_value}%` : `$${coupon.discount_value}`}
              </span>
              {coupon.expires_at && (
                <span className="flex items-center gap-1 text-[#525252]">
                  <Calendar size={10}/>{new Date(coupon.expires_at).toLocaleDateString("es-AR")}
                </span>
              )}
              <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${coupon.is_active ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-gray-400 bg-gray-500/10 border-gray-500/20"}`}>
                {coupon.is_active ? "Activo" : "Inactivo"}
              </span>
              <span className={`text-[#525252]`}>{coupon.used_count} usos</span>
              <button onClick={()=>toggleActive(coupon.id, coupon.is_active)} className={`${coupon.is_active?"text-green-400":"text-[#525252]"} hover:opacity-70 transition`}>
                {coupon.is_active ? <CheckCircle2 size={13}/> : <XCircle size={13}/>}
              </button>
              <button onClick={()=>handleDelete(coupon.id)} className="text-[#525252] hover:text-red-400 transition">
                <Trash2 size={13}/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
