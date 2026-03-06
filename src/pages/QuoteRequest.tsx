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
    if (!detail || detail.length < 10) newErrors.detail = "Describa su situación actual (mínimo 10 caracteres)";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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
      const workstations = String(form.get("workstations") || "").trim();
      const detail = String(form.get("detail") || "").trim();

      const typeLabel = projectTypes.find((t) => t.id === selectedType)?.label || selectedType || "-";
      const needsLabels = selectedNeeds.length > 0
        ? selectedNeeds.map((id) => needsAreas.find((a) => a.id === id)?.label || id).join(", ")
        : "-";

      // --- INTEGRACIÓN GOOGLE SHEETS CRM ---
      const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbxlRVccJ9cCgbrjWFCu6sWmkG90HCZO1izY0e26dnla9xZMBiT0wpZvmWgt-G_P8svC/exec";
      
      const sheetPayload = {
        name,
        company,
        email,
        phone,
        typeLabel,
        needsLabels,
        companySize: selectedCompanySize || "-",
        workstations,
        urgency: selectedUrgency || "-",
        detail
      };

      // Enviamos a la hoja de cálculo (usamos mode: 'no-cors' para evitar bloqueos)
      fetch(GOOGLE_SHEET_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sheetPayload),
      });
      // -------------------------------------

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
        `Tamaño empresa: ${selectedCompanySize || "-"}`,
        `Puestos de trabajo: ${workstations || "-"}`,
        `Urgencia: ${selectedUrgency || "-"}`,
        "",
        "DETALLE",
        detail,
      ].join("\n");

      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: "Solicitud de evaluación tecnológica",
          name: `${name} (CRM Web)`,
          email,
          message: fullMessage,
        }),
      });

      let json = null;
      try { json = await r.json(); } catch { json = null; }

      if (!r.ok || !json?.ok) {
        throw new Error(json?.error || "Error en el servidor");
      }

      toast({
        title: "✅ Solicitud recibida",
        description: "Los datos se han guardado en el CRM y un consultor lo contactará pronto.",
      });

      (e.target as HTMLFormElement).reset();
      setSelectedType("");
      setSelectedNeeds([]);
      setSelectedCompanySize("");
      setSelectedUrgency("");
      setErrors({});

    } catch (error: any) {
      toast({
        title: "Error al enviar",
        description: error.message || "Reintentá en unos minutos.",
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
                onSubmit={handleSubmit}
                className="space-y-8"
              >
                {/* Paso 1: Tipo de Proyecto */}
                <div className="card-enterprise rounded-xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">1</div>
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
                          selectedType === pt.id ? "border-primary/50 bg-primary/5" : "border-border/40 bg-card hover:border-border/80"
                        }`}
                      >
                        <div className={`icon-container h-10 w-10 shrink-0 ${selectedType === pt.id ? "text-primary" : "text-muted-foreground"}`}>
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

                {/* Paso 2: Áreas de Necesidad */}
                <div className="card-enterprise rounded-xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">2</div>
                    <h3 className="font-display text-lg font-semibold text-foreground">Áreas de Necesidad</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {needsAreas.map((area) => (
                      <label
                        key={area.id}
                        className={`flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer transition-all border text-sm ${
                          selectedNeeds.includes(area.id) ? "border-primary/50 bg-primary/5 text-foreground" : "border-border/40 bg-card text-muted-foreground"
                        }`}
                      >
                        <Checkbox
                          checked={selectedNeeds.includes(area.id)}
                          onCheckedChange={() => toggleNeed(area.id)}
                        />
                        {area.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Paso 3: Datos Empresa */}
                <div className="card-enterprise rounded-xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">3</div>
                    <h3 className="font-display text-lg font-semibold text-foreground">Datos de la Empresa</h3>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Input name="name" required placeholder="Nombre completo" className="input-enterprise" />
                    <Input name="company" required placeholder="Empresa" className="input-enterprise" />
                    <Input name="email" required type="email" placeholder="Email corporativo" className="input-enterprise" />
                    <Input name="phone" placeholder="Teléfono" className="input-enterprise" />
                    
                    <Select value={selectedCompanySize} onValueChange={setSelectedCompanySize}>
                      <SelectTrigger className="input-enterprise">
                        <SelectValue placeholder="Tamaño empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-10">1-10 emp.</SelectItem>
                        <SelectItem value="11-50">11-50 emp.</SelectItem>
                        <SelectItem value="51-200">51-200 emp.</SelectItem>
                        <SelectItem value="201+">Más de 200</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={selectedUrgency} onValueChange={setSelectedUrgency}>
                      <SelectTrigger className="input-enterprise">
                        <SelectValue placeholder="Urgencia" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Inmediata</SelectItem>
                        <SelectItem value="short">Corto plazo</SelectItem>
                        <SelectItem value="medium">Planificación</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Paso 4: Detalle */}
                <div className="card-enterprise rounded-xl p-8">
                  <Textarea
                    name="detail"
                    required
                    placeholder="Describa su situación..."
                    rows={6}
                    className="input-enterprise"
                  />
                  {errors.detail && <p className="text-destructive text-xs mt-1">{errors.detail}</p>}
                </div>

                <Button disabled={loading} type="submit" className="w-full bg-gradient-primary h-12">
                  {loading ? "Enviando..." : "Solicitar Evaluación"} <Send size={16} className="ml-2" />
                </Button>
              </motion.form>
            </div>

            {/* Sidebar Informativo */}
            <div className="space-y-6">
              <div className="card-enterprise rounded-xl p-6 border-l-4 border-primary">
                <Shield className="text-primary mb-3" />
                <h4 className="font-bold mb-2">Compromiso Bartez</h4>
                <p className="text-sm text-muted-foreground">Su información está protegida y será tratada por consultores senior.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default QuoteRequest;
