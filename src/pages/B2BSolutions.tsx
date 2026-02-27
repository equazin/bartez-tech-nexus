import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Building2, TrendingUp, Users, HandshakeIcon, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";

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

const B2BSolutions = () => {
  return (
    <Layout>
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="B2B"
            title="Soluciones para"
            highlight="Empresas"
            description="Programas especiales diseñados para empresas que necesitan un partner tecnológico confiable y de largo plazo."
          />

          <div className="grid gap-8 lg:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-xl border border-border/50 bg-card p-8"
            >
              <HandshakeIcon size={40} className="text-primary mb-4" />
              <h3 className="font-display text-2xl font-bold text-foreground">Programa de Partners</h3>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Únase a nuestro programa de socios comerciales y acceda a beneficios exclusivos, precios preferenciales y soporte dedicado para su empresa.
              </p>
              <Link to="/cotizacion" className="mt-6 inline-block">
                <Button className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90">
                  Quiero ser Partner <ArrowRight size={16} className="ml-2" />
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-xl border border-border/50 bg-card p-8"
            >
              <h3 className="font-display text-xl font-semibold text-foreground mb-4">Beneficios Corporativos</h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-secondary-foreground">
                    <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <div className="mt-16 text-center">
            <Link to="/cotizacion">
              <Button size="lg" className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90">
                Solicitar Información B2B <ArrowRight size={18} className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default B2BSolutions;
