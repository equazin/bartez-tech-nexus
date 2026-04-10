import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Mail,
  RefreshCw,
  ShieldCheck,
  User,
  UserCheck,
  XCircle,
} from "lucide-react";
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
  consumidor_final: "Consumidor Final",
  no_especificado: "No especificado",
};

const STATUS_CONFIG: Record<RegistrationStatus, { label: string; cls: string }> = {
  pending: { label: "Pendiente", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  approved: { label: "Aprobada", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  rejected: { label: "Rechazada", cls: "bg-red-500/15 text-red-500 border-red-500/30" },
};

function formatCuit(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11) return raw;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RegistrationRequestsTab() {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RegistrationStatus | "all">("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [onboardingForm, setOnboardingForm] = useState<{ id: string; client_type: string; default_margin: number } | null>(null);

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
    setErrorMessage(null);
    try {
      const headers = await withSessionHeaders();
      const response = await fetch("/api/create-user?scope=registration-requests&status=all", {
        method: "GET",
        headers,
      });
      const result = await readApiResult<RegistrationRequest[]>(response);
      if (!response.ok || !result.ok) {
        const message = result.error ?? "No se pudieron cargar las solicitudes.";
        setErrorMessage(message);
        toast.error(message);
        setRequests([]);
      } else {
        setRequests(result.data ?? []);
        setLastUpdatedAt(new Date().toISOString());
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudieron cargar las solicitudes.";
      setErrorMessage(message);
      toast.error(message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchRequests();
  }, []);

  async function updateStatus(id: string, status: RegistrationStatus, notes?: string, client_type?: string, default_margin?: number) {
    setProcessing(id);
    try {
      const headers = await withSessionHeaders();
      const response = await fetch("/api/create-user?scope=registration-requests", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id, status, ...(notes ? { notes } : {}), client_type, default_margin }),
      });
      const result = await readApiResult<{ id: string; status: RegistrationStatus; approved_user_id?: string | null; used_temp_password?: boolean }>(response);

      if (!response.ok || !result.ok) {
        toast.error(result.error ?? "No se pudo actualizar la solicitud.");
      } else {
        if (status === "approved") {
          if (result.data?.used_temp_password) {
            toast.success("Cliente creado con contraseña temporal — debe resetearla por email");
          } else {
            toast.success("Solicitud aprobada y cliente creado");
          }
        } else {
          toast.success("Solicitud rechazada");
        }
        setOnboardingForm(null);
        await fetchRequests();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la solicitud.");
    } finally {
      setProcessing(null);
    }
  }

  const counts = useMemo(
    () => requests.reduce(
      (acc, request) => {
        acc[request.status] = (acc[request.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    [requests],
  );

  const filteredRequests = useMemo(
    () => statusFilter === "all" ? requests : requests.filter((request) => request.status === statusFilter),
    [requests, statusFilter],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Solicitudes de alta B2B</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Cola de onboarding de /registrarse. Desde aca se aprueba la solicitud y se crea el cliente real en el sistema.
          </p>
          {lastUpdatedAt ? (
            <p className="mt-2 text-[11px] text-muted-foreground">Ultima sincronizacion: {formatDate(lastUpdatedAt)}</p>
          ) : null}
        </div>
        <button onClick={fetchRequests} className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-secondary/40 hover:text-foreground">
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {errorMessage ? (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">No se pudieron leer las altas B2B</p>
            <p className="mt-1 text-xs text-destructive/80">{errorMessage}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        {(["pending", "approved", "rejected"] as RegistrationStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`rounded-2xl border px-4 py-4 text-left transition ${statusFilter === status ? "border-primary/40 bg-primary/10" : "border-border/70 bg-card hover:bg-secondary/40"}`}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{STATUS_CONFIG[status].label}</p>
            <p className="mt-1 text-3xl font-black text-foreground">{counts[status] ?? 0}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "approved", "rejected"] as const).map((filterValue) => (
          <button
            key={filterValue}
            onClick={() => setStatusFilter(filterValue)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${statusFilter === filterValue ? "border-primary/40 bg-primary/15 text-primary" : "border-border/70 bg-card text-muted-foreground hover:text-foreground"}`}
          >
            {filterValue === "all" ? "Todas" : STATUS_CONFIG[filterValue].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl border border-border/70 bg-card" />
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card px-6 py-16 text-center">
          <Clock size={28} className="mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">No hay solicitudes para este estado.</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {requests.length === 0
              ? "No entro ninguna solicitud desde /registrarse o el admin y el portal no estan mirando la misma base de Supabase."
              : "Cambia el filtro para revisar solicitudes aprobadas, rechazadas o pendientes."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => {
            const isProcessing = processing === request.id;
            const statusCfg = STATUS_CONFIG[request.status];
            return (
              <div key={request.id} className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      {request.entity_type === "empresa" ? <Building2 size={18} /> : <User size={18} />}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{request.company_name || request.contact_name}</span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusCfg.cls}`}>
                          {statusCfg.label}
                        </span>
                        {request.approved_user_id ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                            <ShieldCheck className="h-3 w-3" /> Cliente creado
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono">{formatCuit(request.cuit)}</span>
                        <span>{TAX_LABELS[request.tax_status] ?? request.tax_status}</span>
                        <span>{request.entity_type === "empresa" ? "Persona juridica" : "Persona fisica"}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{request.contact_name}</span>
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <a href={`mailto:${request.email}`} className="text-primary hover:underline">{request.email}</a>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground">
                    <p>{formatDate(request.created_at)}</p>
                    <p className="mt-1 font-mono text-[10px]">{request.id.slice(0, 8)}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-xl border border-border/70 bg-secondary/20 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Solicitante</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{request.contact_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{request.email}</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-secondary/20 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Vendedor asignado</p>
                    {request.assigned_seller ? (
                      <>
                        <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-foreground"><UserCheck className="h-4 w-4 text-primary" /> {request.assigned_seller.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{request.assigned_seller.email}</p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">Asignacion pendiente</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-border/70 bg-secondary/20 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Estado operativo</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {request.approved_user_id ? "Cliente dado de alta" : request.status === "pending" ? "Pendiente de aprobacion" : request.status === "approved" ? "Aprobada sin cliente visible" : "Solicitud cerrada"}
                    </p>
                    {request.approved_user_id ? (
                      <p className="mt-1 text-xs text-muted-foreground font-mono">{request.approved_user_id}</p>
                    ) : null}
                  </div>
                </div>

                {request.notes ? (
                  <p className="mt-3 rounded-xl bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">{request.notes}</p>
                ) : null}

                {request.status === "pending" ? (
                  <div className="mt-4 space-y-4">
                    {onboardingForm?.id === request.id ? (
                      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex-1 min-w-[200px]">
                            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-bold">Tipo de cliente</label>
                            <select
                              value={onboardingForm.client_type}
                              onChange={(e) => setOnboardingForm({ ...onboardingForm, client_type: e.target.value })}
                              className="w-full h-9 rounded-xl border border-border/70 bg-card px-3 text-xs font-semibold focus:border-primary/50 focus:ring-0 outline-none"
                            >
                              <option value="mayorista">Mayorista (Normal)</option>
                              <option value="empresa">Empresa / Corporativo</option>
                              <option value="reseller">Reseller / Gremio</option>
                            </select>
                          </div>
                          <div className="w-32">
                            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-bold">Margen base (%)</label>
                            <input
                              type="number"
                              value={onboardingForm.default_margin}
                              onChange={(e) => setOnboardingForm({ ...onboardingForm, default_margin: Number(e.target.value) })}
                              className="w-full h-9 rounded-xl border border-border/70 bg-card px-3 text-xs font-semibold focus:border-primary/50 focus:ring-0 outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateStatus(request.id, "approved", undefined, onboardingForm.client_type, onboardingForm.default_margin)}
                            disabled={isProcessing}
                            className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                          >
                            <CheckCircle2 size={15} /> Confirmar alta
                          </button>
                          <button
                            onClick={() => setOnboardingForm(null)}
                            disabled={isProcessing}
                            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setOnboardingForm({ id: request.id, client_type: "mayorista", default_margin: 20 })}
                          disabled={isProcessing}
                          className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                        >
                          <CheckCircle2 size={15} /> Aprobar y crear cliente
                        </button>
                        <button
                          onClick={() => updateStatus(request.id, "rejected")}
                          disabled={isProcessing}
                          className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl border border-border/70 px-4 py-2 text-sm font-bold text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        >
                          <XCircle size={15} /> Rechazar
                        </button>
                      </div>
                    )}
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
