import { motion } from "framer-motion";
import { Award, Users, Target, Lightbulb, Building2, Briefcase, Shield, Zap, Globe, Cpu } from "lucide-react";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import EnterpriseCTA from "@/components/EnterpriseCTA";

const values = [
  { icon: Award, title: "Excelencia Técnica", desc: "Equipos certificados y procesos probados que garantizan implementaciones de infraestructura críticas." },
  { icon: Zap, title: "Agilidad Digital", desc: "Potenciamos la toma de decisiones con herramientas en tiempo real y autogestión a través de nuestro Portal B2B." },
  { icon: Target, title: "Visión Estratégica", desc: "No solo resolvemos problemas: planificamos el roadmap tecnológico para que su negocio escale sin límites." },
  { icon: Lightbulb, title: "Compromiso de Partner", desc: "Actuamos como un socio estratégico, compartiendo el riesgo y la responsabilidad que su operación demanda." },
];

const milestones = [
  { year: "2009", event: "Fundación de Bartez Tecnología en Buenos Aires con foco en Soporte IT." },
  { year: "2015", event: "Alianzas estratégicas Platinum con Dell, HP, Lenovo, Cisco e Intel." },
  { year: "2018", event: "Lanzamiento del modelo de Partnership Tecnológico Integrado." },
  { year: "2021", event: "Expansión nacional y apertura de canales logísticos para todo el país." },
  { year: "2024", event: "Lanzamiento del Portal B2B Inteligente: El HUB líder de abastecimiento IT." },
  { year: "2025", event: "+500 empresas e integradores ya operan 100% digitalmente con nosotros." },
];

const About = () => {
  return (
    <Layout>
      <section className="page-hero">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Más que un Proveedor IT"
            title="Somos el HUB tecnológico de"
            highlight="nueva generación"
            description="Bartez es la evolución del soporte IT. Combinamos 15 años de consultoría con el ecosistema de abastecimiento B2B más ágil de la industria."
            large
          />
        </div>
      </section>

      <section className="pb-24 lg:pb-32">
        <div className="container mx-auto px-4 lg:px-8">
          {/* Story */}
          <div className="grid gap-10 lg:grid-cols-2 items-center mb-20">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="card-enterprise rounded-3xl p-8 lg:p-12 border-primary/10 shadow-xl"
            >
              <div className="icon-container-lg h-16 w-16 text-gradient mb-8">
                <Building2 size={32} />
              </div>
              <h2 className="font-display text-2xl lg:text-3xl font-bold text-foreground mb-6">Nuestra Evolución</h2>
              <p className="text-muted-foreground leading-relaxed text-lg">
                Desde 2009, Bartez Tecnología acompaña a empresas argentinas en la gestión de su infraestructura. Nacimos como un equipo de soporte, pero entendimos que el futuro B2B exigía **agilidad y transparencia total**.
              </p>
              <p className="mt-6 text-muted-foreground leading-relaxed text-lg">
                Hoy, Bartez es un ecosistema integrado: un partner que ofrece consultoría técnica de alto nivel y, simultáneamente, el **Portal B2B líder** que permite a integradores e industrias comprar, gestionar y escalar su tecnología en segundos, no en días.
              </p>
            </motion.div>
            
            <div className="grid gap-6 sm:grid-cols-2">
              {[
                { icon: Globe, title: "Presencia Federal", value: "Todo el País" },
                { icon: Cpu, title: "Marcas Líderes", value: "Stock Real" },
                { icon: Users, title: "Expertise Humano", value: "Partner 1:1" },
                { icon: Shield, title: "Ciberseguridad", value: "Protección" },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="card-enterprise rounded-2xl p-6 text-center border-white/5"
                >
                   <div className="icon-container h-12 w-12 text-primary mx-auto mb-4">
                    <item.icon size={22} />
                  </div>
                  <h4 className="text-foreground font-bold">{item.title}</h4>
                  <p className="text-primary text-xs font-semibold uppercase tracking-widest mt-1">{item.value}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Values */}
          <SectionHeading
            badge="Nuestros Pilares"
            title="Valores que aseguran su"
            highlight="continuidad operativa"
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-24">
            {values.map((val, i) => (
              <motion.div
                key={val.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card-enterprise rounded-2xl p-7 text-center group hover:border-primary/20 transition-all"
              >
                <div className="icon-container h-14 w-14 text-primary mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <val.icon size={24} />
                </div>
                <h3 className="font-display text-lg font-bold text-foreground mb-3">{val.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{val.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Timeline */}
          <div className="grid gap-12 lg:grid-cols-3 items-start mb-24">
            <div className="lg:col-span-1">
               <h3 className="font-display text-3xl font-bold text-foreground mb-4">Nuestra <span className="text-gradient">Trayectoria</span></h3>
               <p className="text-muted-foreground text-sm leading-relaxed">
                 Un camino de crecimiento constante enfocado en profesionalizar el mercado IT argentino.
               </p>
            </div>
            <div className="lg:col-span-2 card-enterprise rounded-3xl p-8 lg:p-12 bg-surface/50">
              <div className="space-y-10 relative">
                <div className="absolute left-[31px] top-2 bottom-2 w-px bg-primary/20 hidden sm:block" />
                {milestones.map((m, i) => (
                  <motion.div
                    key={m.year}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex flex-col sm:flex-row items-start gap-6 relative z-10"
                  >
                    <div className="h-16 w-16 shrink-0 rounded-full bg-card border-2 border-primary/20 flex items-center justify-center font-display text-lg font-bold text-primary shadow-lg shadow-primary/5">
                      {m.year}
                    </div>
                    <div className="flex-1 pt-3">
                      <p className="text-foreground font-semibold text-lg leading-snug">{m.event}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-20">
            <EnterpriseCTA
              badge="Únase al HUB de Bartez"
              badgeIcon={Shield}
              title="Profesionalice la infraestructura"
              highlight="de su empresa hoy"
              description="Súmese a las más de 500 corporaciones e integradores que ya operan con Bartez Tecnología para potenciar sus resultados IT."
              primaryLabel="Acceder al Portal B2B"
              primaryTo="/login"
              secondaryLabel="Hablar con Consultoría"
              secondaryTo="/contacto"
            />
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default About;
