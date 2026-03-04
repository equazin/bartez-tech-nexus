import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Building2, Server, Wrench, Network, Monitor, CheckCircle2, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";

const projectTypes = [
  { id: "infrastructure", icon: Server, label: "Infraestructura IT", desc: "Servidores, almacenamiento, data center" },
  { id: "networking", icon: Network, label: "Redes y Conectividad", desc: "LAN/WAN, WiFi, VPN, cableado" },
  { id: "equipment", icon: Monitor, label: "Equipamiento Corporativo", desc: "Estaciones de trabajo, notebooks" },
  { id: "partnership", icon: Wrench, label: "Partnership Tecnológico", desc: "Soporte continuo, gestión IT" },
];

const needsAreas = [
  { id: "servers", label: "Servidores e Infraestructura" },
  { id: "networking", label: "Redes y Conectividad" },
  { id: "workstations", label: "Equipos de Escritorio" },
  { id: "notebooks", label: "Notebooks Corporativas" },
  { id: "security", label: "Seguridad Informática" },
  { id: "cloud", label: "Migración a la Nube" },
  { id: "support", label: "Soporte IT Continuo" },
  { id: "consulting", label: "Consultoría Tecnológica" },
];

const trustPoints = [
  "Evaluación sin cargo ni compromiso",
  "Respuesta en 24-48 horas hábiles",
  "Propuesta adaptada a su realidad",
  "Consultor dedicado a su caso",
];

