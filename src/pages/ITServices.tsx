import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Wrench, Monitor, Network, Shield, Cloud, Headphones, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";

const services = [
  { icon: Wrench, title: "Mantenimiento Preventivo", desc: "Planes de mantenimiento preventivo para equipos y redes. Minimice tiempos de inactividad y maximice la vida útil de su inversión." },
  { icon: Monitor, title: "Soporte Técnico", desc: "Mesa de ayuda con soporte remoto y on-site. Tiempos de respuesta garantizados con SLA personalizado." },
  { icon: Network, title: "Administración de Redes", desc: "Monitoreo, administración y optimización de la infraestructura de red de su empresa." },
  { icon: Shield, title: "Seguridad Informática", desc: "Auditorías de seguridad, implementación de firewalls, backup y recuperación ante desastres." },
  { icon: Cloud, title: "Migración a la Nube", desc: "Asesoramiento y migración de servicios a plataformas cloud. Microsoft 365, Google Workspace y más." },
  { icon: Headphones, title: "Consultoría IT", desc: "Análisis de necesidades, diseño de soluciones y planificación estratégica de tecnología." },
];

const ITServices = () => {
  return (
    <Layout>
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Servicios"
            title="Servicios"
            highlight="IT Profesionales"
            description="Nuestro equipo de profesionales certificados brinda servicios IT de alta calidad para mantener su empresa operativa y segura."
          />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {services.map((svc, i) => (
              <motion.div
                key={svc.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-xl border border-border/50 bg-card p-6"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <svc.icon size={24} />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground">{svc.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{svc.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <Link to="/contacto">
              <Button size="lg" className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90">
                Consultar Servicios <ArrowRight size={18} className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default ITServices;
