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
  assigned_seller?: { id: string; name: string; email: string } | null;
  notes: string | null;
  approved_user_id?: string | null;
  created_at: string;
}

const TAX_LABELS: Record<string, string> = {
  responsable_inscripto: "Resp. Inscripto",
  monotributista: "Monotributista",
  exento: "Exento",
  no_especificado: "No especificado",
};

const STATUS_CONFIG: Record<RegistrationStatus, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  approved: { label: "Aprobada", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
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

  async function withSessionHeaders() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error("Sesion expirada. Volve a iniciar sesion.");
    }
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
  }

  async function readApiResult<T>(response: Response): Promise<{ ok?: boolean; data?: T; error?: string }> {
    const raw = await response.text();
    if (!raw) {
      return { ok: response.ok, error: response.ok ? undefined : "Respuesta vacia del servidor." };
    }
    try {
      return JSON.parse(raw) as { ok?: boolean; data?: T; error?: string };
    } catch {
      return { ok: response.ok, error: raw };
    }
  }

  async function fetchRequests() {
    setLoading(true);
    try {
      const headers = await withSessionHeaders();
      const response = await fetch(`/api/registration-requests?status=${statusFilter}`, {
        method: "GET",
        headers,
      });
      const result = await readApiResult<RegistrationRequest[]>(response);
      if (!response.ok || !result.ok) {
        toast.error(result.error ?? "No se pudieron cargar las solicitudes.");
        setRequests([]);
      } else {
        setRequests(result.data ?? []);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar las solicitudes.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchRequests();
  }, [statusFilter]);

  async function updateStatus(id: string, status: RegistrationStatus, notes?: string) {
    setProcessing(id);
    try {
      const headers = await withSessionHeaders();
      const response = await fetch("/api/registration-requests", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id, status, ...(notes ? { notes } : {}) }),
      });
      const result = await readApiResult<{ id: string; status: RegistrationStatus; approved_user_id?: string | null }>(response);
      if (!response.ok || !result.ok) {
        toast.error(result.error ?? "No se pudo actualizar la solicitud.");
      } else {
        toast.success(status === "approved" ? "Solicitud aprobada y cliente habilitado" : "Solicitud rechazada");
        await fetchRequests();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la solicitud.");
    } finally {
      setProcessing(null);
    }
  }

  const counts = requests.reduce(
    (acc, request) => {
      acc[request.status] = (acc[request.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Solicitudes de alta B2B</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Empresas y personas que completaron el formulario de /registrarse.
          </p>
        </div>
        <button onClick={fetchRequests} className="flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground">
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(["pending", "approved", "rejected"] as RegistrationStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`rounded-xl border px-4 py-3 text-left transition ${statusFilter === status ? "border-primary/40 bg-primary/10" : "border-border/70 bg-card hover:bg-secondary/40"}`}
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{STATUS_CONFIG[status].label}</p>
            <p className="mt-0.5 text-2xl font-bold text-foreground">{counts[status] ?? 0}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {(["all", "pending", "approved", "rejected"] as const).map((filterValue) => (
          <button
            key={filterValue}
            onClick={() => setStatusFilter(filterValue)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${statusFilter === filterValue ? "border-primary/40 bg-primary/15 text-primary" : "border-border/70 text-muted-foreground hover:text-foreground"}`}
          >
            {filterValue === "all" ? "Todas" : STATUS_CONFIG[filterValue].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl border border-border/70 bg-card" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card py-16 text-center">
          <Clock size={28} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No hay solicitudes {statusFilter !== "all" ? `${STATUS_CONFIG[statusFilter as RegistrationStatus].label.toLowerCase()}s` : ""}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const isProcessing = processing === request.id;
            const statusCfg = STATUS_CONFIG[request.status];
            return (
              <div key={request.id} className="rounded-xl border border-border/70 bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      {request.entity_type === "empresa" ? <Building2 size={18} /> : <User size={18} />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{request.company_name || request.contact_name}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusCfg.cls}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono">{formatCuit(request.cuit)}</span>
                        <span>{TAX_LABELS[request.tax_status] ?? request.tax_status}</span>
                        <span>{request.entity_type === "empresa" ? "Persona jur?dica" : "Persona f?sica"}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{request.contact_name}</span>
                        <span>?</span>
                        <a href={`mailto:${request.email}`} className="text-primary hover:underline">{request.email}</a>
                        {(request.assigned_seller?.name || request.assigned_to) ? (
                          <span>
                            ? asignado a <span className="text-foreground">{request.assigned_seller?.name ?? request.assigned_to}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(request.created_at).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                {request.notes ? (
                  <p className="mt-3 rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">{request.notes}</p>
                ) : null}

                {request.status === "pending" ? (
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => updateStatus(request.id, "approved")}
                      disabled={isProcessing}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                    >
                      <CheckCircle2 size={15} /> Aprobar
                    </button>
                    <button
                      onClick={() => updateStatus(request.id, "rejected")}
                      disabled={isProcessing}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/70 py-2 text-sm font-bold text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      <XCircle size={15} /> Rechazar
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
