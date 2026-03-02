import { motion } from "framer-motion";
import { Award, Users, Target, Lightbulb, Building2, Briefcase, Shield } from "lucide-react";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import EnterpriseCTA from "@/components/EnterpriseCTA";

const values = [
  { icon: Award, title: "Excelencia Técnica", desc: "Equipos certificados y procesos probados que garantizan implementaciones exitosas en cada proyecto." },
  { icon: Users, title: "Relaciones de Confianza", desc: "Construimos partnerships de largo plazo basados en transparencia, cumplimiento y resultados medibles." },
  { icon: Target, title: "Visión Estratégica", desc: "No solo resolvemos problemas: planificamos la evolución tecnológica de su organización." },
  { icon: Lightbulb, title: "Compromiso con el Cliente", desc: "Entendemos que su tecnología es crítica. Actuamos con la urgencia y responsabilidad que su operación demanda." },
];

const milestones = [
  { year: "2009", event: "Fundación de Bartez Tecnología en Buenos Aires" },
  { year: "2012", event: "Primeros contratos de soporte IT continuo para empresas" },
  { year: "2015", event: "Alianzas estratégicas con Dell, HP, Lenovo y Cisco" },
  { year: "2018", event: "Lanzamiento del modelo de Partnership Tecnológico" },
  { year: "2021", event: "Expansión a consultoría IT y gestión de infraestructura" },
  { year: "2024", event: "+500 empresas confían en nuestras soluciones" },
];

const About = () => {
  return (
    <Layout>
      <section className="page-hero">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Sobre Bartez Tecnología"
            title="15+ años como partner tecnológico de"
            highlight="empresas argentinas"
            description="Nacimos con la convicción de que las empresas necesitan un aliado tecnológico comprometido con su operación, no solo un proveedor."
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
              Desde 2009, Bartez Tecnología acompaña a empresas argentinas en la gestión y evolución de su infraestructura IT. No somos una tienda de computación: somos un equipo de profesionales certificados que se integra a su organización como un departamento de tecnología externo, comprometido con la continuidad, seguridad y crecimiento de su operación.
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
              {milestones.map((m) => (
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
            <h3 className="font-display text-xl font-semibold text-foreground mb-6">¿Por qué elegirnos como su partner tecnológico?</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                "Más de 500 empresas confían en nosotros",
                "Distribuidores autorizados de las principales marcas",
                "Equipo de consultores y técnicos certificados",
                "SLA y tiempos de respuesta garantizados",
                "Modelo de partnership con compromiso de largo plazo",
                "Cobertura e implementación en todo el país",
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
              description="Únase a las más de 500 empresas que confían en nosotros para gestionar y hacer evolucionar su infraestructura IT."
              primaryLabel="Solicitar Evaluación Tecnológica"
              primaryTo="/evaluacion-tecnologica"
              secondaryLabel="Contactar al Equipo"
              secondaryTo="/contacto"
            />
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default About;
