import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building,
  Building2,
  CheckCircle2,
  ChevronRight,
  Landmark,
  Lock,
  Mail,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  Zap,
} from "lucide-react";

import {
  detectCuitEntityType,
  formatCuit,
  isCuitChecksumValid,
  type CuitEntityType,
  type TaxStatus,
} from "@/lib/api/afip";
import { createRegistrationRequest, lookupCuit } from "@/lib/api/registrationApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  getAttributionParams,
  trackRegistrationComplete,
  trackRegistrationPendingReview,
  trackRegistrationStart,
} from "@/lib/marketingTracker";
import { supabase } from "@/lib/supabase";

type AfipData = {
  companyName: string;
  entityType: CuitEntityType;
};

const steps = [
  { id: 1, label: "Validacion fiscal", icon: Landmark },
  { id: 2, label: "Datos de acceso", icon: Lock },
  { id: 3, label: "Confirmacion", icon: CheckCircle2 },
] as const;

const TAX_STATUS_LABELS: Record<TaxStatus, string> = {
  responsable_inscripto: "Responsable Inscripto",
  monotributista: "Monotributista",
  exento: "Exento",
  consumidor_final: "Consumidor Final",
};

const TAX_STATUS_OPTIONS = Object.entries(TAX_STATUS_LABELS).map(([value, label]) => ({
  value: value as TaxStatus,
  label,
}));

const HIDDEN_TAX_STATUS = new Set<TaxStatus>(["consumidor_final"]);
const PUBLIC_TAX_STATUS_OPTIONS = TAX_STATUS_OPTIONS.filter(
  (option) => !HIDDEN_TAX_STATUS.has(option.value),
);

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.ar",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "mail.com",
  "yandex.com",
  "zoho.com",
]);

function getEmailDomain(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex >= normalized.length - 1) return null;
  return normalized.slice(atIndex + 1);
}

function isCorporateEmail(value: string): boolean {
  const domain = getEmailDomain(value);
  return !!domain && !FREE_EMAIL_DOMAINS.has(domain);
}