const QuoteRequest = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState(searchParams.get("tipo") || "");
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>(() => {
    const need = searchParams.get("necesidad");
    return need ? [need] : [];
  });

  // ✅ FIX: los Select de shadcn no entran en FormData con name=""
  const [selectedCompanySize, setSelectedCompanySize] = useState("");
  const [selectedUrgency, setSelectedUrgency] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleNeed = (id: string) => {
    setSelectedNeeds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const validate = (form: FormData): boolean => {
    const newErrors: Record<string, string> = {};
    const name = (form.get("name") as string)?.trim();
    const company = (form.get("company") as string)?.trim();
    const email = (form.get("email") as string)?.trim();
    const detail = (form.get("detail") as string)?.trim();

    if (!name || name.length < 2) newErrors.name = "Ingrese su nombre completo";
    if (!company || company.length < 2) newErrors.company = "Ingrese el nombre de su empresa";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Ingrese un email válido";
    if (!selectedType) newErrors.type = "Seleccione un tipo de proyecto";
    if (!detail || detail.length < 10) newErrors.detail = "Describa su situación actual y necesidades (mínimo 10 caracteres)";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ✅ FIX: ahora manda mail real usando /api/contact (igual que Contact)
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    if (!validate(form)) return;

    setLoading(true);

    try {
      const name = String(form.get("name") || "").trim();
      const company = String(form.get("company") || "").trim();
      const email = String(form.get("email") || "").trim();
      const phone = String(form.get("phone") || "").trim();
      const role = String(form.get("role") || "").trim();
      const workstations = String(form.get("workstations") || "").trim();
      const detail = String(form.get("detail") || "").trim();

      const typeLabel = projectTypes.find((t) => t.id === selectedType)?.label || selectedType || "-";
      const needsLabels =
        selectedNeeds.length > 0
          ? selectedNeeds.map((id) => needsAreas.find((a) => a.id === id)?.label || id).join(", ")
          : "-";

      const companySize = selectedCompanySize || "-";
      const urgency = selectedUrgency || "-";

      const fullMessage = [
        "SOLICITUD DE EVALUACIÓN TECNOLÓGICA",
        "",
        `Tipo de proyecto: ${typeLabel}`,
        `Áreas de necesidad: ${needsLabels}`,
        "",
        "DATOS DE CONTACTO",
        `Nombre: ${name}`,
        `Empresa: ${company}`,
        `Email: ${email}`,
        `Teléfono: ${phone || "-"}`,
        `Cargo/Rol: ${role || "-"}`,
        `Tamaño empresa: ${companySize}`,
        `Puestos de trabajo: ${workstations || "-"}`,
        `Urgencia: ${urgency}`,
        "",
        "DETALLE",
        detail,
      ].join("\n");

      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
body: JSON.stringify({
  subject: "Solicitud de evaluación tecnológica",
  name: `${name} (Evaluación)`,
  email,
  message: fullMessage,
}),
      });

      let json: any = null;
      try {
        json = await r.json();
      } catch {
        json = null;
      }

      if (!r.ok || !json?.ok) {
        toast({
          title: "No se pudo enviar",
          description: json?.error || `Error ${r.status}. Reintentá en unos minutos.`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "✅ Solicitud recibida",
        description:
          "Nuestro equipo se pondrá en contacto en las próximas 24-48 horas hábiles para coordinar la evaluación.",
      });

      (e.target as HTMLFormElement).reset();
      setSelectedType("");
      setSelectedNeeds([]);
      setSelectedCompanySize("");
      setSelectedUrgency("");
      setErrors({});
    } catch {
      toast({
        title: "Error de conexión",
        description: "No se pudo enviar la solicitud. Reintentá en unos minutos.",
        variant: "destructive",
      });
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
            <div className="lg:col-span-2">
              <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                onSubmit={handleSubmit}
                className="space-y-8"
              >
                {/* Step 1: Project Type */}
                <div className="card-enterprise rounded-xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                      1
                    </div>
                    <h3 className="font-display text-lg font-semibold text-foreground">Tipo de Proyecto</h3>
                  </div>
                  {errors.type && <p className="text-destructive text-sm mb-3">{errors.type}</p>}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {projectTypes.map((pt) => (
                      <button
                        key={pt.id}
                        type="button"
                        onClick={() => setSelectedType(pt.id)}
                        className={`flex items-start gap-4 rounded-xl p-5 text-left transition-all border ${
                          selectedType === pt.id
                            ? "border-primary/50 bg-primary/5"
                            : "border-border/40 bg-card hover:border-border/80"
                        }`}
                      >
                        <div
                          className={`icon-container h-10 w-10 shrink-0 ${
                            selectedType === pt.id ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          <pt.icon size={18} />
                        </div>
                        <div>
                          <span className="font-display text-sm font-semibold text-foreground block">{pt.label}</span>
                          <span className="text-xs text-muted-foreground mt-0.5 block">{pt.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Areas of Need */}
                <div className="card-enterprise rounded-xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                      2
                    </div>
                    <h3 className="font-display text-lg font-semibold text-foreground">Áreas de Necesidad</h3>
                    <span className="text-xs text-muted-foreground">(opcional, múltiple)</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {needsAreas.map((area) => (
                      <label
                        key={area.id}
                        className={`flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer transition-all border text-sm ${
                          selectedNeeds.includes(area.id)
                            ? "border-primary/50 bg-primary/5 text-foreground"
                            : "border-border/40 bg-card text-muted-foreground hover:border-border/80"
                        }`}
                      >
                        <Checkbox
                          checked={selectedNeeds.includes(area.id)}
                          onCheckedChange={() => toggleNeed(area.id)}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        {area.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Step 3: Company & Contact */}
                <div className="card-enterprise rounded-xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                      3
                    </div>
                    <h3 className="font-display text-lg font-semibold text-foreground">Datos de la Empresa</h3>
                  </div>
                  <div className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Nombre completo *</label>
                        <Input name="name" required placeholder="Su nombre" className="input-enterprise" maxLength={100} />
                        {errors.name && <p className="text-destructive text-xs mt-1">{errors.name}</p>}
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Empresa *</label>
                        <Input
                          name="company"
                          required
                          placeholder="Nombre de la empresa"
                          className="input-enterprise"
                          maxLength={100}
                        />
                        {errors.company && <p className="text-destructive text-xs mt-1">{errors.company}</p>}
                      </div>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Email corporativo *</label>
                        <Input
                          name="email"
                          required
                          type="email"
                          placeholder="correo@empresa.com"
                          className="input-enterprise"
                          maxLength={255}
                        />
                        {errors.email && <p className="text-destructive text-xs mt-1">{errors.email}</p>}
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Teléfono</label>
                        <Input name="phone" placeholder="+54 11 1234-5678" className="input-enterprise" maxLength={30} />
                      </div>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Cargo / Rol</label>
                        <Input
                          name="role"
                          placeholder="Ej: Gerente de IT, Director de Operaciones"
                          className="input-enterprise"
                          maxLength={80}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Tamaño de la empresa</label>

                        {/* ✅ FIX: Select controlado por estado */}
                        <Select value={selectedCompanySize} onValueChange={setSelectedCompanySize}>
                          <SelectTrigger className="input-enterprise">
                            <SelectValue placeholder="Cantidad de empleados" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1-10">1 a 10 empleados</SelectItem>
                            <SelectItem value="11-50">11 a 50 empleados</SelectItem>
                            <SelectItem value="51-200">51 a 200 empleados</SelectItem>
                            <SelectItem value="201-500">201 a 500 empleados</SelectItem>
                            <SelectItem value="500+">Más de 500 empleados</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Cantidad de puestos de trabajo</label>
                        <Input
                          name="workstations"
                          type="number"
                          placeholder="Ej: 25"
                          className="input-enterprise"
                          min={1}
                          max={99999}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Urgencia</label>

                        {/* ✅ FIX: Select controlado por estado */}
                        <Select value={selectedUrgency} onValueChange={setSelectedUrgency}>
                          <SelectTrigger className="input-enterprise">
                            <SelectValue placeholder="Plazo del proyecto" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="immediate">Urgente (1-2 semanas)</SelectItem>
                            <SelectItem value="short">Corto plazo (1 mes)</SelectItem>
                            <SelectItem value="medium">Mediano plazo (1-3 meses)</SelectItem>
                            <SelectItem value="planning">En planificación</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 4: Details */}
                <div className="card-enterprise rounded-xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                      4
                    </div>
                    <h3 className="font-display text-lg font-semibold text-foreground">Descripción de la Situación</h3>
                  </div>
                  <Textarea
                    name="detail"
                    required
                    placeholder="Describa la situación tecnológica actual de su empresa, los desafíos que enfrenta y los objetivos que busca alcanzar. Cuanta más información nos brinde, más precisa será nuestra propuesta..."
                    rows={7}
                    className="input-enterprise resize-none"
                    maxLength={2000}
                  />
                  {errors.detail && <p className="text-destructive text-xs mt-1">{errors.detail}</p>}
                  <p className="text-xs text-muted-foreground mt-2">Máximo 2000 caracteres.</p>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 glow-sm h-13 px-8 text-base"
                >
                  {loading ? "Enviando solicitud..." : "Solicitar Evaluación Tecnológica"}{" "}
                  <Send size={16} className="ml-2" />
                </Button>
              </motion.form>
            </div>

            {/* Sidebar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="space-y-5"
            >
              <div className="card-enterprise rounded-xl p-7">
                <div className="icon-container h-12 w-12 text-primary mb-5">
                  <Shield size={22} />
                </div>
                <h4 className="font-display text-base font-semibold text-foreground mb-4">Compromiso Bartez</h4>
                <ul className="space-y-3">
                  {trustPoints.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm text-secondary-foreground">
                      <CheckCircle2 size={15} className="text-primary mt-0.5 shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card-enterprise rounded-xl p-7">
                <div className="icon-container h-12 w-12 text-primary mb-5">
                  <Clock size={22} />
                </div>
                <h4 className="font-display text-base font-semibold text-foreground mb-4">¿Cómo funciona?</h4>
                <ol className="space-y-4">
                  {[
                    "Complete este formulario con su situación actual",
                    "Un consultor revisará su caso en 24-48hs",
                    "Coordinamos una reunión de diagnóstico",
                    "Presentamos un plan de acción con propuesta",
                    "Implementación y soporte continuo",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {i + 1}
                      </div>
                      <span className="text-sm text-muted-foreground leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="card-enterprise rounded-xl p-7">
                <h4 className="font-display text-base font-semibold text-foreground mb-2">¿Prefiere hablar directamente?</h4>
                <p className="text-sm text-muted-foreground mb-4">Nuestro equipo está disponible para atenderlo.</p>
                <div className="space-y-2 text-sm">
                  <a
                    href="https://wa.me/5493415104902"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    📞 +54 9 341 510-4902
                  </a>
                  <a href="mailto:contacto@bartez.com.ar" className="flex items-center gap-2 text-primary hover:underline">
                    ✉️ contacto@bartez.com.ar
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default QuoteRequest;