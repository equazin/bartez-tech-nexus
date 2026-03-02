import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { HandshakeIcon, ArrowRight, CheckCircle2, Building2, Users, TrendingUp, Shield, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import EnterpriseCTA from "@/components/EnterpriseCTA";

const benefits = [
  "Consultor tecnológico dedicado a su cuenta",
  "Planes de soporte con SLA personalizado",
  "Planificación tecnológica a mediano y largo plazo",
  "Informes mensuales de estado de infraestructura",
  "Escalamiento flexible según crecimiento del negocio",
  "Facturación A y B — Cuenta corriente",
  "Cobertura en todo el país",
  "Un solo interlocutor para toda su tecnología",
];

const features = [
  { icon: Building2, title: "Empresas en Crecimiento", desc: "Acompañamos a empresas que necesitan escalar su tecnología de forma planificada y sustentable." },
  { icon: Users, title: "Integración a su Equipo", desc: "Nos sumamos como extensión de su organización, trabajando junto a sus equipos internos." },
  { icon: TrendingUp, title: "Evolución Continua", desc: "Su infraestructura evoluciona con su negocio. Planificamos cada etapa de crecimiento tecnológico." },
  { icon: Shield, title: "Compromiso de Largo Plazo", desc: "Construimos relaciones duraderas basadas en resultados, transparencia y cumplimiento." },
];

const B2BSolutions = () => {
  return (
    <Layout>
      <section className="page-hero">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Partnership Empresarial"
            title="Un partner tecnológico para"
            highlight="el largo plazo"
            description="No buscamos clientes: buscamos empresas que necesiten un aliado tecnológico comprometido con su operación y crecimiento."
            large
          />
        </div>
      </section>

      <section className="pb-24 lg:pb-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-12">
            {features.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="card-enterprise rounded-xl p-6 text-center"
              >
                <div className="icon-container h-12 w-12 text-primary mx-auto mb-4">
                  <feat.icon size={22} />
                </div>
                <h3 className="font-display text-base font-semibold text-foreground">{feat.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feat.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="card-enterprise rounded-xl p-8 lg:p-10"
            >
              <div className="icon-container-lg h-14 w-14 text-primary mb-5">
                <HandshakeIcon size={28} />
              </div>
              <h3 className="font-display text-2xl font-bold text-foreground">¿Por qué un Partnership Tecnológico?</h3>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Las empresas que externalizan su gestión IT en un partner especializado reducen costos operativos, minimizan riesgos y acceden a expertise que sería costoso mantener internamente. Con Bartez, su empresa cuenta con un equipo técnico certificado que gestiona, mantiene y hace evolucionar su infraestructura.
              </p>
              <Link to="/evaluacion-tecnologica" className="mt-8 inline-block">
                <Button className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 h-11 px-6 text-sm">
                  Solicitar Evaluación <ArrowRight size={14} className="ml-2" />
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="card-enterprise rounded-xl p-8 lg:p-10"
            >
              <h3 className="font-display text-xl font-semibold text-foreground mb-6">Qué Incluye el Partnership</h3>
              <ul className="grid gap-3.5 sm:grid-cols-2">
                {benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-secondary-foreground">
                    <CheckCircle2 size={15} className="text-primary mt-0.5 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <div className="mt-20">
            <EnterpriseCTA
              badge="Comience Hoy"
              badgeIcon={Briefcase}
              title="Convierta a Bartez en su"
              highlight="departamento IT externo"
              description="Solicite una evaluación tecnológica sin cargo. Diagnosticamos su infraestructura y le presentamos un plan concreto."
              primaryLabel="Solicitar Evaluación Tecnológica"
              primaryTo="/evaluacion-tecnologica"
              secondaryLabel="Contactar un Especialista"
              secondaryTo="/contacto"
            />
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default B2BSolutions;
