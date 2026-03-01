import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Building2, Network, Shield, Server, Monitor, HeadphonesIcon, ArrowRight, CheckCircle2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import EnterpriseCTA from "@/components/EnterpriseCTA";

const solutions = [
  { icon: Building2, title: "Equipamiento de Oficinas", desc: "Provisión completa de equipos para oficinas. PCs, notebooks, monitores, periféricos y mobiliario tecnológico.", number: "01" },
  { icon: Network, title: "Redes Corporativas", desc: "Diseño e implementación de redes LAN/WAN, WiFi empresarial, VPN y conectividad segura.", number: "02" },
  { icon: Server, title: "Data Center", desc: "Soluciones de infraestructura de servidores, almacenamiento y virtualización para su centro de datos.", number: "03" },
  { icon: Shield, title: "Ciberseguridad", desc: "Protección integral de datos, firewalls, antivirus corporativo y políticas de seguridad.", number: "04" },
  { icon: Monitor, title: "Salas de Reuniones", desc: "Equipamiento audiovisual, sistemas de videoconferencia y colaboración para salas de reuniones.", number: "05" },
  { icon: HeadphonesIcon, title: "Soporte Dedicado", desc: "Mesa de ayuda, soporte on-site y mantenimiento preventivo con SLA garantizado.", number: "06" },
];

const processSteps = [
  "Relevamiento de necesidades",
  "Diseño de la solución",
  "Propuesta y cotización",
  "Implementación",
  "Soporte continuo",
];

const CorporateSolutions = () => {
  return (
    <Layout>
      <section className="page-hero">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Soluciones Corporativas"
            title="Tecnología a medida para"
            highlight="su empresa"
            description="Diseñamos e implementamos soluciones tecnológicas integrales que se adaptan a la escala y complejidad de su organización."
            large
          />
        </div>
      </section>

      <section className="pb-24 lg:pb-32">
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

          {/* Process */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-20 card-enterprise rounded-xl p-8 lg:p-10"
          >
            <h3 className="font-display text-xl font-semibold text-foreground mb-6">Nuestro Proceso</h3>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-0">
              {processSteps.map((step, i) => (
                <div key={step} className="flex items-center gap-3 sm:flex-1">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </div>
                  <span className="text-sm text-secondary-foreground">{step}</span>
                  {i < processSteps.length - 1 && (
                    <div className="hidden sm:block flex-1 h-px bg-border/40 mx-3" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          <div className="mt-20">
            <EnterpriseCTA
              badge="Soluciones a Medida"
              badgeIcon={Briefcase}
              title="Diseñamos la infraestructura que"
              highlight="su empresa necesita"
              description="Relevamiento, diseño, implementación y soporte continuo. Todo en un solo partner tecnológico."
              primaryLabel="Solicitar Propuesta Corporativa"
              primaryTo="/cotizacion"
              secondaryLabel="Hablar con un Consultor"
              secondaryTo="/contacto"
            />
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default CorporateSolutions;
