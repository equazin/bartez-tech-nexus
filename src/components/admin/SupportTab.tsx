import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Save,
  Search,
  ShieldAlert,
  Ticket,
  Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ClientRow {
  id: string;
  company_name: string;
  contact_name: string;
}

interface SupportNote {
  id: string;
  client_id: string;
  body: string;
  tipo: string;
  created_at: string;
}

type CaseStatus = "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "CREDIT_NOTE" | "RESOLVED" | "CLOSED";
type CasePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type CaseType = "SEGUIMIENTO" | "RECLAMO" | "DEVOLUCION" | "RMA" | "NOTA_CREDITO" | "FACTURACION" | "LOGISTICA" | "ACCESOS";

interface ParsedCase extends SupportNote {
  caseType: CaseType;
  caseStatus: CaseStatus;
  casePriority: CasePriority;
  reference: string;
  summary: string;
  source: "portal" | "case";
}

interface SupportTabProps {
  isDark?: boolean;
  clients: ClientRow[];
}

function formatCaseBody(type: CaseType, status: CaseStatus, priority: CasePriority, reference: string, body: string) {
  return `[CASE:${type}|${status}|${priority}|${reference || "-"}] ${body.trim()}`;
}

function parseSupportCase(note: SupportNote): ParsedCase {
  const caseMatch = note.body.match(/^\[CASE:([A-Z_]+)\|([A-Z_]+)\|([A-Z_]+)\|([^\]]*)\]\s*/);
  if (caseMatch) {
    return {
      ...note,
      caseType: caseMatch[1] as CaseType,
      caseStatus: caseMatch[2] as CaseStatus,
      casePriority: caseMatch[3] as CasePriority,
      reference: caseMatch[4] === "-" ? "" : caseMatch[4],
      summary: note.body.replace(/^\[CASE:[^\]]+\]\s*/i, ""),
      source: "case",
    };
  }

  const portalMatch = note.body.match(/^\[PORTAL:([A-Z_]+)\]\s*/);
  return {
    ...note,
    caseType: (portalMatch?.[1] as CaseType) || "SEGUIMIENTO",
    caseStatus: "OPEN",
    casePriority: "MEDIUM",
    reference: "",
    summary: note.body.replace(/^\[PORTAL:[^\]]+\]\s*/i, ""),
    source: "portal",
  };
}

const STATUS_LABELS: Record<CaseStatus, string> = {
  OPEN: "Abierto",
  IN_PROGRESS: "En gestión",
  WAITING_CUSTOMER: "Esperando cliente",
  CREDIT_NOTE: "Nota de crédito",
  RESOLVED: "Resuelto",
  CLOSED: "Cerrado",
};

const PRIORITY_CLASSES: Record<CasePriority, string> = {
  LOW: "text-gray-400",
  MEDIUM: "text-blue-400",
  HIGH: "text-amber-400",
  URGENT: "text-red-400",
};

