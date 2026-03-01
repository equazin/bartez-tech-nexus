import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { HandshakeIcon, ArrowRight, CheckCircle2, Building2, Users, TrendingUp, Shield, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import EnterpriseCTA from "@/components/EnterpriseCTA";

const benefits = [
  "Precios especiales para volumen",
  "Cuenta corriente y financiación",
  "Facturación A y B",
  "Ejecutivo de cuenta dedicado",
  "Entregas programadas",
  "Soporte prioritario 24/7",
  "Garantía extendida corporativa",
  "Asesoramiento técnico personalizado",
];

const features = [
  { icon: Building2, title: "Empresas", desc: "Equipamiento completo para oficinas y sedes de cualquier tamaño." },
  { icon: Users, title: "Canal de Reventa", desc: "Programa de distribución para revendedores e integradores." },
  { icon: TrendingUp, title: "Escalabilidad", desc: "Soluciones que crecen con su negocio, desde PyMEs hasta corporaciones." },
  { icon: Shield, title: "Garantía Extendida", desc: "Cobertura especial y tiempos de reposición prioritarios." },
];

const B2BSolutions = () => {
  return (
    <Layout>
      <section className="page-hero">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Soluciones B2B"
            title="Partner tecnológico para"
            highlight="su negocio"
            description="Programas diseñados para empresas que necesitan un aliado tecnológico confiable y de largo plazo."
            large
          />
        </div>
      </section>

      <section className="pb-24 lg:pb-32">
        <div className="container mx-auto px-4 lg:px-8">
          {/* Features grid */}
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

          {/* Main content */}
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
              <h3 className="font-display text-2xl font-bold text-foreground">Programa de Partners</h3>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Únase a nuestro programa de socios comerciales y acceda a beneficios exclusivos, precios preferenciales y soporte dedicado para hacer crecer su negocio.
              </p>
              <Link to="/cotizacion" className="mt-8 inline-block">
                <Button className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 h-11 px-6 text-sm">
                  Quiero ser Partner <ArrowRight size={14} className="ml-2" />
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="card-enterprise rounded-xl p-8 lg:p-10"
            >
              <h3 className="font-display text-xl font-semibold text-foreground mb-6">Beneficios Corporativos</h3>
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
              badgeIcon={PhoneCall}
              title="Conviértase en partner de"
              highlight="Bartez Tecnología"
              description="Acceda a precios preferenciales, soporte prioritario, cuenta corriente y un ejecutivo comercial dedicado a su cuenta."
              primaryLabel="Quiero ser Partner B2B"
              primaryTo="/cotizacion"
              secondaryLabel="Contactar Ventas Corporativas"
              secondaryTo="/contacto"
            />
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default B2BSolutions;
