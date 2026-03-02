import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Building2, Network, Shield, Server, Monitor, HeadphonesIcon, ArrowRight, Briefcase, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import EnterpriseCTA from "@/components/EnterpriseCTA";
import WorkMethodology from "@/components/WorkMethodology";

const solutions = [
  { icon: Server, title: "Infraestructura IT", desc: "Diseño e implementación de servidores, almacenamiento, virtualización y data centers. Infraestructura que soporta la operación crítica de su empresa.", number: "01" },
  { icon: Network, title: "Redes Corporativas", desc: "Redes LAN/WAN, WiFi empresarial, VPN y seguridad perimetral. Conectividad confiable para todas las áreas de su organización.", number: "02" },
  { icon: Monitor, title: "Equipamiento de Puestos de Trabajo", desc: "Provisión integral de estaciones de trabajo, notebooks, monitores y periféricos configurados y listos para operar.", number: "03" },
  { icon: Shield, title: "Ciberseguridad Corporativa", desc: "Protección integral de datos, firewalls, políticas de seguridad, backup automatizado y planes de recuperación ante desastres.", number: "04" },
  { icon: Lightbulb, title: "Modernización de Infraestructura", desc: "Actualización tecnológica planificada. Migramos su infraestructura a estándares modernos con mínimo impacto operativo.", number: "05" },
  { icon: HeadphonesIcon, title: "Continuidad Operativa", desc: "Planes de contingencia, redundancia de sistemas y acuerdos de nivel de servicio (SLA) para garantizar la operación 24/7.", number: "06" },
];

const CorporateSolutions = () => {
  return (
    <Layout>
      <section className="page-hero">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Soluciones Corporativas"
            title="Infraestructura tecnológica para"
            highlight="su organización"
            description="Diseñamos, implementamos y mantenemos la infraestructura IT que su empresa necesita. Soluciones integrales con visión de largo plazo."
            large
          />
        </div>
      </section>

      <section className="pb-16 lg:pb-20">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {solutions.map((sol, i) => (
              <motion.div
                key={sol.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.5 }}
                className="card-enterprise rounded-xl p-7"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="icon-container h-12 w-12 text-primary">
                    <sol.icon size={22} />
                  </div>
                  <span className="font-display text-2xl font-extrabold text-border/60">{sol.number}</span>
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground">{sol.title}</h3>
                <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">{sol.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Work Methodology */}
      <section className="relative">
        <div className="section-divider" />
        <div className="bg-surface">
          <WorkMethodology />
        </div>
        <div className="section-divider" />
      </section>

      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <EnterpriseCTA
            badge="Comience con una Evaluación"
            badgeIcon={Briefcase}
            title="Diseñamos la infraestructura que"
            highlight="su empresa necesita"
            description="Evaluación tecnológica, diseño de solución, implementación y soporte continuo. Todo en un solo partner tecnológico."
            primaryLabel="Solicitar Evaluación Tecnológica"
            primaryTo="/evaluacion-tecnologica"
            secondaryLabel="Hablar con un Consultor"
            secondaryTo="/contacto"
          />
        </div>
      </section>
    </Layout>
  );
};

export default CorporateSolutions;
