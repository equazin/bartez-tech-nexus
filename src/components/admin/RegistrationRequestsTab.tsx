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
import { toast } from "sonner";

import {
  listRegistrationRequests,
  updateRegistrationRequest,
  type RegistrationBaseStatus,
  type RegistrationRequestRecord,
  type RegistrationWorkflowStatus,
} from "@/lib/api/registrationApi";

const TAX_LABELS: Record<string, string> = {
  responsable_inscripto: "Resp. Inscripto",
  monotributista: "Monotributista",
  exento: "Exento",
  consumidor_final: "Consumidor Final",
  no_especificado: "No especificado",
};

const STATUS_CONFIG: Record<RegistrationWorkflowStatus, { label: string; cls: string }> = {
  pending_review: {
    label: "Revision manual",
    cls: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  },
  auto_approved: {
    label: "Autoaprobada",
    cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  },
  approved_manual: {
    label: "Aprobada manual",
    cls: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  },
  rejected: {
    label: "Rechazada",
    cls: "bg-red-500/15 text-red-500 border-red-500/30",
  },
};

const REVIEW_FLAG_LABELS: Record<string, string> = {
  blocked_cuit: "CUIT bloqueado",
  blocked_email_domain: "Dominio bloqueado",
  review_email_domain: "Dominio bajo revision",
  cuit_not_empresa: "CUIT no corresponde a empresa",
  non_corporate_email: "Email no corporativo",
  existing_profile_email: "Email ya registrado",
  duplicate_cuit: "CUIT duplicado",
  duplicate_email: "Email duplicado",
  auth_conflict: "Conflicto en Auth",
  auto_approval_failed: "Fallo la autoaprobacion",
};

