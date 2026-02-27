import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Wrench, Monitor, Network, Shield, Cloud, Headphones, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";

const services = [
  { icon: Wrench, title: "Mantenimiento Preventivo", desc: "Planes de mantenimiento para equipos y redes. Minimice tiempos de inactividad y maximice la vida útil de su inversión tecnológica.", highlights: ["Planes mensuales", "Reportes de estado", "Actualizaciones"] },
  { icon: Monitor, title: "Soporte Técnico", desc: "Mesa de ayuda con soporte remoto y on-site. Tiempos de respuesta garantizados con SLA personalizado.", highlights: ["Soporte remoto", "On-site", "SLA garantizado"] },
  { icon: Network, title: "Administración de Redes", desc: "Monitoreo 24/7, administración y optimización de su infraestructura de red.", highlights: ["Monitoreo 24/7", "Optimización", "Diagnóstico"] },
  { icon: Shield, title: "Seguridad Informática", desc: "Auditorías de seguridad, firewalls empresariales, backup y recuperación ante desastres.", highlights: ["Firewalls", "Backup", "Auditorías"] },
  { icon: Cloud, title: "Migración a la Nube", desc: "Asesoramiento y migración a plataformas cloud. Microsoft 365, Google Workspace y AWS.", highlights: ["Microsoft 365", "Google Workspace", "AWS"] },
  { icon: Headphones, title: "Consultoría IT", desc: "Análisis, diseño de soluciones y planificación estratégica para su transformación digital.", highlights: ["Análisis", "Estrategia", "Roadmap"] },
];

const ITServices = () => {
  return (
    <Layout>
      <section className="relative py-20 lg:py-28">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Servicios IT"
            title="Servicios profesionales para"
            highlight="su operación"
            description="Equipo de profesionales certificados que mantiene su empresa operativa, segura y preparada para escalar."
            large
          />
        </div>
      </section>

      <section className="pb-24 lg:pb-32">
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

          <div className="mt-16 text-center">
            <Link to="/contacto">
              <Button className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 glow-sm h-11 px-7 text-sm">
                Consultar Servicios <ArrowRight size={14} className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default ITServices;
