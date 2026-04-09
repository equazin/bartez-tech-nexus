/**
 * /evaluacion-tecnologica — Multistep enterprise evaluation form
 * Step 1: Project context (type + area + company size)
 * Step 2: Commercial qualification (budget + timeline + role)
 * Step 3: Contact details + description
 */
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Server, Network, Monitor, Wrench, Shield, Cloud, Headphones, Settings,
  ArrowRight, ArrowLeft, Send, MessageSquare, CheckCircle2, Building2,
  Clock, DollarSign, Users, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSearchParams, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { StepIndicator } from "@/components/eval/StepIndicator";
import { SelectCard } from "@/components/eval/SelectCard";
import { FormCard, FieldGroup } from "@/components/eval/FormCard";

// ── Data ──────────────────────────────────────────────────────────────────────
const PROJECT_TYPES = [
  { id: "infrastructure", icon: Server,  label: "Infraestructura IT",      desc: "Servidores, almacenamiento, data center" },
  { id: "networking",     icon: Network, label: "Redes y Conectividad",     desc: "LAN/WAN, WiFi, VPN, cableado estructurado" },
  { id: "equipment",      icon: Monitor, label: "Equipamiento Corporativo", desc: "Notebooks, estaciones de trabajo, periféricos" },
  { id: "partnership",    icon: Wrench,  label: "Partnership Tecnológico",  desc: "Soporte continuo y gestión IT mensual" },
];

const NEEDS_AREAS = [
  { id: "servers",   icon: Server,    label: "Servidores" },
  { id: "network",   icon: Network,   label: "Redes" },
  { id: "security",  icon: Shield,    label: "Seguridad" },
  { id: "cloud",     icon: Cloud,     label: "Nube" },
  { id: "support",   icon: Headphones,label: "Soporte IT" },
  { id: "equipment", icon: Monitor,   label: "Equipamiento" },
  { id: "consult",   icon: Settings,  label: "Consultoría" },
  { id: "users",     icon: Users,     label: "Usuarios / Puestos" },
];

const COMPANY_SIZES = [
  { id: "1-10",   label: "1–10",   sub: "empleados" },
  { id: "11-50",  label: "11–50",  sub: "empleados" },
  { id: "51-200", label: "51–200", sub: "empleados" },
  { id: "200+",   label: "200+",   sub: "empleados" },
];

const BUDGETS = [
  { id: "lt1k",   label: "< USD 1.000",       sub: "Proyecto pequeño" },
  { id: "1k-5k",  label: "USD 1.000 – 5.000",  sub: "Proyecto mediano" },
  { id: "5k-20k", label: "USD 5.000 – 20.000", sub: "Proyecto grande" },
  { id: "gt20k",  label: "+ USD 20.000",        sub: "Proyecto enterprise" },
];

const TIMELINES = [
  { id: "urgent",  icon: Zap,      label: "Urgente",      sub: "Lo necesito ya" },
  { id: "1month",  icon: Clock,    label: "1 mes",         sub: "Próximas semanas" },
  { id: "3months", icon: Clock,    label: "3 meses",       sub: "Sin apuro" },
  { id: "explore", icon: Settings, label: "Explorando",   sub: "Evaluando opciones" },
];

const ROLES = [
  { id: "owner", icon: Building2, label: "Dueño / CEO",     desc: "Tomo la decisión final" },
  { id: "it",    icon: Server,    label: "Responsable IT",  desc: "Gestiono la tecnología" },
  { id: "buy",   icon: DollarSign,label: "Compras / Adm",  desc: "Manejo el presupuesto" },
  { id: "other", icon: Users,     label: "Otro rol",        desc: "Participo en la decisión" },
];

const STEP_LABELS = ["Contexto", "Calificación", "Datos"];

const GOOGLE_SHEET_URL =
  "https://script.google.com/macros/s/AKfycbxlRVccJ9cCgbrjWFCu6sWmkG90HCZO1izY0e26dnla9xZMBiT0wpZvmWgt-G_P8svC/exec";

