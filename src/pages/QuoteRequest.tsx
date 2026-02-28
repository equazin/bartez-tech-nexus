import { useState } from "react";
import { motion } from "framer-motion";
import { Send, FileText, Building2, ShoppingCart, Server, Wrench, CheckCircle2, Shield, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";

const quoteTypes = [
  { id: "products", icon: ShoppingCart, label: "Compra de Productos", desc: "Hardware, periféricos, componentes" },
  { id: "bulk", icon: Building2, label: "Compra por Volumen", desc: "Precios corporativos para +10 unidades" },
  { id: "infrastructure", icon: Server, label: "Proyecto de Infraestructura", desc: "Redes, servidores, data center" },
  { id: "services", icon: Wrench, label: "Servicios IT", desc: "Soporte, consultoría, mantenimiento" },
];

const productCategories = [
  { id: "desktop", label: "Desktop PCs" },
  { id: "notebooks", label: "Notebooks" },
  { id: "gaming", label: "Gaming PCs" },
  { id: "networking", label: "Networking" },
  { id: "servers", label: "Servidores & Infraestructura" },
  { id: "peripherals", label: "Periféricos" },
  { id: "components", label: "Componentes" },
  { id: "software", label: "Software & Licencias" },
];

const trustPoints = [
  "Respuesta en 24-48 horas hábiles",
  "Cotización sin compromiso",
  "Precios corporativos especiales",
  "Ejecutivo de cuenta dedicado",
];

const QuoteRequest = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState(searchParams.get("tipo") || "");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const cat = searchParams.get("categoria");
    return cat ? [cat] : [];
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const validate = (form: FormData): boolean => {
    const newErrors: Record<string, string> = {};
    const name = (form.get("name") as string)?.trim();
    const company = (form.get("company") as string)?.trim();
    const email = (form.get("email") as string)?.trim();
    const detail = (form.get("detail") as string)?.trim();

    if (!name || name.length < 2) newErrors.name = "Ingrese su nombre completo";
    if (name && name.length > 100) newErrors.name = "Máximo 100 caracteres";
    if (!company || company.length < 2) newErrors.company = "Ingrese el nombre de su empresa";
    if (company && company.length > 100) newErrors.company = "Máximo 100 caracteres";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Ingrese un email válido";
    if (email && email.length > 255) newErrors.email = "Máximo 255 caracteres";
    if (!selectedType) newErrors.type = "Seleccione un tipo de cotización";
    if (!detail || detail.length < 10) newErrors.detail = "Describa su requerimiento (mínimo 10 caracteres)";
    if (detail && detail.length > 2000) newErrors.detail = "Máximo 2000 caracteres";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!validate(form)) return;

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({
        title: "✅ Cotización solicitada con éxito",
        description: "Nuestro equipo comercial le enviará una propuesta personalizada en las próximas 24-48 horas hábiles.",
      });
      (e.target as HTMLFormElement).reset();
      setSelectedType("");
      setSelectedCategories([]);
      setErrors({});
    }, 1200);
  };

  return (
    <Layout>
      <section className="relative py-20 lg:py-28">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Cotización Corporativa"
            title="Solicite su"
            highlight="cotización personalizada"
            description="Complete el formulario y nuestro equipo comercial le enviará una propuesta adaptada a las necesidades de su empresa."
            large
          />
        </div>
      </section>

      <section className="pb-24 lg:pb-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Main form */}
            <div className="lg:col-span-2">
              <motion.form
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                onSubmit={handleSubmit}
                className="space-y-8"
              >
                {/* Step 1: Quote Type */}
                <div className="card-enterprise rounded-xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">1</div>
                    <h3 className="font-display text-lg font-semibold text-foreground">Tipo de Cotización</h3>
                  </div>
                  {errors.type && <p className="text-destructive text-sm mb-3">{errors.type}</p>}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {quoteTypes.map((qt) => (
                      <button
                        key={qt.id}
                        type="button"
                        onClick={() => setSelectedType(qt.id)}
                        className={`flex items-start gap-4 rounded-xl p-5 text-left transition-all border ${
                          selectedType === qt.id
                            ? "border-primary/50 bg-primary/5"
                            : "border-border/40 bg-card hover:border-border/80"
                        }`}
                      >
                        <div className={`icon-container h-10 w-10 shrink-0 ${selectedType === qt.id ? "text-primary" : "text-muted-foreground"}`}>
                          <qt.icon size={18} />
                        </div>
                        <div>
                          <span className="font-display text-sm font-semibold text-foreground block">{qt.label}</span>
                          <span className="text-xs text-muted-foreground mt-0.5 block">{qt.desc}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Categories */}
                <div className="card-enterprise rounded-xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">2</div>
                    <h3 className="font-display text-lg font-semibold text-foreground">Categorías de Interés</h3>
                    <span className="text-xs text-muted-foreground">(opcional, múltiple)</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {productCategories.map((cat) => (
                      <label
                        key={cat.id}
                        className={`flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer transition-all border text-sm ${
                          selectedCategories.includes(cat.id)
                            ? "border-primary/50 bg-primary/5 text-foreground"
                            : "border-border/40 bg-card text-muted-foreground hover:border-border/80"
                        }`}
                      >
                        <Checkbox
                          checked={selectedCategories.includes(cat.id)}
                          onCheckedChange={() => toggleCategory(cat.id)}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                        {cat.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Step 3: Contact info */}
                <div className="card-enterprise rounded-xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">3</div>
                    <h3 className="font-display text-lg font-semibold text-foreground">Datos de Contacto</h3>
                  </div>
                  <div className="space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Nombre completo *</label>
                        <Input name="name" required placeholder="Juan Pérez" className="input-enterprise" maxLength={100} />
                        {errors.name && <p className="text-destructive text-xs mt-1">{errors.name}</p>}
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Empresa *</label>
                        <Input name="company" required placeholder="Nombre de la empresa" className="input-enterprise" maxLength={100} />
                        {errors.company && <p className="text-destructive text-xs mt-1">{errors.company}</p>}
                      </div>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Email corporativo *</label>
                        <Input name="email" required type="email" placeholder="correo@empresa.com" className="input-enterprise" maxLength={255} />
                        {errors.email && <p className="text-destructive text-xs mt-1">{errors.email}</p>}
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Teléfono</label>
                        <Input name="phone" placeholder="+54 11 1234-5678" className="input-enterprise" maxLength={30} />
                      </div>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Cargo / Puesto</label>
                        <Input name="role" placeholder="Ej: Gerente de IT" className="input-enterprise" maxLength={80} />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Cantidad estimada</label>
                        <Input name="quantity" type="number" placeholder="Ej: 10" className="input-enterprise" min={1} max={99999} />
                      </div>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Presupuesto estimado</label>
                        <Select name="budget">
                          <SelectTrigger className="input-enterprise">
                            <SelectValue placeholder="Seleccione un rango" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Menos de USD 5.000</SelectItem>
                            <SelectItem value="mid">USD 5.000 - 25.000</SelectItem>
                            <SelectItem value="high">USD 25.000 - 100.000</SelectItem>
                            <SelectItem value="enterprise">Más de USD 100.000</SelectItem>
                            <SelectItem value="undefined">A definir</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-foreground">Urgencia</label>
                        <Select name="urgency">
                          <SelectTrigger className="input-enterprise">
                            <SelectValue placeholder="Plazo de implementación" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="immediate">Inmediato (1-2 semanas)</SelectItem>
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
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">4</div>
                    <h3 className="font-display text-lg font-semibold text-foreground">Detalle del Requerimiento</h3>
                  </div>
                  <Textarea
                    name="detail"
                    required
                    placeholder="Describa los productos o servicios que necesita cotizar. Incluya especificaciones técnicas, cantidades por modelo, requisitos de instalación, plazos de entrega u otra información relevante..."
                    rows={7}
                    className="input-enterprise resize-none"
                    maxLength={2000}
                  />
                  {errors.detail && <p className="text-destructive text-xs mt-1">{errors.detail}</p>}
                  <p className="text-xs text-muted-foreground mt-2">Máximo 2000 caracteres. Sea lo más específico posible para recibir una cotización precisa.</p>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 glow-sm h-13 px-8 text-base"
                >
                  {loading ? "Enviando solicitud..." : "Enviar Solicitud de Cotización"} <Send size={16} className="ml-2" />
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
              {/* Trust card */}
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

              {/* Process card */}
              <div className="card-enterprise rounded-xl p-7">
                <div className="icon-container h-12 w-12 text-primary mb-5">
                  <Clock size={22} />
                </div>
                <h4 className="font-display text-base font-semibold text-foreground mb-4">¿Cómo funciona?</h4>
                <ol className="space-y-4">
                  {[
                    "Complete este formulario con su requerimiento",
                    "Un ejecutivo comercial revisará su solicitud",
                    "Recibirá una propuesta detallada en 24-48hs",
                    "Ajustamos la propuesta según su feedback",
                    "Confirmación y entrega programada",
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

              {/* Contact shortcut */}
              <div className="card-enterprise rounded-xl p-7">
                <h4 className="font-display text-base font-semibold text-foreground mb-2">¿Prefiere hablar directamente?</h4>
                <p className="text-sm text-muted-foreground mb-4">Nuestro equipo comercial está disponible para atenderlo.</p>
                <div className="space-y-2 text-sm">
                  <a href="tel:+541112345678" className="flex items-center gap-2 text-primary hover:underline">
                    📞 +54 11 1234-5678
                  </a>
                  <a href="mailto:ventas@barteztecnologia.com" className="flex items-center gap-2 text-primary hover:underline">
                    ✉️ ventas@barteztecnologia.com
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