const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [cuit, setCuit] = useState("");
  const [afipData, setAfipData] = useState<AfipData | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [taxStatus, setTaxStatus] = useState<TaxStatus | "">("");
  const [assignedExecutiveDetails, setAssignedExecutiveDetails] = useState<{
    name: string;
    role: string;
    email: string;
  } | null>(null);
  const [finalState, setFinalState] = useState<{
    mode: "auto_approved" | "pending_review";
    reviewFlags: string[];
  } | null>(null);

  const executive = assignedExecutiveDetails;
  const hasTrackedStartRef = useRef(false);

  const rawDigits = cuit.replace(/\D/g, "");
  const detectedEntity: CuitEntityType | null =
    rawDigits.length >= 2 ? detectCuitEntityType(rawDigits) : null;
  const checksumValid =
    rawDigits.length === 11 ? isCuitChecksumValid(rawDigits) : null;
  const normalizedEmail = email.trim().toLowerCase();
  const emailDomain = getEmailDomain(normalizedEmail);
  const hasCorporateEmail = isCorporateEmail(normalizedEmail);
  const mustGoToManualReview =
    !!afipData &&
    (afipData.entityType !== "empresa" || (normalizedEmail.length > 0 && !hasCorporateEmail));

  const lookupRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookedUp, setLookedUp] = useState(false);

  useEffect(() => {
    if (lookupRef.current) clearTimeout(lookupRef.current);

    if (rawDigits.length !== 11 || !isCuitChecksumValid(rawDigits)) {
      setLookedUp(false);
      return;
    }

    lookupRef.current = setTimeout(async () => {
      setLookupLoading(true);
      setError("");
      try {
        const result = await lookupCuit(rawDigits);
        setAfipData({
          companyName: result.companyName,
          entityType: result.entityType,
        });
        setName(result.companyName);
        setLookedUp(true);
      } catch {
        // Silent fail: the user can still continue manually after validating.
      } finally {
        setLookupLoading(false);
      }
    }, 600);

    return () => {
      if (lookupRef.current) clearTimeout(lookupRef.current);
    };
  }, [rawDigits]);

  function handleCuitChange(value: string) {
    setCuit(formatCuit(value));
    setError("");
    setLookedUp(false);
    setAfipData(null);
    setTaxStatus("");
  }

  const handleValidateCuit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (rawDigits.length !== 11) {
      setError("El CUIT debe tener 11 digitos.");
      return;
    }

    if (!isCuitChecksumValid(rawDigits)) {
      setError("El CUIT ingresado no es valido. Verifica los numeros.");
      return;
    }

    setLoading(true);
    try {
      const existing = lookedUp && afipData ? afipData : null;
      const result =
        existing ??
        (await lookupCuit(rawDigits).then((response) => ({
          companyName: response.companyName,
          entityType: response.entityType,
        })));

      setAfipData(result);
      setName(result.companyName);
      if (!hasTrackedStartRef.current) {
        trackRegistrationStart({
          cuit_entity_type: result.entityType,
          ...getAttributionParams(),
        });
        hasTrackedStartRef.current = true;
      }
      setStep(2);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No pudimos validar este CUIT en AFIP.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!taxStatus) {
      setError("Selecciona tu condicion fiscal.");
      return;
    }

    setLoading(true);
    try {
      const localReviewFlags: string[] = [];
      if (afipData?.entityType !== "empresa") {
        localReviewFlags.push("cuit_not_empresa");
      }
      if (!isCorporateEmail(normalizedEmail)) {
        localReviewFlags.push("non_corporate_email");
      }
      const forceManualReview = localReviewFlags.length > 0;

      const result = await createRegistrationRequest({
        cuit: rawDigits,
        company_name: name,
        contact_name: name,
        email: normalizedEmail,
        password,
        entity_type: afipData?.entityType ?? "empresa",
        tax_status: taxStatus,
        is_corporate_email: isCorporateEmail(normalizedEmail),
        force_pending_review: forceManualReview,
        review_flags: localReviewFlags,
        attribution: getAttributionParams(),
      });

      const mergedReviewFlags = [
        ...new Set([...(result.review_flags ?? []), ...localReviewFlags]),
      ];
      const shouldTreatAsPendingReview =
        forceManualReview || result.status !== "auto_approved";

      setAssignedExecutiveDetails(
        result.assigned_executive?.email
          ? {
              name: result.assigned_executive.name ?? "Ejecutivo comercial",
              role: result.assigned_executive.role ?? "Equipo de ventas B2B",
              email: result.assigned_executive.email,
            }
          : null,
      );

      if (!shouldTreatAsPendingReview) {
        trackRegistrationComplete(result.approved_user_id ?? result.id, name, {
          review_flags: mergedReviewFlags,
          ...getAttributionParams(),
        });

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });

        if (!authError && authData.session) {
          navigate("/b2b-portal", { replace: true });
          return;
        }

        setFinalState({
          mode: "auto_approved",
          reviewFlags: mergedReviewFlags,
        });
        setStep(3);
        return;
      }

      trackRegistrationPendingReview(name, mergedReviewFlags, {
        forced_manual_review: forceManualReview,
        is_corporate_email: isCorporateEmail(normalizedEmail),
        cuit_entity_type: afipData?.entityType ?? null,
        ...getAttributionParams(),
      });
      setFinalState({
        mode: "pending_review",
        reviewFlags: mergedReviewFlags,
      });
      setStep(3);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "No pudimos procesar la solicitud.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-12 selection:bg-primary/30">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-10%] h-[24rem] w-[24rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[20rem] w-[20rem] rounded-full bg-[hsl(var(--gradient-end)/0.12)] blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 mx-auto w-full max-w-2xl"
      >
        <div className="mb-10 text-center">
          <Link to="/" className="mb-6 inline-flex items-center gap-3">
            <img
              src="/android-chrome-512x512.png"
              alt="Bartez"
              className="h-16 w-16 rounded-2xl object-contain"
            />
            <div className="text-left">
              <span className="block font-display text-2xl font-black tracking-tight text-foreground">
                BARTEZ
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Canal empresas
              </span>
            </div>
          </Link>

          <PageHeader
            align="center"
            eyebrow="Onboarding B2B"
            title="Solicitud de alta corporativa"
            description="Canal exclusivo B2B para empresas, mayoristas e integradores. No gestionamos altas de consumidor final."
          />
        </div>

        <div className="mb-8 grid gap-3 md:grid-cols-3">
          {steps.map((item, index) => {
            const isActive = step === item.id;
            const isComplete = step > item.id;
            const Icon = item.icon;

            return (
              <div key={item.id} className="relative">
                {index < steps.length - 1 ? (
                  <div className="absolute left-[60%] top-5 hidden h-px w-[80%] bg-border md:block">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: isComplete ? "100%" : "0%" }}
                    />
                  </div>
                ) : null}

                <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-3 backdrop-blur-sm">
                  <div
                    className={[
                      "flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors",
                      isComplete ? "border-primary bg-primary text-primary-foreground" : "",
                      isActive ? "border-primary bg-primary/10 text-primary" : "",
                      !isComplete && !isActive
                        ? "border-border bg-muted/50 text-muted-foreground"
                        : "",
                    ].join(" ")}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Paso {item.id}
                    </p>
                    <p
                      className={
                        isActive || isComplete
                          ? "text-sm font-semibold text-foreground"
                          : "text-sm font-medium text-muted-foreground"
                      }
                    >
                      {item.label}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <SurfaceCard tone="glass" padding="xl" className="overflow-hidden">
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-start gap-4 rounded-2xl border border-primary/20 bg-primary/10 p-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                      Fast-track onboarding
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Validacion fiscal en tiempo real para altas de empresas, mayoristas e integradores del canal B2B.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleValidateCuit} className="space-y-5">
                  <div>
                    <label
                      className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                      htmlFor="cuit"
                    >
                      CUIT / CUIL
                    </label>

                    <div className="relative">
                      <Landmark className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="cuit"
                        value={cuit}
                        onChange={(event) => handleCuitChange(event.target.value)}
                        placeholder="20-XXXXXXXX-X"
                        className="h-14 rounded-2xl pl-12 font-mono"
                        required
                      />
                    </div>

                    <AnimatePresence>
                      {detectedEntity !== null && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2 overflow-hidden"
                        >
                          <div className="flex items-center gap-2">
                            {detectedEntity === "empresa" ? (
                              <>
                                <Building2 className="h-3.5 w-3.5 text-blue-500" />
                                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                  Persona juridica / Empresa
                                </span>
                              </>
                            ) : (
                              <>
                                <User className="h-3.5 w-3.5 text-primary" />
                                <span className="text-xs font-semibold text-primary">
                                  Persona fisica
                                </span>
                              </>
                            )}

                            {checksumValid === false ? (
                              <span className="ml-auto text-xs text-destructive">
                                CUIT invalido
                              </span>
                            ) : null}

                            {lookupLoading ? (
                              <span className="ml-auto animate-pulse text-xs text-muted-foreground">
                                Consultando AFIP...
                              </span>
                            ) : null}

                            {checksumValid === true && !lookupLoading && !lookedUp ? (
                              <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-500" />
                            ) : null}
                          </div>

                          {lookedUp && afipData ? (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-3 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3"
                            >
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                {afipData.entityType === "empresa" ? (
                                  <Building2 className="h-4 w-4" />
                                ) : (
                                  <User className="h-4 w-4" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-foreground">
                                  {afipData.companyName ||
                                    (afipData.entityType === "empresa"
                                      ? "Persona juridica"
                                      : "Persona fisica")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {afipData.companyName
                                    ? "Nombre detectado por el CUIT. Podes corregirlo en el paso siguiente."
                                    : "CUIT valido. Completa el nombre en el paso siguiente."}
                                </p>
                              </div>

                              <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-500" />
                            </motion.div>
                          ) : null}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/40 p-4">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-sm leading-6 text-muted-foreground">
                      Este acceso es exclusivo para operaciones B2B en Argentina. Las solicitudes de consumidor final no se aprueban automaticamente.
                    </p>
                  </div>

                  {error ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                    >
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  ) : null}

                  <Button
                    type="submit"
                    className="h-14 w-full rounded-2xl bg-gradient-primary text-base font-semibold shadow-lg shadow-primary/20 hover:opacity-90"
                    disabled={loading || checksumValid === false}
                  >
                    {loading ? "Validando entidad..." : "Comenzar validacion"}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </form>
              </motion.div>
            ) : null}

            {step === 2 && afipData ? (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="rounded-3xl border border-border/70 bg-card/80 p-5">
                  <div className="mb-3 flex items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="success">Entidad validada</Badge>
                      <Badge variant="outline">Canal exclusivo B2B</Badge>
                      <Badge variant="outline">Sin consumidor final</Badge>
                      <span className="text-xs text-muted-foreground">
                        {afipData.entityType === "empresa"
                          ? "Persona juridica"
                          : "Persona fisica"}
                      </span>
                    </div>
                    {afipData.entityType === "empresa" ? (
                      <Building2 className="h-8 w-8 text-primary/40" />
                    ) : (
                      <User className="h-8 w-8 text-primary/40" />
                    )}
                  </div>

                  <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">
                    {afipData.companyName ||
                      (afipData.entityType === "empresa"
                        ? "Empresa / Persona juridica"
                        : "Persona fisica")}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">CUIT {cuit}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    La condicion fiscal la elegis vos en el formulario de abajo.
                  </p>
                </div>

                {mustGoToManualReview ? (
                  <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
                    Esta solicitud va a revision manual del equipo comercial porque el CUIT no figura como empresa o el email no es corporativo.
                  </div>
                ) : null}

                <form onSubmit={handleFinalSubmit} className="space-y-4">
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={
                        afipData.entityType === "empresa"
                          ? "Razon social de la empresa"
                          : "Nombre y apellido"
                      }
                      className="h-14 rounded-2xl pl-12"
                      required
                    />
                  </div>

                  <div className="relative">
                    <Landmark className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <select
                      value={taxStatus}
                      onChange={(event) =>
                        setTaxStatus(event.target.value as TaxStatus | "")
                      }
                      className="h-14 w-full rounded-2xl border border-border/70 bg-background pl-12 pr-4 text-sm text-foreground outline-none transition focus:border-primary/40"
                      required
                    >
                      <option value="">Selecciona tu condicion fiscal</option>
                      {PUBLIC_TAX_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Email corporativo (@empresa.com)"
                      className="h-14 rounded-2xl pl-12"
                      required
                    />
                  </div>

                  {normalizedEmail.length > 0 && !hasCorporateEmail ? (
                    <p className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                      Detectamos un dominio de email personal ({emailDomain ?? "sin dominio"}). La solicitud ingresara con revision manual.
                    </p>
                  ) : null}

                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Crea una contrasena segura"
                      className="h-14 rounded-2xl pl-12 font-mono text-sm"
                      required
                    />
                  </div>

                  {error ? (
                    <p className="rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </p>
                  ) : null}

                  <div className="space-y-3 pt-2">
                    <Button
                      type="submit"
                      className="h-14 w-full rounded-2xl bg-gradient-primary text-base font-semibold shadow-lg shadow-primary/20 hover:opacity-90"
                      disabled={loading}
                    >
                      {loading ? "Procesando alta..." : "Finalizar solicitud B2B"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setStep(1)}
                    >
                      Volver a editar CUIT
                    </Button>
                  </div>
                </form>
              </motion.div>
            ) : null}

            {step === 3 ? (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 text-center"
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                  <ShieldCheck className="h-10 w-10" />
                </div>

                <div className="space-y-3">
                  <h3 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                    {finalState?.mode === "auto_approved"
                      ? "Cuenta creada"
                      : "Solicitud en revision"}
                  </h3>
                  <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground">
                    {finalState?.mode === "auto_approved"
                      ? "La cuenta ya quedo aprobada y lista para ingresar. Si el acceso automatico no se completo, podes usar el login con las credenciales que acabas de crear."
                      : "Validamos los datos fiscales y dejamos la solicitud en revision comercial para mantener el canal exclusivo B2B."}
                  </p>
                </div>

                <div className="rounded-[28px] border border-border/70 bg-card/80 p-6 text-left">
                  <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                    {finalState?.mode === "auto_approved"
                      ? "Mesa comercial asignada"
                      : "Ejecutivo asignado"}
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
                      <Users className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-foreground">
                        {executive?.name ?? "Equipo comercial B2B"}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {executive?.role ?? "Asignacion pendiente"}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                        <span className="inline-flex items-center gap-1 font-semibold text-primary">
                          <Zap className="h-3 w-3" />
                          Online
                        </span>
                        <span className="text-muted-foreground">
                          {executive?.email ?? "Asignacion pendiente"}
                        </span>
                      </div>
                    </div>
                    <Building className="ml-auto hidden h-10 w-10 text-primary/20 sm:block" />
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/40 p-4 text-left">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--gradient-end)/0.12)] text-[hsl(var(--gradient-end))]">
                    <Lock className="h-4 w-4" />
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {finalState?.mode === "auto_approved"
                      ? "La cuenta quedo creada sobre Supabase Auth y el backend central. El proximo login ya entra al portal B2B con tu perfil activo."
                      : "La informacion cargada queda protegida y lista para validacion operativa. Solo las altas con excepciones requieren intervencion manual."}
                  </p>
                </div>

                {finalState?.mode === "pending_review" && finalState.reviewFlags.length > 0 ? (
                  <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Revision detectada
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {finalState.reviewFlags.map((flag) => (
                        <Badge key={flag} variant="outline" className="rounded-full">
                          {flag.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                <Button
                  variant="outline"
                  className="h-12 w-full rounded-2xl"
                  onClick={() => navigate("/login")}
                >
                  {finalState?.mode === "auto_approved" ? "Ingresar al login" : "Ir al login"}
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </SurfaceCard>

        {step < 3 ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Ya sos partner?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Inicia sesion
            </Link>
          </p>
        ) : null}
      </motion.div>
    </div>
  );
};

export default Register;