// ── Slide variants ────────────────────────────────────────────────────────────
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const } },
  exit:  (dir: number) => ({ x: dir > 0 ? -48 : 48, opacity: 0, transition: { duration: 0.25 } }),
};

// ── Chip ──────────────────────────────────────────────────────────────────────
function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      type="button" onClick={onClick}
      whileTap={{ scale: 0.96 }}
      className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium border transition-all
        ${selected
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border/40 bg-card text-muted-foreground hover:border-border/70 hover:text-foreground"}`}
    >
      {selected && <CheckCircle2 size={11} className="shrink-0" />}
      {children}
    </motion.button>
  );
}

// ── SizeButton ────────────────────────────────────────────────────────────────
function SizeButton({ selected, onClick, label, sub }: { selected: boolean; onClick: () => void; label: string; sub: string }) {
  return (
    <motion.button
      type="button" onClick={onClick} whileTap={{ scale: 0.97 }}
      className={`flex flex-col items-center rounded-xl px-5 py-3.5 border transition-all font-medium
        ${selected
          ? "border-primary/60 bg-primary/10 text-primary shadow-[0_0_16px_hsl(var(--primary)/0.12)]"
          : "border-border/40 bg-card text-muted-foreground hover:border-border/70"}`}
    >
      <span className="text-xl font-bold leading-none">{label}</span>
      <span className="text-[10px] mt-1 opacity-60">{sub}</span>
    </motion.button>
  );
}

