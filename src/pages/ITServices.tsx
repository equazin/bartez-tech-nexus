import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Wrench, Monitor, Network, Shield, Cloud, Headphones, ArrowRight, TrendingUp, ClipboardCheck, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import EnterpriseCTA from "@/components/EnterpriseCTA";
import WorkMethodology from "@/components/WorkMethodology";

const services = [
  { icon: Headphones, title: "Soporte IT Continuo", desc: "Mesa de ayuda con soporte remoto y on-site. Nos integramos como su departamento de tecnología con tiempos de respuesta garantizados.", highlights: ["Mesa de ayuda", "Soporte on-site", "SLA garantizado"] },
  { icon: Wrench, title: "Mantenimiento Preventivo", desc: "Planes de mantenimiento que previenen fallas y maximizan la vida útil de su inversión tecnológica.", highlights: ["Planes mensuales", "Reportes de estado", "Prevención de fallas"] },
  { icon: Network, title: "Gestión de Infraestructura", desc: "Administración, monitoreo y optimización de servidores, redes y sistemas de su organización.", highlights: ["Monitoreo 24/7", "Administración remota", "Optimización"] },
  { icon: Shield, title: "Seguridad y Continuidad", desc: "Protección integral de datos, firewalls corporativos, backup automatizado y planes de recuperación.", highlights: ["Firewalls", "Backup automático", "Plan de contingencia"] },
  { icon: Cloud, title: "Migración y Nube", desc: "Asesoramiento y migración a plataformas cloud. Microsoft 365, Google Workspace y soluciones híbridas.", highlights: ["Microsoft 365", "Google Workspace", "Cloud híbrido"] },
  { icon: Settings, title: "Consultoría Tecnológica", desc: "Análisis estratégico, diseño de soluciones y planificación del roadmap tecnológico de su organización.", highlights: ["Análisis estratégico", "Roadmap IT", "Planificación"] },
];

const partnershipBenefits = [
  "Equipo técnico certificado dedicado a su cuenta",
  "Tiempos de respuesta garantizados por contrato",
  "Informes mensuales de estado de infraestructura",
  "Planificación tecnológica a mediano y largo plazo",
  "Escalamiento flexible según crecimiento del negocio",
  "Un solo interlocutor para toda su tecnología",
];

const ITServices = () => {
  return (
    <Layout>
      <section className="page-hero">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Partnership Tecnológico"
            title="Su departamento IT externo,"
            highlight="sin contratarlo"
            description="Nos integramos a su operación como un equipo de tecnología dedicado. Gestionamos, mantenemos y hacemos evolucionar su infraestructura con compromiso de largo plazo."
            large
          />
        </div>
      </section>

      <section className="pb-16 lg:pb-20">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {services.map((svc, i) => (
              <motion.div
                key={svc.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.5 }}
                className="card-enterprise rounded-xl p-7"
              >
                <div className="icon-container h-12 w-12 text-primary mb-5">
                  <svc.icon size={22} />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground">{svc.title}</h3>
                <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">{svc.desc}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {svc.highlights.map((h) => (
                    <span key={h} className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                      {h}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Partnership Benefits */}
      <section className="relative">
        <div className="section-divider" />
        <div className="bg-surface py-20 lg:py-28">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <SectionHeading
                  badge="Beneficios del Partnership"
                  title="¿Por qué elegirnos como"
                  highlight="partner IT?"
                  description="No somos un proveedor más. Nos comprometemos con su operación como si fuera la nuestra."
                  center={false}
                />
              </div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="card-enterprise rounded-xl p-8"
              >
                <ul className="space-y-4">
                  {partnershipBenefits.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-sm text-secondary-foreground">
                      <ClipboardCheck size={15} className="text-primary mt-0.5 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </div>
        <div className="section-divider" />
      </section>

      {/* Work Methodology */}
      <WorkMethodology />

      <section className="pb-24 lg:pb-32">
        <div className="container mx-auto px-4 lg:px-8">
          <EnterpriseCTA
            badge="Comience Hoy"
            badgeIcon={TrendingUp}
            title="¿Su empresa necesita un"
            highlight="partner IT de confianza?"
            description="Solicite una evaluación tecnológica sin cargo. Diagnosticamos su infraestructura y le presentamos un plan de acción concreto."
            primaryLabel="Solicitar Evaluación Tecnológica"
            primaryTo="/evaluacion-tecnologica"
            secondaryLabel="Contactar un Especialista"
            secondaryTo="/contacto"
          />
        </div>
      </section>
    </Layout>
  );
};

export default ITServices;
