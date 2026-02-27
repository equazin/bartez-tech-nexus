import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Zap, Server, Monitor, Headphones, BarChart3, CheckCircle2, Building2, Users, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import heroBg from "@/assets/hero-bg.png";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const productCategories = [
  { icon: Monitor, title: "Desktop PCs", desc: "Equipos de escritorio para oficinas y estaciones de trabajo." },
  { icon: Monitor, title: "Notebooks", desc: "Laptops corporativas y de alto rendimiento." },
  { icon: Zap, title: "Gaming PCs", desc: "Computadoras gamer de alta performance." },
  { icon: Server, title: "Servidores", desc: "Infraestructura de servidores empresariales." },
  { icon: BarChart3, title: "Networking", desc: "Equipamiento de redes y conectividad." },
  { icon: Headphones, title: "Periféricos", desc: "Accesorios y componentes de calidad." },
];

const services = [
  { icon: Building2, title: "Consultoría IT", desc: "Asesoramiento integral para la transformación tecnológica de su empresa." },
  { icon: Server, title: "Infraestructura", desc: "Diseño e implementación de infraestructura de redes y servidores." },
  { icon: Shield, title: "Seguridad", desc: "Soluciones de seguridad informática y protección de datos." },
  { icon: Headphones, title: "Soporte Técnico", desc: "Asistencia técnica especializada y mantenimiento preventivo." },
];

const stats = [
  { value: "500+", label: "Empresas Atendidas" },
  { value: "15+", label: "Años de Experiencia" },
  { value: "98%", label: "Satisfacción del Cliente" },
  { value: "24/7", label: "Soporte Disponible" },
];

const Index = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </div>
        <div className="relative container mx-auto px-4 py-24 md:py-36 lg:py-44 lg:px-8">
          <motion.div
            initial="hidden"
            animate="visible"
            className="max-w-3xl"
          >
            <motion.span
              variants={fadeUp}
              custom={0}
              className="mb-6 inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-primary"
            >
              Tecnología Empresarial
            </motion.span>
            <motion.h1
              variants={fadeUp}
              custom={1}
              className="font-display text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl lg:text-7xl"
            >
              Impulse su empresa con{" "}
              <span className="text-gradient">tecnología de alto rendimiento</span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed"
            >
              Soluciones tecnológicas integrales para empresas. Hardware, infraestructura, redes y consultoría IT con el respaldo de las mejores marcas del mercado.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="mt-8 flex flex-wrap gap-4">
              <Link to="/cotizacion">
                <Button size="lg" className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 glow-sm">
                  Solicitar Cotización <ArrowRight className="ml-2" size={18} />
                </Button>
              </Link>
              <Link to="/productos">
                <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-secondary">
                  Ver Productos
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/50 bg-surface">
        <div className="container mx-auto px-4 py-12 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="font-display text-3xl font-bold text-gradient md:text-4xl">{stat.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Categories */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Catálogo"
            title="Nuestras categorías de"
            highlight="productos"
            description="Ofrecemos una amplia gama de productos tecnológicos de las mejores marcas para satisfacer las necesidades de su empresa."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {productCategories.map((cat, i) => (
              <motion.div
                key={cat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Link
                  to="/productos"
                  className="group flex flex-col rounded-xl border border-border/50 bg-card p-6 transition-all hover:border-primary/30 hover:bg-secondary"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                    <cat.icon size={24} />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-foreground">{cat.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{cat.desc}</p>
                  <span className="mt-4 flex items-center text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Explorar <ArrowRight size={14} className="ml-1" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="border-y border-border/50 bg-surface py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Servicios"
            title="Servicios IT"
            highlight="profesionales"
            description="Brindamos servicios integrales de tecnología para optimizar la operación de su empresa."
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((svc, i) => (
              <motion.div
                key={svc.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
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
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-10 md:p-16 text-center">
            <div className="absolute inset-0 hero-grid opacity-30" />
            <div className="relative">
              <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">
                ¿Listo para potenciar su <span className="text-gradient">infraestructura tecnológica</span>?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
                Contacte a nuestro equipo de especialistas y reciba una cotización personalizada para su empresa.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link to="/cotizacion">
                  <Button size="lg" className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 glow-sm">
                    Solicitar Cotización
                  </Button>
                </Link>
                <Link to="/contacto">
                  <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-secondary">
                    Contactarnos
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-t border-border/50 bg-surface py-16">
        <div className="container mx-auto px-4 lg:px-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-muted-foreground">
            {["Distribuidores Autorizados", "Garantía Oficial", "Envíos a Todo el País", "Facturación A y B", "Soporte Post-Venta"].map((item) => (
              <span key={item} className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={16} className="text-primary" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
