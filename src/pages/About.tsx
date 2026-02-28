import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Award, Users, Target, Lightbulb, ArrowRight, Building2, Briefcase, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import EnterpriseCTA from "@/components/EnterpriseCTA";

const values = [
  { icon: Award, title: "Excelencia", desc: "Nos comprometemos con la calidad en cada producto y servicio que ofrecemos a nuestros clientes." },
  { icon: Users, title: "Confianza", desc: "Construimos relaciones de largo plazo basadas en la transparencia, el cumplimiento y los resultados." },
  { icon: Target, title: "Innovación", desc: "Nos mantenemos a la vanguardia tecnológica para ofrecer siempre las mejores soluciones del mercado." },
  { icon: Lightbulb, title: "Compromiso", desc: "Entendemos las necesidades de cada cliente y trabajamos sin descanso para superarlas." },
];

const milestones = [
  { year: "2009", event: "Fundación de Bartez Tecnología en Buenos Aires" },
  { year: "2013", event: "Expansión al mercado corporativo y sector público" },
  { year: "2017", event: "Alianzas con Dell, HP, Lenovo y Cisco" },
  { year: "2020", event: "Lanzamiento de servicios de consultoría IT" },
  { year: "2024", event: "+500 empresas confían en nuestras soluciones" },
];

const About = () => {
  return (
    <Layout>
      <section className="relative py-20 lg:py-28">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Sobre Nosotros"
            title="Impulsamos empresas con"
            highlight="tecnología"
            description="Más de 15 años acompañando el crecimiento tecnológico de empresas argentinas."
            large
          />
        </div>
      </section>

      <section className="pb-24 lg:pb-32">
        <div className="container mx-auto px-4 lg:px-8">
          {/* Story */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl card-enterprise rounded-xl p-8 lg:p-10 text-center mb-20"
          >
            <div className="icon-container-lg h-14 w-14 text-primary mx-auto mb-6">
              <Building2 size={28} />
            </div>
            <p className="text-muted-foreground leading-relaxed text-lg">
              Desde 2009, Bartez Tecnología se ha consolidado como un referente en la provisión de hardware, infraestructura y servicios IT para el sector corporativo en Argentina. Nuestro equipo de profesionales certificados trabaja junto a cada cliente para diseñar e implementar soluciones que maximicen la productividad y la seguridad de sus operaciones.
            </p>
          </motion.div>

          {/* Values */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-20">
            {values.map((val, i) => (
              <motion.div
                key={val.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="card-enterprise rounded-xl p-7 text-center"
              >
                <div className="icon-container h-12 w-12 text-primary mx-auto mb-4">
                  <val.icon size={22} />
                </div>
                <h3 className="font-display text-base font-semibold text-foreground">{val.title}</h3>
                <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">{val.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="card-enterprise rounded-xl p-8 lg:p-10"
          >
            <h3 className="font-display text-xl font-semibold text-foreground mb-8">Nuestra Trayectoria</h3>
            <div className="space-y-6">
              {milestones.map((m, i) => (
                <div key={m.year} className="flex items-start gap-5">
                  <span className="font-display text-lg font-bold text-primary shrink-0 w-14">{m.year}</span>
                  <div className="flex-1 border-l border-border/40 pl-5 pb-2">
                    <p className="text-sm text-secondary-foreground">{m.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Why choose us */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-20 card-enterprise rounded-xl p-8 lg:p-10"
          >
            <h3 className="font-display text-xl font-semibold text-foreground mb-6">¿Por qué elegirnos como su partner IT?</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                "Más de 500 empresas nos eligen",
                "Distribuidores autorizados de las principales marcas",
                "Equipo de consultores certificados",
                "SLA y soporte con tiempos garantizados",
                "Facturación A y B — Cuenta corriente",
                "Implementación y soporte en todo el país",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-sm text-secondary-foreground">
                  <Shield size={15} className="text-primary mt-0.5 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </motion.div>

          <div className="mt-20">
            <EnterpriseCTA
              badge="Trabaje con Nosotros"
              badgeIcon={Briefcase}
              title="Convierta a Bartez en su"
              highlight="partner tecnológico"
              description="Únase a las más de 500 empresas que confían en nuestras soluciones de infraestructura, equipamiento y consultoría IT."
              primaryLabel="Solicitar Cotización Corporativa"
              primaryTo="/cotizacion"
              secondaryLabel="Contactar al Equipo Comercial"
              secondaryTo="/contacto"
            />
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default About;
