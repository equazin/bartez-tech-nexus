import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { CreditCard, Save, X, AlertTriangle, CheckCircle2, Search } from "lucide-react";

interface Props { isDark?: boolean }

interface ClientCredit {
  id: string;
  company_name: string;
  contact_name: string;
  client_type: string;
  credit_limit: number;
  credit_used: number;
}

export function CreditTab({ isDark = true }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  const [clients, setClients]   = useState<ClientCredit[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [editing, setEditing]   = useState<string | null>(null);
  const [editLimit, setEditLimit] = useState("");
  const [saving, setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, company_name, contact_name, client_type, credit_limit, credit_used")
      .not("role", "eq", "admin")
      .not("role", "eq", "vendedor")
      .order("company_name");
    setClients((data ?? []) as ClientCredit[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveLimit(clientId: string) {
    setSaving(true);
    const newLimit = Number(editLimit);
    await supabase
      .from("profiles")
      .update({ credit_limit: newLimit })
      .eq("id", clientId);
    setClients((prev) =>
      prev.map((c) => c.id === clientId ? { ...c, credit_limit: newLimit } : c)
    );
    setEditing(null);
    setSaving(false);
  }

  async function resetCredit(clientId: string) {
    if (!confirm("¿Resetear el crédito usado a 0?")) return;
    await supabase
      .from("profiles")
      .update({ credit_used: 0 })
      .eq("id", clientId);
    setClients((prev) =>
      prev.map((c) => c.id === clientId ? { ...c, credit_used: 0 } : c)
    );
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

  const filtered = clients.filter(
    (c) =>
      !search ||
      (c.company_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.contact_name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  // Totals
  const totalLimit = clients.reduce((s, c) => s + (c.credit_limit ?? 0), 0);
  const totalUsed  = clients.reduce((s, c) => s + (c.credit_used  ?? 0), 0);
  const withCredit = clients.filter((c) => (c.credit_limit ?? 0) > 0).length;
  const overLimit  = clients.filter((c) => (c.credit_used ?? 0) >= (c.credit_limit ?? 0) && (c.credit_limit ?? 0) > 0);

  const TYPE_LABELS: Record<string, string> = {
    mayorista: "Mayorista",
    reseller:  "Revendedor",
    empresa:   "Empresa",
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>Crédito de Clientes</h2>
          <p className="text-xs text-gray-500 mt-0.5">{withCredit} con límite asignado · {overLimit.length > 0 ? `${overLimit.length} en límite` : "todos dentro del límite"}</p>
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente…"
            className={`border rounded-lg pl-7 pr-3 py-1.5 text-xs outline-none w-48 transition ${dk("bg-[#111] border-[#2a2a2a] text-gray-300 placeholder:text-[#444]", "bg-white border-[#e5e5e5] text-[#525252] placeholder:text-[#b4b4b4]")}`}
          />
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Límite total otorgado", value: fmt(totalLimit), color: "text-[#2D9F6A]" },
          { label: "Crédito utilizado",     value: fmt(totalUsed),  color: "text-amber-400" },
          { label: "Disponible total",       value: fmt(Math.max(0, totalLimit - totalUsed)), color: "text-sky-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`border rounded-xl px-4 py-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Clients table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`h-14 rounded-xl animate-pulse ${dk("bg-[#111]", "bg-white")}`} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-gray-500">Sin resultados.</div>
      ) : (
        <div className={`border rounded-xl overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
          {/* Header */}
          <div className={`grid grid-cols-[1fr_100px_130px_130px_140px_80px] gap-3 px-4 py-2 text-[10px] font-bold uppercase tracking-wider ${dk("bg-[#0a0a0a] text-[#525252]", "bg-[#f5f5f5] text-[#a3a3a3]")}`}>
            <span>Cliente</span>
            <span>Tipo</span>
            <span className="text-right">Límite</span>
            <span className="text-right">Usado</span>
            <span>Uso</span>
            <span className="text-right">Acciones</span>
          </div>

          {filtered.map((client, idx) => {
            const limit    = client.credit_limit ?? 0;
            const used     = client.credit_used  ?? 0;
            const avail    = Math.max(0, limit - used);
            const pct      = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
            const isEditing = editing === client.id;
            const isOver    = limit > 0 && used >= limit;

            return (
              <div
                key={client.id}
                className={`grid grid-cols-[1fr_100px_130px_130px_140px_80px] gap-3 items-center px-4 py-3 ${
                  idx % 2 === 0
                    ? dk("bg-[#0d0d0d]", "bg-[#fafafa]")
                    : dk("bg-[#111]", "bg-white")
                } ${idx > 0 ? `border-t ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")}` : ""}`}
              >
                {/* Client name */}
                <div className="min-w-0">
                  <p className={`text-xs font-semibold truncate ${dk("text-gray-200", "text-[#171717]")}`}>
                    {client.company_name || client.contact_name || "—"}
                  </p>
                  {client.company_name && client.contact_name && (
                    <p className="text-[10px] text-gray-500 truncate">{client.contact_name}</p>
                  )}
                </div>

                {/* Type */}
                <span className={`text-[10px] ${dk("text-gray-500", "text-[#737373]")}`}>
                  {TYPE_LABELS[client.client_type] ?? client.client_type}
                </span>

                {/* Limit — editable */}
                <div className="text-right">
                  {isEditing ? (
                    <div className="flex items-center gap-1 justify-end">
                      <input
                        type="number"
                        value={editLimit}
                        onChange={(e) => setEditLimit(e.target.value)}
                        className={`w-24 border rounded px-2 py-1 text-xs font-mono text-right outline-none ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717]")}`}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveLimit(client.id);
                          if (e.key === "Escape") setEditing(null);
                        }}
                      />
                      <button onClick={() => saveLimit(client.id)} disabled={saving} className="text-emerald-400 hover:text-emerald-300 transition">
                        <Save size={12} />
                      </button>
                      <button onClick={() => setEditing(null)} className="text-gray-500 hover:text-gray-300 transition">
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditing(client.id); setEditLimit(String(limit)); }}
                      className={`text-xs font-mono transition hover:text-[#2D9F6A] ${limit > 0 ? dk("text-gray-300", "text-[#525252]") : "text-gray-500"}`}
                      title="Click para editar"
                    >
                      {limit > 0 ? fmt(limit) : "Sin límite"}
                    </button>
                  )}
                </div>

                {/* Used */}
                <div className="text-right">
                  <span className={`text-xs font-mono ${isOver ? "text-red-400 font-bold" : dk("text-gray-400", "text-[#737373]")}`}>
                    {used > 0 ? fmt(used) : "—"}
                  </span>
                  {isOver && <AlertTriangle size={10} className="inline-block ml-1 text-red-400" />}
                </div>

                {/* Progress bar */}
                <div>
                  {limit > 0 ? (
                    <div className="space-y-0.5">
                      <div className={`h-1.5 rounded-full overflow-hidden ${dk("bg-[#1f1f1f]", "bg-[#e8e8e8]")}`}>
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-amber-400" : "bg-[#2D9F6A]"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[9px] text-gray-500">{pct.toFixed(0)}%</span>
                        <span className="text-[9px] text-gray-500">Disp: {fmt(avail)}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-600">—</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 justify-end">
                  {used > 0 && (
                    <button
                      onClick={() => resetCredit(client.id)}
                      title="Resetear crédito usado"
                      className="text-[10px] text-gray-500 hover:text-amber-400 transition px-1.5 py-0.5 rounded border border-transparent hover:border-amber-400/30"
                    >
                      Reset
                    </button>
                  )}
                  {limit > 0 && used === 0 && (
                    <CheckCircle2 size={12} className="text-emerald-500" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
