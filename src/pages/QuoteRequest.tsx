import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Server, Wrench, Network, Monitor, CheckCircle2, Shield, Clock, ArrowRight, MessageSquare, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";

const projectTypes = [
  { id: "infrastructure", icon: Server,  label: "Infraestructura IT",       desc: "Servidores, almacenamiento, data center" },
  { id: "networking",     icon: Network, label: "Redes y Conectividad",      desc: "LAN/WAN, WiFi, VPN, cableado" },
  { id: "equipment",      icon: Monitor, label: "Equipamiento Corporativo",  desc: "Estaciones de trabajo, notebooks" },
  { id: "partnership",    icon: Wrench,  label: "Partnership Tecnológico",   desc: "Soporte continuo, gestión IT" },
];

const needsAreas = [
  { id: "servers",      label: "Servidores e Infraestructura" },
  { id: "networking",   label: "Redes y Conectividad" },
  { id: "workstations", label: "Equipos de Escritorio" },
  { id: "notebooks",    label: "Notebooks Corporativas" },
  { id: "security",     label: "Seguridad Informática" },
  { id: "cloud",        label: "Migración a la Nube" },
  { id: "support",      label: "Soporte IT Continuo" },
  { id: "consulting",   label: "Consultoría Tecnológica" },
];

const companySizes = [
  { id: "1-10",   label: "1–10",    sub: "empleados" },
  { id: "11-50",  label: "11–50",   sub: "empleados" },
  { id: "51-200", label: "51–200",  sub: "empleados" },
  { id: "201+",   label: "200+",    sub: "empleados" },
];

const urgencies = [
  { id: "immediate", label: "Inmediata",       sub: "Necesito solución ya" },
  { id: "short",     label: "Este trimestre",  sub: "En los próximos 3 meses" },
  { id: "medium",    label: "Planificando",    sub: "Evaluando para el año" },
];

const budgets = [
  { id: "small",   label: "Hasta $500k ARS" },
  { id: "medium",  label: "$500k – $2M ARS" },
  { id: "large",   label: "$2M – $10M ARS" },
  { id: "xlarge",  label: "Más de $10M ARS" },
];

const itSupports = [
  { id: "none",         label: "No tenemos IT" },
  { id: "internal",     label: "IT interno" },
  { id: "outsourced",   label: "Tercerizado" },
  { id: "partial",      label: "Mixto" },
];

const trustPoints = [
  "Evaluación sin cargo ni compromiso",
  "Respuesta en 24-48 horas hábiles",
  "Propuesta adaptada a su realidad",
  "Consultor dedicado a su caso",
];

const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbxlRVccJ9cCgbrjWFCu6sWmkG90HCZO1izY0e26dnla9xZMBiT0wpZvmWgt-G_P8svC/exec";

