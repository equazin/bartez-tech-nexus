import { motion } from "framer-motion";
import { Award, Users, Target, Lightbulb } from "lucide-react";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";

const values = [
  { icon: Award, title: "Excelencia", desc: "Nos comprometemos con la calidad en cada producto y servicio que ofrecemos." },
  { icon: Users, title: "Confianza", desc: "Construimos relaciones de largo plazo basadas en la transparencia y el cumplimiento." },
  { icon: Target, title: "Innovación", desc: "Nos mantenemos a la vanguardia de la tecnología para ofrecer las mejores soluciones." },
  { icon: Lightbulb, title: "Compromiso", desc: "Entendemos las necesidades de cada cliente y trabajamos para superarlas." },
];

const About = () => {
  return (
    <Layout>
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Nosotros"
            title="Sobre Bartez"
            highlight="Tecnología"
            description="Somos una empresa argentina dedicada a brindar soluciones tecnológicas integrales para empresas de todos los tamaños."
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-auto max-w-3xl rounded-xl border border-border/50 bg-card p-8 text-center mb-16"
          >
            <p className="text-muted-foreground leading-relaxed text-lg">
              Con más de 15 años de experiencia en el mercado, Bartez Tecnología se ha consolidado como un referente en la provisión de hardware, infraestructura y servicios IT para el sector corporativo en Argentina. Nuestro equipo de profesionales certificados trabaja junto a nuestros clientes para diseñar e implementar las mejores soluciones tecnológicas.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((val, i) => (
              <motion.div
                key={val.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-xl border border-border/50 bg-card p-6 text-center"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <val.icon size={28} />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground">{val.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{val.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default About;
