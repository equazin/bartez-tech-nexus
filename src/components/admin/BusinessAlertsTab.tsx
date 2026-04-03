import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BusinessAlert {
  id: number;
  client_id: string;
  type: string;
  title: string;
  subtitle?: string;
  active: boolean;
  expires_at?: string;
  created_at: string;
  client_name?: string;
}

interface ClientOption {
  id: string;
  company_name: string;
}

const ALERT_TYPES = ["invoice", "rma", "promotion", "info", "warning"] as const;

const ALERT_TYPE_LABELS: Record<string, string> = {
  invoice:   "Factura",
  rma:       "RMA / Garantía",
  promotion: "Promoción",
  info:      "Información",
  warning:   "Advertencia",
};

const TYPE_COLOR: Record<string, string> = {
  invoice:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
  rma:       "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  promotion: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  info:      "bg-sky-500/10 text-sky-400 border-sky-500/20",
  warning:   "bg-red-500/10 text-red-400 border-red-500/20",
};

const EMPTY_FORM = {
  client_id: "",
  type: "info" as string,
  title: "",
  subtitle: "",
  expires_at: "",
};

export function BusinessAlertsTab({ isDark }: { isDark: boolean }) {
  const dk = (d: string, l: string) => isDark ? d : l;

  const [alerts, setAlerts] = useState<BusinessAlert[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("business_alerts")
      .select("*, profiles:client_id(company_name)")
      .order("created_at", { ascending: false })
      .limit(200);

    if (data) {
      const mapped = (data as unknown[]).map((row) => {
        const r = row as Record<string, unknown>;
        const profile = r.profiles as { company_name?: string } | null;
        return {
          ...(r as unknown as BusinessAlert),
          client_name: profile?.company_name ?? r.client_id as string,
        };
      });
      setAlerts(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAlerts();
    supabase
      .from("profiles")
      .select("id, company_name")
      .in("role", ["client", "cliente"])
      .order("company_name")
      .then(({ data }) => {
        if (data) setClients(data as ClientOption[]);
      });
  }, [fetchAlerts]);

  async function handleCreate() {
    if (!form.client_id || !form.title.trim()) {
      setError("Cliente y título son obligatorios.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("business_alerts").insert({
      client_id: form.client_id,
      type: form.type,
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      expires_at: form.expires_at || null,
      active: true,
    });
    if (err) {
      setError(err.message);
    } else {
      setForm({ ...EMPTY_FORM });
      setShowForm(false);
      await fetchAlerts();
    }
    setSaving(false);
  }

  async function toggleActive(id: number, current: boolean) {
    await supabase
      .from("business_alerts")
      .update({ active: !current })
      .eq("id", id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, active: !current } : a));
  }

  async function deleteAlert(id: number) {
    if (!confirm("¿Eliminar esta alerta?")) return;
    await supabase.from("business_alerts").delete().eq("id", id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-primary" />
          <h2 className={`text-lg font-bold ${dk("text-white", "text-[#171717]")}`}>
            Alertas de Negocio
          </h2>
          <span className="text-xs text-muted-foreground">({alerts.length})</span>
        </div>
        <Button
          size="sm"
          className="gap-1.5 rounded-xl"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={14} /> Nueva Alerta
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className={`rounded-2xl border p-5 space-y-4 ${dk("bg-[#0d0d0d] border-white/5", "bg-white border-black/5 shadow-sm")}`}>
          <h3 className="text-sm font-bold">Crear nueva alerta</h3>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 rounded-xl px-3 py-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Cliente *</label>
              <select
                className={`w-full rounded-xl border px-3 py-2 text-sm ${dk("bg-[#111] border-white/10 text-white", "bg-white border-black/10 text-black")}`}
                value={form.client_id}
                onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
              >
                <option value="">Seleccionar cliente...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Tipo</label>
              <select
                className={`w-full rounded-xl border px-3 py-2 text-sm ${dk("bg-[#111] border-white/10 text-white", "bg-white border-black/10 text-black")}`}
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              >
                {ALERT_TYPES.map(t => (
                  <option key={t} value={t}>{ALERT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Título *</label>
              <input
                className={`w-full rounded-xl border px-3 py-2 text-sm ${dk("bg-[#111] border-white/10 text-white", "bg-white border-black/10 text-black")}`}
                placeholder="Ej: Factura B-122 vence pronto"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Subtítulo</label>
              <input
                className={`w-full rounded-xl border px-3 py-2 text-sm ${dk("bg-[#111] border-white/10 text-white", "bg-white border-black/10 text-black")}`}
                placeholder="Ej: Evite cargos de mora"
                value={form.subtitle}
                onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 block">Vence el (opcional)</label>
              <input
                type="datetime-local"
                className={`w-full rounded-xl border px-3 py-2 text-sm ${dk("bg-[#111] border-white/10 text-white", "bg-white border-black/10 text-black")}`}
                value={form.expires_at}
                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setShowForm(false); setError(null); }}>
              Cancelar
            </Button>
            <Button size="sm" className="rounded-xl gap-1.5" onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Crear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Sin alertas creadas
        </div>
      ) : (
        <div className={`rounded-2xl border overflow-hidden ${dk("border-white/5", "border-black/5")}`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b text-[10px] font-bold uppercase tracking-widest text-muted-foreground ${dk("border-white/5 bg-white/2", "border-black/5 bg-black/2")}`}>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Título</th>
                <th className="px-4 py-3 text-left">Vence</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert, i) => (
                <tr
                  key={alert.id}
                  className={`border-b transition ${dk(
                    `${i % 2 === 0 ? "bg-[#0a0a0a]" : "bg-[#0d0d0d]"} border-white/5 hover:bg-white/3`,
                    `${i % 2 === 0 ? "bg-white" : "bg-gray-50"} border-black/5 hover:bg-gray-100`
                  )}`}
                >
                  <td className="px-4 py-3 font-medium truncate max-w-[140px]">
                    {alert.client_name}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TYPE_COLOR[alert.type] ?? "text-muted-foreground bg-white/5 border-white/10"}`}>
                      {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium truncate max-w-[200px]">{alert.title}</p>
                    {alert.subtitle && (
                      <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{alert.subtitle}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {alert.expires_at
                      ? new Date(alert.expires_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "2-digit" })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(alert.id, alert.active)}
                      className="flex items-center gap-1 mx-auto"
                      title={alert.active ? "Desactivar" : "Activar"}
                    >
                      {alert.active
                        ? <ToggleRight size={20} className="text-emerald-400" />
                        : <ToggleLeft size={20} className="text-muted-foreground" />}
                      <span className={`text-[10px] font-bold ${alert.active ? "text-emerald-400" : "text-muted-foreground"}`}>
                        {alert.active ? "Activa" : "Inactiva"}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => deleteAlert(alert.id)}
                      className="text-red-400 hover:text-red-300 transition"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
