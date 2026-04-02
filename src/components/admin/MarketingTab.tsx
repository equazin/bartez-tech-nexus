import { useEffect, useState, useMemo } from "react";
import {
  Ticket, Plus, Trash2, Calendar, Percent, DollarSign,
  CheckCircle2, XCircle, TrendingUp, Users, MousePointerClick,
  ShoppingCart, Activity, RefreshCw, BarChart3,
  Megaphone, Lightbulb, ArrowRight, Wand2, Copy, ThumbsUp, ThumbsDown,
  Zap, AlertCircle, TrendingDown, PauseCircle, Sparkles, Rocket,
  ChevronDown, ChevronUp, Eye,
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

type SubTab = "funnel" | "campaigns" | "copies" | "insights" | "coupons";

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
          { id: "funnel",    label: "Funnel B2B", icon: TrendingUp },
          { id: "campaigns", label: "Campañas",   icon: Megaphone  },
          { id: "copies",    label: "Copy AI",    icon: Wand2      },
          { id: "insights",  label: "Insights",   icon: Lightbulb  },
          { id: "coupons",   label: "Cupones",    icon: Ticket     },
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
      {subTab === "copies"    && <CopiesSection    isDark={isDark} />}
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

interface AdGroup { name: string; keywords: string[]; headlines: string[]; descriptions: string[] }
interface CampaignStructure {
  name: string;
  ad_groups: AdGroup[];
  negative_keywords?: string[];
  bidding_strategy?: string;
  notes?: string;
}
interface CampaignDraft {
  id: string;
  name: string;
  objective: string;
  campaign_type: string;
  target_segment: string | null;
  daily_budget_ars: number | null;
  status: "pending_review" | "approved" | "rejected" | "launched" | "launch_error";
  campaign_structure: CampaignStructure;
  created_at: string;
  google_ads_campaign_id: string | null;
  launch_error: string | null;
  reviewer_notes: string | null;
}

const EMPTY_AI_FORM = {
  objective:        "leads" as "leads" | "ventas" | "awareness",
  campaign_type:    "search" as "search" | "display" | "remarketing",
  target_segment:   "empresas",
  daily_budget_ars: "",
  product_focus:    "",
  extra_context:    "",
  num_ad_groups:    "3",
};

function CampaignsSection({ isDark }: { isDark: boolean }) {
  const d = dk(isDark);
  const [campaigns, setCampaigns]   = useState<CampaignPerf[]>([]);
  const [utmStats, setUtmStats]     = useState<CampaignStat[]>([]);
  const [drafts, setDrafts]         = useState<CampaignDraft[]>([]);
  const [loading, setLoading]       = useState(true);
  const [syncing, setSyncing]       = useState(false);
  const [syncMsg, setSyncMsg]       = useState<string | null>(null);

  // AI generator
  const [showAIForm, setShowAIForm] = useState(false);
  const [aiForm, setAIForm]         = useState({ ...EMPTY_AI_FORM });
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg]         = useState<string | null>(null);

  // Draft detail expansion
  const [expandedDraft, setExpandedDraft] = useState<string | null>(null);

  // Launch
  const [launching, setLaunching]   = useState<string | null>(null);
  const [launchMsg, setLaunchMsg]   = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: perfData }, { data: evtData }, { data: draftData }] = await Promise.all([
      supabase.from("campaign_performance").select("*").order("clicks_30d", { ascending: false }),
      supabase.from("marketing_events").select("utm_campaign, event_type").not("utm_campaign", "is", null),
      supabase.from("campaign_drafts").select("*").order("created_at", { ascending: false }).limit(20),
    ]);

    setCampaigns((perfData as CampaignPerf[]) ?? []);
    setDrafts((draftData as CampaignDraft[]) ?? []);

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

  async function triggerSync() {
    setSyncing(true); setSyncMsg(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-ads-sync`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      });
      const data = await res.json() as { ok: boolean; message?: string; synced?: number };
      setSyncMsg(data.ok ? `✓ ${data.synced ?? 0} registros sincronizados` : (data.message ?? "Sin credenciales configuradas"));
      if (data.ok) void load();
    } catch { setSyncMsg("Error al conectar con la función de sync"); }
    setSyncing(false);
  }

  async function generateCampaign() {
    if (!aiForm.daily_budget_ars) { setGenMsg("Ingresá un presupuesto diario"); return; }
    setGenerating(true); setGenMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-campaign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          objective:        aiForm.objective,
          campaign_type:    aiForm.campaign_type,
          target_segment:   aiForm.target_segment,
          daily_budget_ars: Number(aiForm.daily_budget_ars),
          product_focus:    aiForm.product_focus || undefined,
          extra_context:    aiForm.extra_context || undefined,
          num_ad_groups:    Number(aiForm.num_ad_groups),
        }),
      });
      const data = await res.json() as { ok: boolean; draft?: CampaignDraft; message?: string };
      if (data.ok && data.draft) {
        setGenMsg("✓ Campaña generada. Revisá y aprobá abajo.");
        setAIForm({ ...EMPTY_AI_FORM });
        setShowAIForm(false);
        setExpandedDraft(data.draft.id);
        void load();
      } else {
        setGenMsg(`Error: ${data.message ?? "desconocido"}`);
      }
    } catch (e) {
      setGenMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    setGenerating(false);
  }

  async function approveDraft(id: string) {
    await supabase.from("campaign_drafts").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", id);
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: "approved" } : d));
  }

  async function rejectDraft(id: string) {
    await supabase.from("campaign_drafts").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", id);
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: "rejected" } : d));
  }

  async function launchDraft(id: string) {
    setLaunching(id); setLaunchMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/launch-campaign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ draft_id: id }),
      });
      const data = await res.json() as { ok: boolean; message?: string; google_ads_campaign_id?: string };
      setLaunchMsg(data.message ?? (data.ok ? "Lanzada" : "Error"));
      void load();
    } catch (e) {
      setLaunchMsg(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLaunching(null);
  }

  const inputCls = `w-full text-xs px-3 py-2 rounded-lg border ${d("bg-[#0d0d0d] border-[#2a2a2a] text-white","bg-white border-[#e5e5e5] text-[#171717]")}`;

  const DRAFT_STATUS_STYLE: Record<string, string> = {
    pending_review: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    approved:       "text-blue-400 bg-blue-500/10 border-blue-500/30",
    rejected:       "text-red-400 bg-red-500/10 border-red-500/30",
    launched:       "text-[#2D9F6A] bg-[#2D9F6A]/10 border-[#2D9F6A]/30",
    launch_error:   "text-red-400 bg-red-500/10 border-red-500/30",
  };
  const DRAFT_STATUS_LABEL: Record<string, string> = {
    pending_review: "Pendiente revisión",
    approved:       "Aprobada",
    rejected:       "Rechazada",
    launched:       "Lanzada",
    launch_error:   "Error al lanzar",
  };

  return (
    <div className="space-y-5">
      {/* ── AI Generator CTA ────────────────────────── */}
      <div className={`rounded-xl border p-4 ${d("border-[#2D9F6A]/20 bg-[#2D9F6A]/5","border-[#2D9F6A]/20 bg-[#2D9F6A]/3")}`}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className={`text-sm font-bold flex items-center gap-2 ${d("text-white","text-[#171717]")}`}>
              <Sparkles size={14} className="text-[#2D9F6A]" /> Generador de Campañas con IA
            </p>
            <p className="text-xs text-[#737373] mt-0.5">
              Ingresá el objetivo y el presupuesto — Claude arma toda la estructura: grupos de anuncios, keywords, headlines y descripciones listas para Google Ads.
            </p>
          </div>
          <button
            onClick={() => setShowAIForm(v => !v)}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-[#2D9F6A] text-white hover:bg-[#25885a] transition font-semibold whitespace-nowrap"
          >
            <Sparkles size={13} /> Generar campaña con IA
          </button>
        </div>

        {showAIForm && (
          <div className={`mt-4 pt-4 border-t space-y-4 ${d("border-[#1f1f1f]","border-[#e0e0e0]")}`}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Objetivo</label>
                <select value={aiForm.objective} onChange={e => setAIForm(f => ({...f, objective: e.target.value as typeof f.objective}))} className={inputCls}>
                  <option value="leads">Captar leads B2B</option>
                  <option value="ventas">Generar ventas</option>
                  <option value="awareness">Reconocimiento de marca</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Tipo de campaña</label>
                <select value={aiForm.campaign_type} onChange={e => setAIForm(f => ({...f, campaign_type: e.target.value as typeof f.campaign_type}))} className={inputCls}>
                  <option value="search">Search (texto)</option>
                  <option value="display">Display (banners)</option>
                  <option value="remarketing">Remarketing</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Segmento objetivo</label>
                <select value={aiForm.target_segment} onChange={e => setAIForm(f => ({...f, target_segment: e.target.value}))} className={inputCls}>
                  <option value="empresas">Empresas medianas/grandes</option>
                  <option value="resellers">Resellers y distribuidores</option>
                  <option value="integradores">Integradores de sistemas</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Budget diario (ARS)</label>
                <input type="number" value={aiForm.daily_budget_ars} onChange={e => setAIForm(f => ({...f, daily_budget_ars: e.target.value}))} placeholder="Ej: 15000" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Foco de producto (opcional)</label>
                <input value={aiForm.product_focus} onChange={e => setAIForm(f => ({...f, product_focus: e.target.value}))} placeholder="Ej: notebooks, servidores, switches" className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Grupos de anuncios</label>
                <select value={aiForm.num_ad_groups} onChange={e => setAIForm(f => ({...f, num_ad_groups: e.target.value}))} className={inputCls}>
                  {["1","2","3","4","5"].map(n => <option key={n} value={n}>{n} grupos</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Contexto adicional (opcional)</label>
                <textarea value={aiForm.extra_context} onChange={e => setAIForm(f => ({...f, extra_context: e.target.value}))} placeholder="Ej: Campaña para fin de año, enfocada en equipamiento de oficina para empresas de RRHH en AMBA" rows={2} className={`${inputCls} resize-none`} />
              </div>
            </div>

            {genMsg && (
              <p className={`text-xs px-3 py-2 rounded-lg border ${genMsg.startsWith("✓") ? "text-[#2D9F6A] border-[#2D9F6A]/20 bg-[#2D9F6A]/5" : "text-red-400 border-red-500/20 bg-red-500/5"}`}>
                {genMsg}
              </p>
            )}

            <div className="flex gap-2">
              <button onClick={generateCampaign} disabled={generating} className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg bg-[#2D9F6A] text-white hover:bg-[#25885a] disabled:opacity-50 transition font-semibold">
                {generating ? <><RefreshCw size={11} className="animate-spin" /> Generando...</> : <><Sparkles size={11} /> Generar</>}
              </button>
              <button onClick={() => setShowAIForm(false)} className={`text-xs px-3 py-1.5 rounded-lg border ${d("border-[#2a2a2a] text-[#737373]","border-[#e5e5e5] text-[#525252]")} transition`}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Campaign Drafts list ─────────────────────── */}
      {drafts.length > 0 && (
        <div className="space-y-2">
          <p className={`text-[10px] uppercase tracking-widest font-bold ${d("text-[#525252]","text-[#a3a3a3]")}`}>
            Campañas generadas ({drafts.length})
          </p>
          {launchMsg && (
            <p className={`text-xs px-3 py-2 rounded-lg border ${launchMsg.startsWith("✓") || launchMsg.includes("creada") || launchMsg.includes("lanzada") || launchMsg.includes("Campaña") ? "text-[#2D9F6A] border-[#2D9F6A]/20 bg-[#2D9F6A]/5" : "text-amber-400 border-amber-500/20 bg-amber-500/5"}`}>
              {launchMsg}
            </p>
          )}
          {drafts.map((draft) => (
            <div key={draft.id} className={`rounded-xl border overflow-hidden ${d("border-[#2a2a2a] bg-[#0d0d0d]","border-[#e5e5e5] bg-white")}`}>
              {/* Draft header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${d("text-white","text-[#171717]")}`}>{draft.name}</p>
                  <p className="text-[10px] text-[#525252] mt-0.5">
                    {draft.campaign_type} · {draft.target_segment ?? "general"} · {draft.daily_budget_ars ? `$${Number(draft.daily_budget_ars).toLocaleString("es-AR")}/día` : "sin presupuesto"}
                    {" · "}{draft.campaign_structure.ad_groups?.length ?? 0} grupos
                    {draft.google_ads_campaign_id ? ` · ID Google Ads: ${draft.google_ads_campaign_id}` : ""}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${DRAFT_STATUS_STYLE[draft.status]}`}>
                  {DRAFT_STATUS_LABEL[draft.status]}
                </span>

                {/* Action buttons */}
                {draft.status === "pending_review" && (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => approveDraft(draft.id)} title="Aprobar"
                      className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-[#2D9F6A]/15 text-[#2D9F6A] border border-[#2D9F6A]/30 hover:bg-[#2D9F6A]/25 transition">
                      <ThumbsUp size={10} /> Aprobar
                    </button>
                    <button onClick={() => rejectDraft(draft.id)} title="Rechazar"
                      className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition">
                      <ThumbsDown size={10} /> Rechazar
                    </button>
                  </div>
                )}
                {draft.status === "approved" && (
                  <button onClick={() => launchDraft(draft.id)} disabled={launching === draft.id}
                    className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition font-semibold">
                    {launching === draft.id ? <><RefreshCw size={10} className="animate-spin" /> Lanzando...</> : <><Rocket size={10} /> Lanzar en Google Ads</>}
                  </button>
                )}

                <button onClick={() => setExpandedDraft(expandedDraft === draft.id ? null : draft.id)}
                  className={`text-[#525252] hover:${d("text-white","text-[#171717]")} transition`}>
                  {expandedDraft === draft.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {/* Expanded structure preview */}
              {expandedDraft === draft.id && (
                <div className={`border-t px-4 py-4 space-y-4 ${d("border-[#1f1f1f]","border-[#f0f0f0]")}`}>
                  {draft.campaign_structure.notes && (
                    <p className="text-xs text-[#737373] italic">{draft.campaign_structure.notes}</p>
                  )}
                  {draft.campaign_structure.bidding_strategy && (
                    <p className="text-xs text-[#737373]">
                      <span className="font-semibold text-[#525252]">Puja: </span>{draft.campaign_structure.bidding_strategy}
                    </p>
                  )}
                  {(draft.campaign_structure.ad_groups ?? []).map((ag, i) => (
                    <div key={i} className={`rounded-lg border p-3 space-y-2 ${d("border-[#2a2a2a] bg-[#111]","border-[#e5e5e5] bg-[#fafafa]")}`}>
                      <p className={`text-xs font-bold ${d("text-white","text-[#171717]")}`}>Grupo {i+1}: {ag.name}</p>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-[#525252] mb-1">Keywords ({ag.keywords?.length ?? 0})</p>
                        <div className="flex flex-wrap gap-1">
                          {(ag.keywords ?? []).map((kw, j) => (
                            <span key={j} className={`text-[10px] px-2 py-0.5 rounded-full ${d("bg-[#1a1a1a] text-[#a3a3a3]","bg-[#f0f0f0] text-[#525252]")}`}>{kw}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-[#525252] mb-1">Headlines ({ag.headlines?.length ?? 0} · máx 30 chars)</p>
                        <div className="grid grid-cols-3 gap-1">
                          {(ag.headlines ?? []).map((h, j) => (
                            <span key={j} className={`text-[10px] px-2 py-1 rounded border truncate ${h.length > 30 ? "text-amber-400 border-amber-500/20 bg-amber-500/5" : d("border-[#2a2a2a] text-[#d4d4d4]","border-[#e5e5e5] text-[#525252]")}`} title={h}>
                              {h.length > 30 ? "⚠ " : ""}{h}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-[#525252] mb-1">Descriptions ({ag.descriptions?.length ?? 0} · máx 90 chars)</p>
                        <div className="space-y-1">
                          {(ag.descriptions ?? []).map((desc, j) => (
                            <p key={j} className={`text-[10px] px-2 py-1 rounded border ${desc.length > 90 ? "text-amber-400 border-amber-500/20 bg-amber-500/5" : d("border-[#2a2a2a] text-[#a3a3a3]","border-[#e5e5e5] text-[#525252]")}`}>
                              {desc.length > 90 ? "⚠ " : ""}{desc}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(draft.campaign_structure.negative_keywords ?? []).length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-[#525252] mb-1">Negativos</p>
                      <div className="flex flex-wrap gap-1">
                        {(draft.campaign_structure.negative_keywords ?? []).map((kw, j) => (
                          <span key={j} className="text-[10px] px-2 py-0.5 rounded-full text-red-400 bg-red-500/10">{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {draft.launch_error && (
                    <p className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded px-3 py-2">
                      Error al lanzar: {draft.launch_error}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Header (sync + live campaigns) ──────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className={`text-xs flex-1 ${d("text-[#525252]","text-[#a3a3a3]")}`}>
          {campaigns.length} campañas activas · últimos 30 días
        </p>
        <button onClick={triggerSync} disabled={syncing}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${d("border-[#2a2a2a] text-[#737373] hover:text-white","border-[#e5e5e5] text-[#525252] hover:bg-[#f5f5f5]")}`}>
          <RefreshCw size={11} className={syncing ? "animate-spin" : ""} /> Sync Google Ads
        </button>
      </div>

      {syncMsg && (
        <p className={`text-xs px-3 py-2 rounded-lg border ${syncMsg.startsWith("✓") ? "text-[#2D9F6A] border-[#2D9F6A]/20 bg-[#2D9F6A]/5" : "text-amber-400 border-amber-500/20 bg-amber-500/5"}`}>
          {syncMsg}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({length:3}).map((_,i) => <div key={i} className={`h-14 rounded-xl animate-pulse ${d("bg-[#111]","bg-[#f0f0f0]")}`} />)}</div>
      ) : campaigns.length > 0 && (
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

      {utmStats.length > 0 && (
        <div>
          <p className={`text-[10px] uppercase tracking-widest font-bold mb-2 ${d("text-[#525252]","text-[#a3a3a3]")}`}>UTM en tráfico</p>
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

      {/* ── Ad Rules ─────────────────────────────────── */}
      <AdRulesPanel isDark={isDark} />
    </div>
  );
}

// ── Ad Rules Panel ────────────────────────────────────────────

interface AdRule {
  id: number;
  name: string;
  active: boolean;
  condition: { metric: string; operator: string; value: number; window_days: number };
  action: { type: string; value?: number };
  last_fired: string | null;
  fire_count: number;
}

const METRIC_LABELS: Record<string, string> = {
  roas:       "ROAS",
  cpl_ars:    "CPL (ARS)",
  clicks:     "Clicks",
  cost_ars:   "Costo (ARS)",
  ctr:        "CTR %",
};
const OP_LABELS: Record<string, string> = { gt: ">", lt: "<", gte: ">=", lte: "<=" };
const ACTION_LABELS: Record<string, string> = {
  pause_campaign:    "Pausar campaña",
  increase_budget:   "Aumentar presupuesto",
  decrease_budget:   "Reducir presupuesto",
  alert:             "Generar alerta",
};
const ACTION_ICONS: Record<string, React.ElementType> = {
  pause_campaign:  PauseCircle,
  increase_budget: TrendingUp,
  decrease_budget: TrendingDown,
  alert:           AlertCircle,
};

const DEFAULT_RULES = [
  { name: "Pausar campaña ineficiente", condition: { metric:"roas", operator:"lt", value:0.8, window_days:7 }, action: { type:"pause_campaign" } },
  { name: "Escalar campaña rentable",   condition: { metric:"roas", operator:"gt", value:3,   window_days:7 }, action: { type:"increase_budget", value:20 } },
  { name: "Alerta CPL alto",            condition: { metric:"cpl_ars", operator:"gt", value:8000, window_days:3 }, action: { type:"alert" } },
];

const EMPTY_RULE = {
  name: "",
  metric: "roas", operator: "lt", value: "1", window_days: "7",
  action_type: "alert", action_value: "",
};

function AdRulesPanel({ isDark }: { isDark: boolean }) {
  const d = dk(isDark);
  const [rules, setRules]       = useState<AdRule[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ ...EMPTY_RULE });
  const [saving, setSaving]     = useState(false);

  const loadRules = async () => {
    setLoading(true);
    const { data } = await supabase.from("ad_rules").select("*").order("created_at", { ascending: false });
    setRules((data as AdRule[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void loadRules(); }, []);

  async function seedDefaults() {
    await supabase.from("ad_rules").insert(DEFAULT_RULES.map(r => ({ ...r, active: true })));
    void loadRules();
  }

  async function toggleRule(id: number, active: boolean) {
    await supabase.from("ad_rules").update({ active: !active }).eq("id", id);
    setRules(prev => prev.map(r => r.id === id ? { ...r, active: !active } : r));
  }

  async function deleteRule(id: number) {
    await supabase.from("ad_rules").delete().eq("id", id);
    setRules(prev => prev.filter(r => r.id !== id));
  }

  async function createRule() {
    if (!form.name.trim()) return;
    setSaving(true);
    await supabase.from("ad_rules").insert({
      name: form.name.trim(),
      active: true,
      condition: { metric: form.metric, operator: form.operator, value: Number(form.value), window_days: Number(form.window_days) },
      action: { type: form.action_type, ...(form.action_value ? { value: Number(form.action_value) } : {}) },
    });
    setForm({ ...EMPTY_RULE });
    setShowForm(false);
    setSaving(false);
    void loadRules();
  }

  const inputCls = `text-xs px-2.5 py-1.5 rounded-lg border ${d("bg-[#0d0d0d] border-[#2a2a2a] text-white","bg-white border-[#e5e5e5] text-[#171717]")}`;

  return (
    <div className="space-y-3 pt-2 border-t border-[#1f1f1f]">
      <div className="flex items-center gap-2">
        <Zap size={13} className="text-amber-400" />
        <p className={`text-xs font-bold ${d("text-white","text-[#171717]")}`}>Reglas de automatización</p>
        <div className="ml-auto flex gap-2">
          {rules.length === 0 && !loading && (
            <button onClick={seedDefaults} className={`text-xs px-2.5 py-1 rounded-lg border ${d("border-[#2a2a2a] text-[#737373] hover:text-white","border-[#e5e5e5] text-[#525252]")} transition`}>
              Cargar reglas base
            </button>
          )}
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-[#2D9F6A]/15 text-[#2D9F6A] border border-[#2D9F6A]/30 hover:bg-[#2D9F6A]/25 transition"
          >
            <Plus size={10} /> Nueva regla
          </button>
        </div>
      </div>

      {showForm && (
        <div className={`rounded-xl border p-3 space-y-3 ${d("border-[#2a2a2a] bg-[#0a0a0a]","border-[#e5e5e5] bg-[#fafafa]")}`}>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Nombre de la regla" className={`w-full ${inputCls}`} />
            </div>
            <div className="flex gap-1 col-span-2 items-center flex-wrap">
              <span className="text-[10px] text-[#525252]">Si</span>
              <select value={form.metric} onChange={e=>setForm(f=>({...f,metric:e.target.value}))} className={inputCls}>
                {Object.entries(METRIC_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={form.operator} onChange={e=>setForm(f=>({...f,operator:e.target.value}))} className={inputCls}>
                {Object.entries(OP_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input type="number" value={form.value} onChange={e=>setForm(f=>({...f,value:e.target.value}))} className={`w-20 ${inputCls}`} />
              <span className="text-[10px] text-[#525252]">en últimos</span>
              <input type="number" value={form.window_days} onChange={e=>setForm(f=>({...f,window_days:e.target.value}))} className={`w-14 ${inputCls}`} />
              <span className="text-[10px] text-[#525252]">días →</span>
              <select value={form.action_type} onChange={e=>setForm(f=>({...f,action_type:e.target.value}))} className={inputCls}>
                {Object.entries(ACTION_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {(form.action_type === "increase_budget" || form.action_type === "decrease_budget") && (
                <><input type="number" value={form.action_value} onChange={e=>setForm(f=>({...f,action_value:e.target.value}))} placeholder="%" className={`w-16 ${inputCls}`} /><span className="text-[10px] text-[#525252]">%</span></>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createRule} disabled={saving} className="text-xs px-3 py-1.5 rounded-lg bg-[#2D9F6A] text-white hover:bg-[#25885a] disabled:opacity-50 transition">
              {saving ? "Guardando..." : "Crear"}
            </button>
            <button onClick={() => setShowForm(false)} className={`text-xs px-2.5 py-1.5 rounded-lg border ${d("border-[#2a2a2a] text-[#737373]","border-[#e5e5e5] text-[#525252]")} transition`}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{Array.from({length:2}).map((_,i) => <div key={i} className={`h-10 rounded-xl animate-pulse ${d("bg-[#111]","bg-[#f0f0f0]")}`} />)}</div>
      ) : rules.length === 0 ? (
        <p className={`text-xs ${d("text-[#525252]","text-[#a3a3a3]")}`}>Sin reglas. Hacé click en "Cargar reglas base" para agregar las 3 reglas recomendadas.</p>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => {
            const ActionIcon = ACTION_ICONS[rule.action.type] ?? Zap;
            return (
              <div key={rule.id} className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 ${d("border-[#1f1f1f] bg-[#0d0d0d]","border-[#e5e5e5] bg-white")} ${!rule.active ? "opacity-50" : ""}`}>
                <ActionIcon size={12} className={
                  rule.action.type === "alert" ? "text-amber-400"
                  : rule.action.type === "pause_campaign" ? "text-red-400"
                  : "text-[#2D9F6A]"
                } />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${d("text-white","text-[#171717]")}`}>{rule.name}</p>
                  <p className="text-[10px] text-[#525252] truncate">
                    {METRIC_LABELS[rule.condition.metric]} {OP_LABELS[rule.condition.operator]} {rule.condition.value} · {rule.condition.window_days}d → {ACTION_LABELS[rule.action.type]}{rule.action.value ? ` ${rule.action.value}%` : ""}
                    {rule.last_fired && ` · último disparo: ${new Date(rule.last_fired).toLocaleDateString("es-AR")}`}
                    {rule.fire_count > 0 && ` (${rule.fire_count}x)`}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${rule.active ? "text-green-400 bg-green-500/10 border-green-500/20" : "text-gray-400 bg-gray-500/10 border-gray-500/20"}`}>
                  {rule.active ? "Activa" : "Pausada"}
                </span>
                <button onClick={() => toggleRule(rule.id, rule.active)} className="text-[#525252] hover:text-white transition">
                  {rule.active ? <CheckCircle2 size={13} className="text-[#2D9F6A]" /> : <XCircle size={13} />}
                </button>
                <button onClick={() => deleteRule(rule.id)} className="text-[#525252] hover:text-red-400 transition">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// COPIES SECTION — Ad Copy AI Generator
// ══════════════════════════════════════════════════════════════

interface AdCopy {
  id: number;
  category: string; segment: string;
  headline1: string; headline2: string; headline3: string;
  description1: string; description2: string;
  status: "draft" | "approved" | "rejected";
  created_at: string;
}

const CATEGORIES = ["Laptops", "Desktops", "Servidores", "Networking", "Monitores", "Impresoras", "Storage", "Accesorios IT", "Software", "Tablets"];
const SEGMENTS   = [
  { value: "empresas",     label: "Empresas corporativas" },
  { value: "resellers",    label: "Resellers / distribuidores" },
  { value: "integradores", label: "Integradores IT" },
];

function CopiesSection({ isDark }: { isDark: boolean }) {
  const d = dk(isDark);
  const [copies, setCopies]       = useState<AdCopy[]>([]);
  const [loading, setLoading]     = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError]   = useState<string | null>(null);
  const [copied, setCopied]       = useState<number | null>(null);

  // Form state
  const [category, setCategory]   = useState(CATEGORIES[0]);
  const [segment, setSegment]     = useState("empresas");
  const [count, setCount]         = useState(3);
  const [filter, setFilter]       = useState<"all" | "draft" | "approved">("all");

  const loadCopies = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ad_copies")
      .select("id, category, segment, headline1, headline2, headline3, description1, description2, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setCopies((data as AdCopy[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { void loadCopies(); }, []);

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ad-copy-generator`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            "Content-Type":  "application/json",
          },
          body: JSON.stringify({ category, segment, count }),
        },
      );
      const data = await res.json() as { ok: boolean; copies?: AdCopy[]; error?: string };
      if (!data.ok) {
        setGenError(data.error ?? "Error al generar copies");
      } else {
        void loadCopies();
      }
    } catch {
      setGenError("Error de conexión con la función de generación");
    }
    setGenerating(false);
  }

  async function updateStatus(id: number, status: "approved" | "rejected") {
    await supabase.from("ad_copies").update({
      status,
      ...(status === "approved" ? { approved_at: new Date().toISOString() } : {}),
    }).eq("id", id);
    setCopies(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  }

  async function handleCopyToClipboard(copy: AdCopy) {
    const text = [
      `Titular 1: ${copy.headline1}`,
      `Titular 2: ${copy.headline2}`,
      `Titular 3: ${copy.headline3}`,
      `Descripción 1: ${copy.description1}`,
      `Descripción 2: ${copy.description2}`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(copy.id);
    setTimeout(() => setCopied(null), 2000);
  }

  const filtered = filter === "all" ? copies : copies.filter(c => c.status === filter);
  const inputCls = `text-xs px-3 py-2 rounded-lg border ${d("bg-[#0d0d0d] border-[#2a2a2a] text-white","bg-white border-[#e5e5e5] text-[#171717]")}`;

  return (
    <div className="space-y-5">
      {/* Generator form */}
      <div className={`rounded-xl border p-4 space-y-4 ${d("border-[#1f1f1f] bg-[#0d0d0d]","border-[#e5e5e5] bg-white")}`}>
        <div className="flex items-center gap-2">
          <Wand2 size={14} className="text-[#2D9F6A]" />
          <p className={`text-xs font-bold ${d("text-white","text-[#171717]")}`}>Generar copies B2B con IA</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Categoría</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={`w-full ${inputCls}`}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Segmento</label>
            <select value={segment} onChange={e => setSegment(e.target.value)} className={`w-full ${inputCls}`}>
              {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-[#525252] mb-1 block">Variantes (1-5)</label>
            <input
              type="number" min={1} max={5} value={count}
              onChange={e => setCount(Math.min(5, Math.max(1, Number(e.target.value))))}
              className={`w-full ${inputCls}`}
            />
          </div>
        </div>

        {genError && <p className="text-xs text-red-400">{genError}</p>}

        <button
          onClick={handleGenerate} disabled={generating}
          className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg bg-[#2D9F6A] text-white hover:bg-[#25885a] disabled:opacity-50 transition font-semibold"
        >
          <Wand2 size={12} className={generating ? "animate-spin" : ""} />
          {generating ? "Generando..." : `Generar ${count} variante${count > 1 ? "s" : ""}`}
        </button>
      </div>

      {/* Filter + list */}
      <div className="flex items-center gap-2">
        <p className={`text-xs flex-1 ${d("text-[#525252]","text-[#a3a3a3]")}`}>
          {copies.length} copies · {copies.filter(c=>c.status==="approved").length} aprobados
        </p>
        <div className={`flex gap-1 p-0.5 rounded-lg border ${d("border-[#1f1f1f] bg-[#0d0d0d]","border-[#e5e5e5] bg-[#f5f5f5]")}`}>
          {(["all","draft","approved"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-[11px] px-2.5 py-1 rounded-md transition ${filter===f ? "bg-[#2D9F6A] text-white" : d("text-[#525252] hover:text-white","text-[#737373]")}`}
            >
              {f === "all" ? "Todos" : f === "draft" ? "Borradores" : "Aprobados"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({length:2}).map((_,i) => <div key={i} className={`h-32 rounded-xl animate-pulse ${d("bg-[#111]","bg-[#f0f0f0]")}`} />)}</div>
      ) : filtered.length === 0 ? (
        <div className={`rounded-xl border p-10 text-center ${d("border-[#1f1f1f] bg-[#0d0d0d]","border-[#e5e5e5] bg-white")}`}>
          <Wand2 size={28} className="mx-auto mb-3 text-[#404040]" />
          <p className={`text-sm font-semibold ${d("text-[#737373]","text-[#a3a3a3]")}`}>
            {copies.length === 0 ? "Generá tu primer copy B2B" : "Sin copies en este filtro"}
          </p>
          {copies.length === 0 && (
            <p className="text-xs text-[#525252] mt-1 max-w-xs mx-auto">
              Seleccioná categoría, segmento y hacé click en "Generar".
              Requiere <code className="text-[10px]">ANTHROPIC_API_KEY</code> en Supabase Secrets.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(copy => (
            <div key={copy.id} className={`rounded-xl border p-4 space-y-3 ${
              copy.status === "approved"
                ? d("border-[#2D9F6A]/30 bg-[#2D9F6A]/5","border-[#2D9F6A]/20 bg-[#2D9F6A]/3")
                : copy.status === "rejected"
                  ? d("border-red-500/20 bg-red-500/5","border-red-500/15 bg-red-500/3")
                  : d("border-[#1f1f1f] bg-[#0d0d0d]","border-[#e5e5e5] bg-white")
            }`}>
              {/* Header */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${d("border-[#2a2a2a] text-[#737373]","border-[#e5e5e5] text-[#737373]")}`}>
                  {copy.category}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${d("border-[#2a2a2a] text-[#737373]","border-[#e5e5e5] text-[#737373]")}`}>
                  {SEGMENTS.find(s=>s.value===copy.segment)?.label ?? copy.segment}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ml-auto ${
                  copy.status === "approved" ? "text-[#2D9F6A] border-[#2D9F6A]/30 bg-[#2D9F6A]/10"
                  : copy.status === "rejected" ? "text-red-400 border-red-500/20 bg-red-500/10"
                  : d("text-[#737373] border-[#2a2a2a]","text-[#737373] border-[#e5e5e5]")
                }`}>
                  {copy.status === "approved" ? "Aprobado" : copy.status === "rejected" ? "Rechazado" : "Borrador"}
                </span>
                <span className="text-[10px] text-[#525252]">
                  {new Date(copy.created_at).toLocaleDateString("es-AR")}
                </span>
              </div>

              {/* Headlines */}
              <div className="grid grid-cols-3 gap-2">
                {[copy.headline1, copy.headline2, copy.headline3].map((h, i) => (
                  <div key={i} className={`rounded-lg p-2 ${d("bg-[#111]","bg-[#f8f8f8]")}`}>
                    <p className="text-[9px] uppercase tracking-widest text-[#525252] mb-0.5">Titular {i+1}</p>
                    <p className={`text-xs font-semibold ${d("text-white","text-[#171717]")}`}>{h}</p>
                    <p className={`text-[9px] mt-0.5 ${h.length > 28 ? "text-amber-400" : "text-[#525252]"}`}>{h.length}/30</p>
                  </div>
                ))}
              </div>

              {/* Descriptions */}
              <div className="space-y-2">
                {[copy.description1, copy.description2].map((desc, i) => (
                  <div key={i} className={`rounded-lg p-2 ${d("bg-[#111]","bg-[#f8f8f8]")}`}>
                    <p className="text-[9px] uppercase tracking-widest text-[#525252] mb-0.5">Descripción {i+1}</p>
                    <p className={`text-xs ${d("text-[#d4d4d4]","text-[#404040]")}`}>{desc}</p>
                    <p className={`text-[9px] mt-0.5 ${desc.length > 85 ? "text-amber-400" : "text-[#525252]"}`}>{desc.length}/90</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {copy.status !== "approved" && (
                  <button
                    onClick={() => updateStatus(copy.id, "approved")}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#2D9F6A]/15 text-[#2D9F6A] border border-[#2D9F6A]/30 hover:bg-[#2D9F6A]/25 transition"
                  >
                    <ThumbsUp size={11} /> Aprobar
                  </button>
                )}
                {copy.status !== "rejected" && (
                  <button
                    onClick={() => updateStatus(copy.id, "rejected")}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${d("border-[#2a2a2a] text-[#737373] hover:text-red-400 hover:border-red-500/30","border-[#e5e5e5] text-[#737373] hover:text-red-400")}`}
                  >
                    <ThumbsDown size={11} /> Rechazar
                  </button>
                )}
                <button
                  onClick={() => handleCopyToClipboard(copy)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ml-auto ${d("border-[#2a2a2a] text-[#737373] hover:text-white","border-[#e5e5e5] text-[#737373] hover:text-[#171717]")}`}
                >
                  <Copy size={11} /> {copied === copy.id ? "¡Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          ))}
        </div>
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
