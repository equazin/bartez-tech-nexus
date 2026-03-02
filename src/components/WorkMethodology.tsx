import { motion } from "framer-motion";
import { ClipboardCheck, Map, Rocket, HeadphonesIcon } from "lucide-react";
import SectionHeading from "./SectionHeading";

const steps = [
  {
    icon: ClipboardCheck,
    number: "01",
    title: "Evaluación Tecnológica",
    desc: "Relevamos su infraestructura actual, identificamos puntos críticos y oportunidades de mejora en su entorno IT.",
    details: ["Auditoría de infraestructura", "Análisis de riesgos", "Diagnóstico de necesidades"],
  },
  {
    icon: Map,
    number: "02",
    title: "Planificación Estratégica",
    desc: "Diseñamos un plan de acción con prioridades, presupuesto y cronograma adaptado a los objetivos de su organización.",
    details: ["Roadmap tecnológico", "Estimación de inversión", "Definición de etapas"],
  },
  {
    icon: Rocket,
    number: "03",
    title: "Implementación",
    desc: "Ejecutamos el despliegue de equipamiento, redes e infraestructura con mínimo impacto en su operación diaria.",
    details: ["Despliegue coordinado", "Migración de datos", "Configuración y testing"],
  },
  {
    icon: HeadphonesIcon,
    number: "04",
    title: "Soporte Continuo",
    desc: "Nos convertimos en su departamento IT externo con monitoreo, mantenimiento preventivo y soporte permanente.",
    details: ["Monitoreo proactivo", "Mantenimiento preventivo", "Soporte con SLA"],
  },
];

const WorkMethodology = () => {
  return (
    <section className="py-20 lg:py-28">
      <div className="container mx-auto px-4 lg:px-8">
        <SectionHeading
          badge="Metodología de Trabajo"
          title="Cómo acompañamos a"
          highlight="su empresa"
          description="Un proceso estructurado y probado que garantiza resultados desde el primer día. No vendemos productos: construimos soluciones."
          large
        />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="card-enterprise rounded-xl p-6 lg:p-7 relative"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="icon-container h-11 w-11 text-primary">
                  <step.icon size={20} />
                </div>
                <span className="font-display text-3xl font-extrabold text-border/50">{step.number}</span>
              </div>
              <h3 className="font-display text-sm font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              <ul className="mt-4 space-y-1.5">
                {step.details.map((d) => (
                  <li key={d} className="flex items-center gap-2 text-[11px] text-secondary-foreground">
                    <div className="h-1 w-1 rounded-full bg-primary/50" />
                    {d}
                  </li>
                ))}
              </ul>
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-px bg-border/40" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WorkMethodology;