export function SupportTab({ isDark = true, clients }: SupportTabProps) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<SupportNote[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [category, setCategory] = useState<CaseType>("SEGUIMIENTO");
  const [status, setStatus] = useState<CaseStatus>("OPEN");
  const [priority, setPriority] = useState<CasePriority>("MEDIUM");
  const [reference, setReference] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CaseStatus | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<CaseType | "ALL">("ALL");

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((client) => {
      map[client.id] = client.company_name || client.contact_name || client.id;
    });
    return map;
  }, [clients]);

  async function load() {
    const { data } = await supabase
      .from("client_notes")
      .select("id, client_id, body, tipo, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    const base = (data as SupportNote[] | null) ?? [];
    setNotes(base.filter((note) => note.body.startsWith("[PORTAL:") || note.body.startsWith("[CASE:")));
  }

  useEffect(() => {
    void load();
  }, []);

  async function createCase() {
    if (!selectedClientId || !body.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("client_notes").insert({
        client_id: selectedClientId,
        tipo: "seguimiento",
        body: formatCaseBody(category, status, priority, reference, body),
      });
      if (error) throw error;
      setBody("");
      setReference("");
      setStatus("OPEN");
      setPriority("MEDIUM");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function updateCaseStatus(note: ParsedCase, nextStatus: CaseStatus) {
    const { error } = await supabase
      .from("client_notes")
      .update({
        body: formatCaseBody(note.caseType, nextStatus, note.casePriority, note.reference, note.summary),
      })
      .eq("id", note.id);
    if (!error) await load();
  }

  const cases = useMemo(() => notes.map(parseSupportCase), [notes]);

  const filteredCases = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return cases.filter((item) => {
      if (statusFilter !== "ALL" && item.caseStatus !== statusFilter) return false;
      if (typeFilter !== "ALL" && item.caseType !== typeFilter) return false;
      if (!normalized) return true;
      return [
        clientMap[item.client_id] || item.client_id,
        item.summary,
        item.caseType,
        item.reference,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [cases, clientMap, query, statusFilter, typeFilter]);

  const metrics = useMemo(() => {
    const open = cases.filter((item) => ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "CREDIT_NOTE"].includes(item.caseStatus));
    const urgent = cases.filter((item) => item.casePriority === "URGENT");
    const rma = cases.filter((item) => item.caseType === "RMA");
    const creditNotes = cases.filter((item) => item.caseType === "NOTA_CREDITO" || item.caseStatus === "CREDIT_NOTE");
    return [
      { label: "Casos abiertos", value: String(open.length), accent: "text-[#2D9F6A]" },
      { label: "Urgentes", value: String(urgent.length), accent: urgent.length > 0 ? "text-red-400" : "text-gray-400" },
      { label: "RMA / devoluciones", value: String(rma.length), accent: "text-amber-400" },
      { label: "Notas de crédito", value: String(creditNotes.length), accent: "text-blue-400" },
    ];
  }, [cases]);

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>Postventa y Soporte</h2>
        <p className="text-xs text-gray-500 mt-0.5">Reclamos, devoluciones, RMA, notas de crédito y tickets del portal en un solo módulo.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className={`border rounded-xl px-4 py-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{metric.label}</p>
            <p className={`text-lg font-bold ${metric.accent}`}>{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className={`border rounded-2xl p-5 space-y-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
          <div className="flex items-center gap-2">
            <Wrench size={15} className="text-[#2D9F6A]" />
            <h3 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Nuevo caso</h3>
          </div>
          <select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}>
            <option value="">Seleccionar cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>{client.company_name || client.contact_name}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select value={category} onChange={(event) => setCategory(event.target.value as CaseType)} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}>
              <option value="SEGUIMIENTO">Seguimiento</option>
              <option value="RECLAMO">Reclamo</option>
              <option value="DEVOLUCION">Devolución</option>
              <option value="RMA">RMA</option>
              <option value="NOTA_CREDITO">Nota de crédito</option>
              <option value="FACTURACION">Facturación</option>
              <option value="LOGISTICA">Logística</option>
              <option value="ACCESOS">Accesos</option>
            </select>
            <select value={priority} onChange={(event) => setPriority(event.target.value as CasePriority)} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}>
              <option value="LOW">Baja</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select value={status} onChange={(event) => setStatus(event.target.value as CaseStatus)} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}>
              <option value="OPEN">Abierto</option>
              <option value="IN_PROGRESS">En gestión</option>
              <option value="WAITING_CUSTOMER">Esperando cliente</option>
              <option value="CREDIT_NOTE">Nota de crédito</option>
              <option value="RESOLVED">Resuelto</option>
              <option value="CLOSED">Cerrado</option>
            </select>
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Pedido / factura / RMA"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] placeholder:text-[#a3a3a3]")}`}
            />
          </div>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={6} placeholder="Detalle del caso, acción interna o resolución propuesta" className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none ${dk("bg-[#0d0d0d] border-[#262626] text-white placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] placeholder:text-[#a3a3a3]")}`} />
          <button onClick={() => void createCase()} disabled={saving || !selectedClientId || !body.trim()} className="inline-flex items-center gap-2 bg-[#2D9F6A] hover:bg-[#25875a] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition">
            <Save size={12} />
            {saving ? "Guardando..." : "Crear caso"}
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
            <label className="relative block">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por cliente, referencia o detalle"
                className={`w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none ${dk("bg-[#111] border-[#262626] text-white placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] placeholder:text-[#a3a3a3]")}`}
              />
            </label>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CaseStatus | "ALL")} className={`rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#111] border-[#262626] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}>
              <option value="ALL">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as CaseType | "ALL")} className={`rounded-lg border px-3 py-2 text-sm outline-none ${dk("bg-[#111] border-[#262626] text-white", "bg-white border-[#e5e5e5] text-[#171717]")}`}>
              <option value="ALL">Todos los tipos</option>
              <option value="SEGUIMIENTO">Seguimiento</option>
              <option value="RECLAMO">Reclamo</option>
              <option value="DEVOLUCION">Devolución</option>
              <option value="RMA">RMA</option>
              <option value="NOTA_CREDITO">Nota de crédito</option>
              <option value="FACTURACION">Facturación</option>
              <option value="LOGISTICA">Logística</option>
              <option value="ACCESOS">Accesos</option>
            </select>
          </div>

          <div className={`border rounded-2xl overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
            {filteredCases.map((item) => (
              <div key={item.id} className={`px-4 py-3 border-t first:border-t-0 ${dk("border-[#1a1a1a] bg-[#111]", "border-[#f0f0f0] bg-white")}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>{clientMap[item.client_id] || item.client_id}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {item.caseType.replace(/_/g, " ")} · {STATUS_LABELS[item.caseStatus]} · {new Date(item.created_at).toLocaleDateString("es-AR")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[11px] font-semibold ${PRIORITY_CLASSES[item.casePriority]}`}>{item.casePriority}</p>
                    {item.reference && <p className="text-[10px] text-gray-500 mt-0.5">{item.reference}</p>}
                  </div>
                </div>
                <p className={`text-sm mt-2 ${dk("text-gray-300", "text-[#525252]")}`}>{item.summary}</p>
                <div className="flex items-center gap-2 flex-wrap mt-3">
                  {(["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "CREDIT_NOTE", "RESOLVED"] as CaseStatus[]).map((nextStatus) => (
                    <button
                      key={nextStatus}
                      onClick={() => void updateCaseStatus(item, nextStatus)}
                      className={`text-[10px] px-2 py-1 rounded-full border transition ${
                        item.caseStatus === nextStatus
                          ? "border-[#2D9F6A]/30 text-[#2D9F6A] bg-[#2D9F6A]/10"
                          : dk("border-[#262626] text-gray-400 hover:text-white hover:bg-[#1a1a1a]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")
                      }`}
                    >
                      {STATUS_LABELS[nextStatus]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {filteredCases.length === 0 && (
              <div className="px-4 py-12 text-center">
                <Ticket size={28} className="mx-auto mb-3 text-gray-500/30" />
                <p className="text-sm text-gray-500">No encontramos casos con esos filtros.</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 flex items-start gap-2">
            <ShieldAlert size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-400">
              Los casos se almacenan sobre `client_notes` con prefijos estructurados para no romper la base actual. Eso nos da gestión fuerte ahora y deja espacio para migrar a RMA formal más adelante.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