// ── Chip button ─────────────────────────────────────────────────────────────
function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-all border cursor-pointer ${
        selected
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border/40 bg-card text-muted-foreground hover:border-border/80 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// ── Step card ────────────────────────────────────────────────────────────────
function StepCard({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="card-enterprise rounded-xl p-7">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground shrink-0">{number}</div>
        <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Success screen ────────────────────────────────────────────────────────────
function SuccessScreen({ name }: { name: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card-enterprise rounded-2xl p-10 text-center"
    >
      <div className="flex justify-center mb-5">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-primary" />
        </div>
      </div>
      <h2 className="font-display text-2xl font-bold text-foreground mb-2">¡Solicitud recibida, {name.split(" ")[0]}!</h2>
      <p className="text-muted-foreground text-sm max-w-md mx-auto mb-8 leading-relaxed">
        Un consultor revisará su solicitud y lo contactará en las próximas <strong className="text-foreground">24–48 horas hábiles</strong> para coordinar la evaluación sin cargo.
      </p>
      <ol className="text-left space-y-3 max-w-sm mx-auto mb-8">
        {[
          "Analizamos su sector y situación actual",
          "Lo contactamos para una reunión sin cargo",
          "Presentamos una propuesta adaptada a su empresa",
        ].map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
            <span className="font-display font-extrabold text-border/60 shrink-0 text-lg leading-tight">0{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap justify-center gap-3">
        <a
          href="https://wa.me/5493415104902?text=Hola%2C%20acabo%20de%20enviar%20una%20solicitud%20de%20evaluaci%C3%B3n%20tecnol%C3%B3gica."
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button className="bg-green-600 hover:bg-green-700 text-white h-10 px-5 text-sm">
            <MessageSquare size={14} className="mr-2" /> Confirmar por WhatsApp
          </Button>
        </a>
        <Link to="/">
          <Button variant="outline" className="border-border/60 h-10 px-5 text-sm">
            Volver al inicio <ArrowRight size={13} className="ml-2" />
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
const QuoteRequest = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedName, setSubmittedName] = useState("");

  const [selectedTypes, setSelectedTypes]     = useState<string[]>(() => { const t = searchParams.get("tipo"); return t ? [t] : []; });
  const [selectedNeeds, setSelectedNeeds]     = useState<string[]>(() => { const n = searchParams.get("necesidad"); return n ? [n] : []; });
  const [selectedSize, setSelectedSize]       = useState("");
  const [selectedUrgency, setSelectedUrgency] = useState("");
  const [selectedBudget, setSelectedBudget]   = useState("");
  const [selectedIT, setSelectedIT]           = useState("");
  const [mainProblem, setMainProblem]         = useState("");
  const [errors, setErrors]                   = useState<Record<string, string>>({});

  const toggleType = (id: string) =>
    setSelectedTypes(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleNeed = (id: string) =>
    setSelectedNeeds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const validate = (form: FormData): boolean => {
    const errs: Record<string, string> = {};
    const name  = (form.get("name")  as string)?.trim();
    const email = (form.get("email") as string)?.trim();
    const company = (form.get("company") as string)?.trim();
    if (!name    || name.length < 2)               errs.name    = "Ingrese su nombre completo";
    if (!company || company.length < 2)            errs.company = "Ingrese el nombre de su empresa";
    if (!email   || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Ingrese un email válido";
    if (selectedTypes.length === 0)                errs.types   = "Seleccione al menos un tipo de proyecto";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!validate(form)) return;
    setLoading(true);

    const name     = String(form.get("name")    || "").trim();
    const company  = String(form.get("company") || "").trim();
    const email    = String(form.get("email")   || "").trim();
    const phone    = String(form.get("phone")   || "").trim();

    const typesLabel  = selectedTypes.map(id => projectTypes.find(t => t.id === id)?.label || id).join(", ") || "-";
    const needsLabel  = selectedNeeds.map(id => needsAreas.find(a => a.id === id)?.label   || id).join(", ") || "-";

    try {
      fetch(GOOGLE_SHEET_URL, {
        method: "POST", mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, company, email, phone, typeLabel: typesLabel, needsLabels: needsLabel, companySize: selectedSize || "-", urgency: selectedUrgency || "-", budget: selectedBudget || "-", itSupport: selectedIT || "-", detail: mainProblem || "-" }),
      });

      try {
        const fullMessage = [
          "SOLICITUD DE EVALUACIÓN TECNOLÓGICA",
          "",
          `Tipo de proyecto: ${typesLabel}`,
          `Áreas de necesidad: ${needsLabel}`,
          `Tamaño empresa: ${selectedSize || "-"}`,
          `IT actual: ${selectedIT || "-"}`,
          `Presupuesto: ${selectedBudget || "-"}`,
          `Urgencia: ${selectedUrgency || "-"}`,
          "",
          "DATOS DE CONTACTO",
          `Nombre: ${name}`,
          `Empresa: ${company}`,
          `Email: ${email}`,
          `Teléfono: ${phone || "-"}`,
          "",
          "PROBLEMA PRINCIPAL",
          mainProblem || "-",
        ].join("\n");

        await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject: `Evaluación tecnológica — ${company}`, name: `${name} (${company})`, email, message: fullMessage }),
        });
      } catch { /* silencioso — lead ya guardado en Google Sheets */ }

      setSubmittedName(name);
      setSubmitted(true);
    } catch (err: unknown) {
      toast({ title: "Error al enviar", description: err instanceof Error ? err.message : "Reintentá en unos minutos.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <section className="page-hero">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Evaluación Tecnológica"
            title="Solicite una evaluación"
            highlight="sin cargo"
            description="Diagnosticamos su infraestructura actual e identificamos oportunidades para optimizar la tecnología de su empresa."
            large
          />
        </div>
      </section>

      <section className="pb-24 lg:pb-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">

            {/* Form / Success */}
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">
                {submitted ? (
                  <SuccessScreen key="success" name={submittedName} />
                ) : (
                  <motion.form
                    key="form"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    onSubmit={handleSubmit}
                    className="space-y-6"
                  >
                    {/* Paso 1 — Tipo de Proyecto (selección múltiple) */}
                    <StepCard number="1" title="Tipo de Proyecto">
                      {errors.types && <p className="text-destructive text-xs mb-3">{errors.types}</p>}
                      <div className="grid gap-3 sm:grid-cols-2">
                        {projectTypes.map((pt) => (
                          <button
                            key={pt.id}
                            type="button"
                            onClick={() => toggleType(pt.id)}
                            className={`flex items-start gap-4 rounded-xl p-5 text-left transition-all border ${
                              selectedTypes.includes(pt.id)
                                ? "border-primary/60 bg-primary/8"
                                : "border-border/40 bg-card hover:border-border/80"
                            }`}
                          >
                            <div className={`icon-container h-10 w-10 shrink-0 ${selectedTypes.includes(pt.id) ? "text-primary" : "text-muted-foreground"}`}>
                              <pt.icon size={18} />
                            </div>
                            <div>
                              <span className="font-display text-sm font-semibold text-foreground block">{pt.label}</span>
                              <span className="text-xs text-muted-foreground mt-0.5 block">{pt.desc}</span>
                            </div>
                            {selectedTypes.includes(pt.id) && (
                              <CheckCircle2 size={14} className="text-primary ml-auto shrink-0 mt-0.5" />
                            )}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">Podés seleccionar más de uno.</p>
                    </StepCard>

                    {/* Paso 2 — Áreas de Necesidad */}
                    <StepCard number="2" title="Áreas de Necesidad">
                      <div className="flex flex-wrap gap-2">
                        {needsAreas.map((area) => (
                          <Chip key={area.id} selected={selectedNeeds.includes(area.id)} onClick={() => toggleNeed(area.id)}>
                            {selectedNeeds.includes(area.id) && <CheckCircle2 size={12} className="mr-1.5 shrink-0" />}
                            {area.label}
                          </Chip>
                        ))}
                      </div>
                    </StepCard>

                    {/* Paso 3 — Situación Actual */}
                    <StepCard number="3" title="Situación Actual">
                      <div className="space-y-5">
                        {/* Tamaño empresa */}
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">¿Cuántos empleados tiene la empresa?</p>
                          <div className="flex flex-wrap gap-2">
                            {companySizes.map(s => (
                              <button
                                key={s.id} type="button"
                                onClick={() => setSelectedSize(s.id)}
                                className={`flex flex-col items-center rounded-lg px-5 py-3 border transition-all text-sm font-medium ${
                                  selectedSize === s.id ? "border-primary/60 bg-primary/10 text-primary" : "border-border/40 bg-card text-muted-foreground hover:border-border/80"
                                }`}
                              >
                                <span className="font-bold text-base">{s.label}</span>
                                <span className="text-[10px] mt-0.5 opacity-70">{s.sub}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* IT actual */}
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">¿Tienen soporte IT actualmente?</p>
                          <div className="flex flex-wrap gap-2">
                            {itSupports.map(s => (
                              <Chip key={s.id} selected={selectedIT === s.id} onClick={() => setSelectedIT(s.id)}>
                                {s.label}
                              </Chip>
                            ))}
                          </div>
                        </div>

                        {/* Presupuesto */}
                        <div>
                          <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
                            <DollarSign size={13} className="text-primary" /> Presupuesto estimado anual en IT
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {budgets.map(b => (
                              <Chip key={b.id} selected={selectedBudget === b.id} onClick={() => setSelectedBudget(b.id)}>
                                {b.label}
                              </Chip>
                            ))}
                          </div>
                        </div>

                        {/* Urgencia */}
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">¿Con qué urgencia necesita la solución?</p>
                          <div className="flex flex-wrap gap-2">
                            {urgencies.map(u => (
                              <button
                                key={u.id} type="button"
                                onClick={() => setSelectedUrgency(u.id)}
                                className={`flex flex-col rounded-lg px-4 py-2.5 border transition-all text-sm ${
                                  selectedUrgency === u.id ? "border-primary/60 bg-primary/10 text-primary" : "border-border/40 bg-card text-muted-foreground hover:border-border/80"
                                }`}
                              >
                                <span className="font-medium">{u.label}</span>
                                <span className="text-[10px] mt-0.5 opacity-70">{u.sub}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Problema principal */}
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">¿Cuál es el problema principal en una línea?</p>
                          <Input
                            value={mainProblem}
                            onChange={e => setMainProblem(e.target.value)}
                            placeholder="Ej: Nos quedamos sin soporte técnico y los equipos están desactualizados"
                            className="input-enterprise"
                          />
                        </div>
                      </div>
                    </StepCard>

                    {/* Paso 4 — Datos de Contacto */}
                    <StepCard number="4" title="Datos de Contacto">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Input name="name" required placeholder="Nombre completo *" className="input-enterprise" />
                          {errors.name && <p className="text-destructive text-xs mt-1">{errors.name}</p>}
                        </div>
                        <div>
                          <Input name="company" required placeholder="Empresa *" className="input-enterprise" />
                          {errors.company && <p className="text-destructive text-xs mt-1">{errors.company}</p>}
                        </div>
                        <div>
                          <Input name="email" required type="email" placeholder="Email corporativo *" className="input-enterprise" />
                          {errors.email && <p className="text-destructive text-xs mt-1">{errors.email}</p>}
                        </div>
                        <Input name="phone" placeholder="Teléfono (opcional)" className="input-enterprise" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">* Campos obligatorios. Sus datos no serán compartidos con terceros.</p>
                    </StepCard>

                    <Button disabled={loading} type="submit" className="w-full bg-gradient-primary h-13 text-sm font-semibold">
                      {loading ? "Enviando solicitud..." : "Solicitar — te contactamos en 24hs"}
                      {!loading && <Send size={14} className="ml-2" />}
                    </Button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>

            {/* Sidebar */}
            <div className="space-y-5 lg:sticky lg:top-32 self-start">
              <div className="card-enterprise rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Shield size={15} className="text-primary" />
                  <h4 className="font-semibold text-foreground text-sm">Compromiso Bartez</h4>
                </div>
                <ul className="space-y-3">
                  {trustPoints.map(point => (
                    <li key={point} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <CheckCircle2 size={13} className="text-primary shrink-0 mt-0.5" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card-enterprise rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={15} className="text-primary" />
                  <h4 className="font-semibold text-foreground text-sm">¿Qué pasa después?</h4>
                </div>
                <ol className="space-y-4">
                  {[
                    "Un consultor revisa su solicitud y analiza su sector.",
                    "Lo contactamos en 24-48 horas hábiles para una reunión sin cargo.",
                    "Presentamos una propuesta adaptada a su empresa.",
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="font-display text-xl font-extrabold text-border/60 shrink-0 leading-none">0{i + 1}</span>
                      <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <a
                href="https://wa.me/5493415104902?text=Hola%2C%20quiero%20solicitar%20una%20evaluaci%C3%B3n%20tecnol%C3%B3gica."
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 card-enterprise rounded-xl p-5 hover:border-primary/40 transition-colors group"
              >
                <div className="h-9 w-9 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                  <MessageSquare size={14} className="text-green-500" />
                </div>
                <div>
                  <span className="block text-sm font-semibold text-foreground group-hover:text-primary transition-colors">¿Prefiere hablar directamente?</span>
                  <span className="text-xs text-muted-foreground">Escríbanos por WhatsApp</span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default QuoteRequest;