// ── Success ───────────────────────────────────────────────────────────────────
function SuccessScreen({ name }: { name: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <FormCard className="text-center max-w-xl mx-auto">
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-5 mx-auto"
        >
          <CheckCircle2 size={32} className="text-primary" />
        </motion.div>
        <h2 className="font-display text-2xl font-bold text-foreground mb-2">
          ¡Solicitud recibida{name ? `, ${name.split(" ")[0]}` : ""}!
        </h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed mb-8">
          Un consultor revisará tu caso y te contactará en las próximas{" "}
          <strong className="text-foreground">24–48 horas hábiles</strong> para una reunión sin cargo.
        </p>
        <ol className="text-left space-y-3 max-w-xs mx-auto mb-8">
          {[
            "Analizamos tu sector y situación actual",
            "Te contactamos para coordinar una reunión sin cargo",
            "Presentamos una propuesta adaptada a tu empresa",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
              <span className="font-display font-extrabold text-border/50 text-lg leading-tight shrink-0">0{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <a
            href="https://wa.me/5493415104902?text=Hola%2C%20acabo%20de%20enviar%20mi%20solicitud%20de%20evaluaci%C3%B3n%20tecnol%C3%B3gica."
            target="_blank" rel="noopener noreferrer"
          >
            <Button className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white h-10 px-5 text-sm gap-2">
              <MessageSquare size={14} /> Confirmar por WhatsApp
            </Button>
          </a>
          <Link to="/">
            <Button variant="outline" className="w-full sm:w-auto border-border/50 h-10 px-5 text-sm gap-2">
              Volver al inicio <ArrowRight size={13} />
            </Button>
          </Link>
        </div>
      </FormCard>
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function QuoteRequest() {
  const [searchParams] = useSearchParams();
  const [step, setStep]               = useState(1);
  const [dir, setDir]                 = useState(1);
  const [loading, setLoading]         = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [submittedName, setSubmittedName] = useState("");
  const [errors, setErrors]           = useState<Record<string, string>>({});

  // Step 1
  const [projectTypes, setProjectTypes] = useState<string[]>(() => {
    const t = searchParams.get("tipo"); return t ? [t] : [];
  });
  const [needs, setNeeds]             = useState<string[]>([]);
  const [companySize, setCompanySize] = useState("");

  // Step 2
  const [budget, setBudget]           = useState("");
  const [timeline, setTimeline]       = useState("");
  const [role, setRole]               = useState("");

  // Step 3
  const [name, setName]               = useState("");
  const [company, setCompany]         = useState("");
  const [email, setEmail]             = useState("");
  const [phone, setPhone]             = useState("");
  const [detail, setDetail]           = useState("");

  const toggleArr = useCallback((id: string, arr: string[], set: (v: string[]) => void) => {
    set(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  }, []);

  const goTo = (next: number) => {
    setDir(next > step ? 1 : -1);
    setErrors({});
    setStep(next);
  };

  const validateStep1 = () => {
    if (projectTypes.length === 0) { setErrors({ type: "Seleccioná al menos un tipo de proyecto" }); return false; }
    return true;
  };

  const validateStep3 = () => {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errs.name = "Ingresá tu nombre";
    if (!company.trim()) errs.company = "Ingresá el nombre de tu empresa";
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Email inválido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    goTo(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep3()) return;
    setLoading(true);

    const typesLabel   = projectTypes.map(id => PROJECT_TYPES.find(t => t.id === id)?.label || id).join(", ") || "-";
    const needsLabel   = needs.map(id => NEEDS_AREAS.find(a => a.id === id)?.label || id).join(", ") || "-";
    const budgetLabel  = BUDGETS.find(b => b.id === budget)?.label || budget || "-";
    const timelineLabel= TIMELINES.find(t => t.id === timeline)?.label || timeline || "-";
    const roleLabel    = ROLES.find(r => r.id === role)?.label || role || "-";

    try {
      fetch(GOOGLE_SHEET_URL, {
        method: "POST", mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, company, email, phone,
          typeLabel: typesLabel, needsLabels: needsLabel,
          companySize: companySize || "-",
          budget: budgetLabel, urgency: timelineLabel, role: roleLabel,
          detail: detail || "-",
        }),
      });

      try {
        const msg = [
          "SOLICITUD DE EVALUACIÓN TECNOLÓGICA",
          "",
          `Tipo de proyecto: ${typesLabel}`,
          `Áreas: ${needsLabel}`,
          `Tamaño empresa: ${companySize || "-"}`,
          "",
          "CALIFICACIÓN",
          `Presupuesto: ${budgetLabel}`,
          `Plazo: ${timelineLabel}`,
          `Rol: ${roleLabel}`,
          "",
          "CONTACTO",
          `Nombre: ${name}`,
          `Empresa: ${company}`,
          `Email: ${email}`,
          `Teléfono: ${phone || "-"}`,
          "",
          "DETALLE",
          detail || "-",
        ].join("\n");

        await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: `Consultoría IT — ${company}`,
            name: `${name} (${company})`,
            email,
            message: msg,
          }),
        });
      } catch { /* silencioso */ }

      setSubmittedName(name);
      setSubmitted(true);
    } catch {
      setErrors({ submit: "Error al enviar. Intentá de nuevo." });
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* Hero minimal */}
      <section className="relative pt-24 pb-10 lg:pt-32 lg:pb-12 overflow-hidden">
        <div className="absolute inset-0 hero-radial opacity-60" />
        <div className="absolute inset-0 hero-grid opacity-15" />
        <div className="relative container mx-auto px-4 lg:px-8 text-center">
          <motion.span
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="enterprise-badge mb-4 inline-flex"
          >
            Consultoría IT · Sin cargo
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="font-display text-3xl lg:text-5xl font-extrabold tracking-tight text-foreground mb-3"
          >
            Consultoría IT{" "}
            <span className="text-gradient">sin cargo</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-muted-foreground text-sm lg:text-base max-w-md mx-auto"
          >
            ¿Necesita asesoramiento? En menos de 2 minutos evaluamos su infraestructura y detectamos oportunidades de mejora.
          </motion.p>
        </div>
      </section>

      {/* Form */}
      <section className="pb-28 lg:pb-36">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-2xl mx-auto">
            {submitted ? (
              <SuccessScreen name={submittedName} />
            ) : (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <FormCard>
                  {/* Step indicator */}
                  <StepIndicator current={step} total={3} labels={STEP_LABELS} />

                  {/* Steps */}
                  <form onSubmit={handleSubmit}>
                    <div className="relative overflow-hidden">
                      <AnimatePresence mode="wait" custom={dir} initial={false}>

                        {/* ── STEP 1 ── */}
                        {step === 1 && (
                          <motion.div
                            key="step1" custom={dir}
                            variants={slideVariants} initial="enter" animate="center" exit="exit"
                            className="space-y-7"
                          >
                            <FieldGroup label="¿Qué tipo de proyecto necesitás?" hint="Podés seleccionar más de uno.">
                              {errors.type && <p className="text-destructive text-xs">{errors.type}</p>}
                              <div className="grid gap-2.5 sm:grid-cols-2">
                                {PROJECT_TYPES.map(pt => (
                                  <SelectCard
                                    key={pt.id}
                                    selected={projectTypes.includes(pt.id)}
                                    onClick={() => toggleArr(pt.id, projectTypes, setProjectTypes)}
                                    icon={pt.icon}
                                    label={pt.label}
                                    desc={pt.desc}
                                  />
                                ))}
                              </div>
                            </FieldGroup>

                            <FieldGroup label="¿Qué áreas son prioritarias?">
                              <div className="flex flex-wrap gap-2">
                                {NEEDS_AREAS.map(a => (
                                  <Chip key={a.id} selected={needs.includes(a.id)} onClick={() => toggleArr(a.id, needs, setNeeds)}>
                                    <a.icon size={11} className="shrink-0" />
                                    {a.label}
                                  </Chip>
                                ))}
                              </div>
                            </FieldGroup>

                            <FieldGroup label="Tamaño de la empresa">
                              <div className="flex flex-wrap gap-2">
                                {COMPANY_SIZES.map(s => (
                                  <SizeButton key={s.id} selected={companySize === s.id} onClick={() => setCompanySize(s.id)} label={s.label} sub={s.sub} />
                                ))}
                              </div>
                            </FieldGroup>
                          </motion.div>
                        )}

                        {/* ── STEP 2 ── */}
                        {step === 2 && (
                          <motion.div
                            key="step2" custom={dir}
                            variants={slideVariants} initial="enter" animate="center" exit="exit"
                            className="space-y-7"
                          >
                            <FieldGroup label="Presupuesto estimado para el proyecto">
                              <div className="grid gap-2.5 sm:grid-cols-2">
                                {BUDGETS.map(b => (
                                  <SelectCard
                                    key={b.id} compact
                                    selected={budget === b.id}
                                    onClick={() => setBudget(b.id)}
                                    icon={DollarSign}
                                    label={b.label}
                                    desc={b.sub}
                                  />
                                ))}
                              </div>
                            </FieldGroup>

                            <FieldGroup label="¿Cuándo necesitás la solución?">
                              <div className="grid gap-2.5 sm:grid-cols-2">
                                {TIMELINES.map(t => (
                                  <SelectCard
                                    key={t.id} compact
                                    selected={timeline === t.id}
                                    onClick={() => setTimeline(t.id)}
                                    icon={t.icon}
                                    label={t.label}
                                    desc={t.sub}
                                  />
                                ))}
                              </div>
                            </FieldGroup>

                            <FieldGroup label="¿Cuál es tu rol en la empresa?">
                              <div className="grid gap-2.5 sm:grid-cols-2">
                                {ROLES.map(r => (
                                  <SelectCard
                                    key={r.id} compact
                                    selected={role === r.id}
                                    onClick={() => setRole(r.id)}
                                    icon={r.icon}
                                    label={r.label}
                                    desc={r.desc}
                                  />
                                ))}
                              </div>
                            </FieldGroup>
                          </motion.div>
                        )}

                        {/* ── STEP 3 ── */}
                        {step === 3 && (
                          <motion.div
                            key="step3" custom={dir}
                            variants={slideVariants} initial="enter" animate="center" exit="exit"
                            className="space-y-5"
                          >
                            <div className="grid gap-4 sm:grid-cols-2">
                              <FieldGroup>
                                <Input
                                  value={name} onChange={e => setName(e.target.value)}
                                  placeholder="Nombre completo *"
                                  className="input-enterprise"
                                />
                                {errors.name && <p className="text-destructive text-xs mt-1">{errors.name}</p>}
                              </FieldGroup>
                              <FieldGroup>
                                <Input
                                  value={company} onChange={e => setCompany(e.target.value)}
                                  placeholder="Empresa *"
                                  className="input-enterprise"
                                />
                                {errors.company && <p className="text-destructive text-xs mt-1">{errors.company}</p>}
                              </FieldGroup>
                              <FieldGroup>
                                <Input
                                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                                  placeholder="Email corporativo *"
                                  className="input-enterprise"
                                />
                                {errors.email && <p className="text-destructive text-xs mt-1">{errors.email}</p>}
                              </FieldGroup>
                              <Input
                                value={phone} onChange={e => setPhone(e.target.value)}
                                placeholder="Teléfono (opcional)"
                                className="input-enterprise"
                              />
                            </div>

                            <Textarea
                              value={detail} onChange={e => setDetail(e.target.value)}
                              placeholder="¿Cuál es el principal desafío IT que enfrentás hoy? (opcional)"
                              rows={4}
                              className="input-enterprise resize-none"
                            />

                            {errors.submit && <p className="text-destructive text-sm text-center">{errors.submit}</p>}

                            <p className="text-xs text-muted-foreground/60 text-center">
                              * Campos obligatorios. Sus datos no serán compartidos con terceros.
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Navigation */}
                    <div className={`flex items-center mt-8 gap-3 ${step > 1 ? "justify-between" : "justify-end"}`}>
                      {step > 1 && (
                        <Button
                          type="button" variant="ghost" onClick={() => goTo(step - 1)}
                          className="gap-2 text-muted-foreground hover:text-foreground"
                        >
                          <ArrowLeft size={15} /> Anterior
                        </Button>
                      )}

                      {step < 3 ? (
                        <Button type="button" onClick={handleNext} className="bg-gradient-primary font-semibold h-11 px-7 gap-2 ml-auto">
                          Siguiente <ArrowRight size={15} />
                        </Button>
                      ) : (
                        <Button type="submit" disabled={loading} className="bg-gradient-primary font-semibold h-12 px-8 gap-2 w-full sm:w-auto text-sm ml-auto">
                          {loading ? "Enviando..." : "Solicitar evaluación"}
                          {!loading && <Send size={14} />}
                        </Button>
                      )}
                    </div>

                    {step === 3 && (
                      <p className="text-center text-xs text-muted-foreground/50 mt-3">
                        Sin compromiso. Solo soluciones reales.
                      </p>
                    )}
                  </form>
                </FormCard>

                {/* WhatsApp below */}
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                  className="mt-5 text-center"
                >
                  <a
                    href="https://wa.me/5493415104902?text=Hola%2C%20quiero%20solicitar%20una%20evaluaci%C3%B3n%20tecnol%C3%B3gica."
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <MessageSquare size={14} className="text-green-500" />
                    Prefiero hablar por WhatsApp
                    <ArrowRight size={12} />
                  </a>
                </motion.div>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-t border-border/20 bg-surface py-8">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {[
              "Evaluación sin cargo ni compromiso",
              "Respuesta en 24–48 horas hábiles",
              "Propuesta adaptada a su empresa",
              "Consultor dedicado a su caso",
            ].map(item => (
              <span key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 size={12} className="text-primary/60 shrink-0" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
