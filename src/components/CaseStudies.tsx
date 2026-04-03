import { motion } from "framer-motion";
import { Building2, TrendingUp, Clock, Users } from "lucide-react";
import SectionHeading from "@/components/SectionHeading";

const cases = [
  {
    company: "Constructora Regional",
    industry: "Construcción",
    size: "120 empleados",
    icon: Building2,
    challenge: "Infraestructura desactualizada con servidores físicos sin backup y soporte reactivo. Tres caídas críticas en un año.",
    solution: "Migración a servidores virtualizados con backup automático en nube + contrato de soporte preventivo mensual.",
    results: [
      { icon: TrendingUp, label: "99.9% uptime", sub: "desde la implementación" },
      { icon: Clock,      label: "0 caídas",     sub: "en 18 meses" },
      { icon: Users,      label: "40% menos",    sub: "en costos de IT" },
    ],
    quote: "Con Bartez dejamos de apagar incendios y empezamos a planificar. Es como tener un departamento IT propio.",
    author: "Gerente de Operaciones",
    color: "from-blue-500/10 to-transparent",
    border: "border-blue-500/20",
  },
  {
    company: "Clínica Privada Norte",
    industry: "Salud",
    size: "80 empleados",
    icon: Users,
    challenge: "Red WiFi saturada con 60+ dispositivos médicos. Seguridad de datos de pacientes comprometida. Sin cumplimiento normativo.",
    solution: "Rediseño completo de red segmentada, firewall médico, políticas de seguridad y capacitación al personal.",
    results: [
      { icon: TrendingUp, label: "3x velocidad",  sub: "de red interna" },
      { icon: Clock,      label: "ISO 27001",     sub: "cumplimiento logrado" },
      { icon: Users,      label: "100% cobertura",sub: "en todas las áreas" },
    ],
    quote: "La seguridad de los datos de nuestros pacientes era crítica. Bartez nos llevó al estándar que necesitábamos.",
    author: "Director Médico",
    color: "from-green-500/10 to-transparent",
    border: "border-green-500/20",
  },
  {
    company: "Estudio Jurídico & Asociados",
    industry: "Legal",
    size: "35 empleados",
    icon: TrendingUp,
    challenge: "Trabajo remoto sin infraestructura: empleados con equipos personales, sin VPN, archivos compartidos por email.",
    solution: "Equipamiento corporativo completo + VPN empresarial + servidor de archivos con permisos por área.",
    results: [
      { icon: TrendingUp, label: "100% remoto",  sub: "de forma segura" },
      { icon: Clock,      label: "2 semanas",    sub: "para implementar todo" },
      { icon: Users,      label: "35 puestos",   sub: "equipados y seguros" },
    ],
    quote: "En dos semanas pasamos de un caos tecnológico a una operación profesional. El equipo lo notó inmediatamente.",
    author: "Socio Gerente",
    color: "from-purple-500/10 to-transparent",
    border: "border-purple-500/20",
  },
];

export default function CaseStudies() {
  return (
    <section className="py-20 lg:py-28">
      <div className="container mx-auto px-4 lg:px-8">
        <SectionHeading
          badge="Casos de Éxito"
          title="Empresas que ya"
          highlight="transformaron su IT"
          description="Resultados reales de clientes que confiaron en Bartez para modernizar su infraestructura tecnológica."
        />
        <div className="grid gap-6 lg:grid-cols-3">
          {cases.map((c, i) => (
            <motion.div
              key={c.company}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className={`relative rounded-2xl border ${c.border} bg-gradient-to-b ${c.color} p-7 flex flex-col`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-display text-base font-bold text-foreground">{c.company}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.industry} · {c.size}</p>
                </div>
                <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <c.icon size={16} className="text-muted-foreground" />
                </div>
              </div>

              {/* Challenge → Solution */}
              <div className="space-y-3 mb-5 flex-1">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">Desafío</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.challenge}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70 mb-1">Solución</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.solution}</p>
                </div>
              </div>

              {/* Results */}
              <div className="grid grid-cols-3 gap-2 mb-5 py-4 border-y border-border/20">
                {c.results.map(r => (
                  <div key={r.label} className="text-center">
                    <p className="text-sm font-bold text-foreground">{r.label}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-tight">{r.sub}</p>
                  </div>
                ))}
              </div>

              {/* Quote */}
              <blockquote className="text-xs text-muted-foreground italic leading-relaxed border-l-2 border-primary/30 pl-3">
                "{c.quote}"
                <footer className="mt-1 not-italic text-[10px] text-muted-foreground/60">— {c.author}</footer>
              </blockquote>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