function formatCuit(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return raw;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
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

function getSuggestedAction(flags: string[]) {
  if (flags.includes("cuit_not_empresa") || flags.includes("non_corporate_email")) {
    return "Validar documentacion comercial y aprobar solo si corresponde al canal B2B.";
  }
  if (flags.includes("blocked_cuit") || flags.includes("blocked_email_domain")) {
    return "Validar con ventas antes de aprobar.";
  }
  if (flags.includes("existing_profile_email") || flags.includes("auth_conflict")) {
    return "Revisar si la cuenta ya existe antes de crear otro acceso.";
  }
  if (flags.includes("duplicate_cuit") || flags.includes("duplicate_email")) {
    return "Unificar con la solicitud previa o rechazar duplicados.";
  }
  return "Aprobar manualmente solo si la documentacion y el contacto son correctos.";
}

export function RegistrationRequestsTab() {
  const [requests, setRequests] = useState<RegistrationRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RegistrationWorkflowStatus | "all">("pending_review");
  const [processing, setProcessing] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [onboardingForm, setOnboardingForm] = useState<{
    id: string;
    client_type: "mayorista" | "reseller" | "empresa";
    default_margin: number;
  } | null>(null);

  async function fetchRequests() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const result = await listRegistrationRequests("all");
      setRequests(result);
      setLastUpdatedAt(new Date().toISOString());
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

  async function updateStatus(
    id: string,
    status: RegistrationBaseStatus,
    notes?: string,
    client_type?: "mayorista" | "reseller" | "empresa",
    default_margin?: number,
  ) {
    setProcessing(id);
    try {
      const result = await updateRegistrationRequest(id, {
        status,
        ...(notes ? { notes } : {}),
        ...(client_type ? { client_type } : {}),
        ...(default_margin !== undefined ? { default_margin } : {}),
      });

      if (status === "approved") {
        if (result.used_temp_password) {
          toast.success("Cliente creado con contrasena temporal; debe resetearla por email.");
        } else {
          toast.success("Excepcion aprobada y cliente creado.");
        }
      } else {
        toast.success("Solicitud rechazada.");
      }

      setOnboardingForm(null);
      await fetchRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la solicitud.");
    } finally {
      setProcessing(null);
    }
  }

  const counts = useMemo(
    () =>
      requests.reduce(
        (acc, request) => {
          acc[request.workflow_status] = (acc[request.workflow_status] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    [requests],
  );

  const filteredRequests = useMemo(
    () =>
      statusFilter === "all"
        ? requests
        : requests.filter((request) => request.workflow_status === statusFilter),
    [requests, statusFilter],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Excepciones de onboarding B2B</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            La regla por defecto ahora es autoaprobar. Desde aca solo gestionamos excepciones, conflictos y revisiones manuales.
          </p>
          {lastUpdatedAt ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Ultima sincronizacion: {formatDate(lastUpdatedAt)}
            </p>
          ) : null}
        </div>
        <button
          onClick={fetchRequests}
          className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-secondary/40 hover:text-foreground"
        >
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
        {(["pending_review", "auto_approved", "rejected"] as RegistrationWorkflowStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`rounded-2xl border px-4 py-4 text-left transition ${
              statusFilter === status
                ? "border-primary/40 bg-primary/10"
                : "border-border/70 bg-card hover:bg-secondary/40"
            }`}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {STATUS_CONFIG[status].label}
            </p>
            <p className="mt-1 text-3xl font-black text-foreground">{counts[status] ?? 0}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "pending_review", "auto_approved", "approved_manual", "rejected"] as const).map((filterValue) => (
          <button
            key={filterValue}
            onClick={() => setStatusFilter(filterValue)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === filterValue
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border/70 bg-card text-muted-foreground hover:text-foreground"
            }`}
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
              ? "No hay excepciones pendientes. Si entran altas limpias, se autoaprueban y no necesitan accion manual."
              : "Cambia el filtro para revisar altas autoaprobadas, aprobadas manualmente o rechazadas."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => {
            const isProcessing = processing === request.id;
            const statusCfg = STATUS_CONFIG[request.workflow_status];

            return (
              <div key={request.id} className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      {request.entity_type === "empresa" ? <Building2 size={18} /> : <User size={18} />}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-foreground">
                          {request.company_name || request.contact_name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusCfg.cls}`}
                        >
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
                          <a href={`mailto:${request.email}`} className="text-primary hover:underline">
                            {request.email}
                          </a>
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
                        <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                          <UserCheck className="h-4 w-4 text-primary" /> {request.assigned_seller.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{request.assigned_seller.email}</p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">Asignacion pendiente</p>
                    )}
                  </div>
                  <div className="rounded-xl border border-border/70 bg-secondary/20 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Estado operativo</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {request.workflow_status === "pending_review"
                        ? "Excepcion pendiente de revision"
                        : request.workflow_status === "auto_approved"
                          ? "Alta resuelta automaticamente"
                          : request.workflow_status === "approved_manual"
                            ? "Alta aprobada por el equipo"
                            : "Solicitud cerrada"}
                    </p>
                    {request.approved_user_id ? (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{request.approved_user_id}</p>
                    ) : null}
                  </div>
                </div>

                {request.review_flags.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-3">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-amber-600">Flags de revision</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {request.review_flags.map((flag) => (
                        <span
                          key={flag}
                          className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-700"
                        >
                          {REVIEW_FLAG_LABELS[flag] ?? flag.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {getSuggestedAction(request.review_flags)}
                    </p>
                  </div>
                ) : null}

                {request.notes ? (
                  <p className="mt-3 rounded-xl bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                    {request.notes}
                  </p>
                ) : null}

                {request.workflow_status === "pending_review" ? (
                  <div className="mt-4 space-y-4">
                    {onboardingForm?.id === request.id ? (
                      <div className="animate-in slide-in-from-top-2 fade-in space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="min-w-[200px] flex-1">
                            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Tipo de cliente
                            </label>
                            <select
                              value={onboardingForm.client_type}
                              onChange={(event) =>
                                setOnboardingForm({
                                  ...onboardingForm,
                                  client_type: event.target.value as "mayorista" | "reseller" | "empresa",
                                })
                              }
                              className="h-9 w-full rounded-xl border border-border/70 bg-card px-3 text-xs font-semibold outline-none transition focus:border-primary/50 focus:ring-0"
                            >
                              <option value="mayorista">Mayorista (Normal)</option>
                              <option value="empresa">Empresa / Corporativo</option>
                              <option value="reseller">Reseller / Gremio</option>
                            </select>
                          </div>
                          <div className="w-32">
                            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              Margen base (%)
                            </label>
                            <input
                              type="number"
                              value={onboardingForm.default_margin}
                              onChange={(event) =>
                                setOnboardingForm({
                                  ...onboardingForm,
                                  default_margin: Number(event.target.value),
                                })
                              }
                              className="h-9 w-full rounded-xl border border-border/70 bg-card px-3 text-xs font-semibold outline-none transition focus:border-primary/50 focus:ring-0"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateStatus(
                                request.id,
                                "approved",
                                undefined,
                                onboardingForm.client_type,
                                onboardingForm.default_margin,
                              )
                            }
                            disabled={isProcessing}
                            className="inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                          >
                            <CheckCircle2 size={15} /> Confirmar alta
                          </button>
                          <button
                            onClick={() => setOnboardingForm(null)}
                            disabled={isProcessing}
                            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() =>
                            setOnboardingForm({
                              id: request.id,
                              client_type: "mayorista",
                              default_margin: 20,
                            })
                          }
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
