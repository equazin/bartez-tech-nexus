import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Clock, RefreshCw, User, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type RegistrationStatus = "pending" | "approved" | "rejected";

interface RegistrationRequest {
  id: string;
  cuit: string;
  company_name: string;
  contact_name: string;
  email: string;
  entity_type: "empresa" | "persona_fisica";
  tax_status: string;
  status: RegistrationStatus;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
}

const TAX_LABELS: Record<string, string> = {
  responsable_inscripto: "Resp. Inscripto",
  monotributista: "Monotributista",
  exento: "Exento",
  no_especificado: "No especificado",
};

const STATUS_CONFIG: Record<RegistrationStatus, { label: string; cls: string }> = {
  pending:  { label: "Pendiente", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  approved: { label: "Aprobada",  cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  rejected: { label: "Rechazada", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
};

function formatCuit(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11) return raw;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

export function RegistrationRequestsTab() {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RegistrationStatus | "all">("pending");
  const [processing, setProcessing] = useState<string | null>(null);

  async function fetchRequests() {
    setLoading(true);
    const query = supabase
      .from("b2b_registration_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") query.eq("status", statusFilter);

    const { data, error } = await query;
    if (error) toast.error("No se pudieron cargar las solicitudes.");
    setRequests((data as RegistrationRequest[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void fetchRequests(); }, [statusFilter]);

  async function updateStatus(id: string, status: RegistrationStatus, notes?: string) {
    setProcessing(id);
    const { error } = await supabase
      .from("b2b_registration_requests")
      .update({ status, ...(notes ? { notes } : {}) })
      .eq("id", id);
    if (error) {
      toast.error("No se pudo actualizar la solicitud.");
    } else {
      toast.success(status === "approved" ? "Solicitud aprobada" : "Solicitud rechazada");
      await fetchRequests();
    }
    setProcessing(null);
  }

  const counts = requests.reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-foreground">Solicitudes de alta B2B</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Empresas y personas que completaron el formulario de /registrarse.
          </p>
        </div>
        <button onClick={fetchRequests} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {(["pending", "approved", "rejected"] as RegistrationStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-xl border px-4 py-3 text-left transition ${statusFilter === s ? "border-primary/40 bg-primary/10" : "border-border/70 bg-card hover:bg-secondary/40"}`}
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{STATUS_CONFIG[s].label}</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">{counts[s] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${statusFilter === f ? "bg-primary/15 border-primary/40 text-primary" : "border-border/70 text-muted-foreground hover:text-foreground"}`}
          >
            {f === "all" ? "Todas" : STATUS_CONFIG[f].label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-border/70 bg-card animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card py-16 text-center">
          <Clock size={28} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No hay solicitudes {statusFilter !== "all" ? STATUS_CONFIG[statusFilter as RegistrationStatus].label.toLowerCase() + "s" : ""}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const isProcessing = processing === req.id;
            const statusCfg = STATUS_CONFIG[req.status];
            return (
              <div key={req.id} className="rounded-xl border border-border/70 bg-card p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      {req.entity_type === "empresa" ? <Building2 size={18} /> : <User size={18} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-foreground">{req.company_name || req.contact_name}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg.cls}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono">{formatCuit(req.cuit)}</span>
                        <span>{TAX_LABELS[req.tax_status] ?? req.tax_status}</span>
                        <span>{req.entity_type === "empresa" ? "Persona jurídica" : "Persona física"}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>{req.contact_name}</span>
                        <span>·</span>
                        <a href={`mailto:${req.email}`} className="text-primary hover:underline">{req.email}</a>
                        {req.assigned_to && <span>· asignado a <span className="text-foreground">{req.assigned_to}</span></span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>

                {req.notes && (
                  <p className="mt-3 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">{req.notes}</p>
                )}

                {req.status === "pending" && (
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      onClick={() => updateStatus(req.id, "approved")}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-bold py-2 rounded-xl transition"
                    >
                      <CheckCircle2 size={15} /> Aprobar
                    </button>
                    <button
                      onClick={() => updateStatus(req.id, "rejected")}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-2 border border-border/70 text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/10 disabled:opacity-50 text-sm font-bold py-2 rounded-xl transition"
                    >
                      <XCircle size={15} /> Rechazar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
