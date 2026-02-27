import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Zap, Server, Monitor, Headphones, BarChart3, CheckCircle2, Building2, Network, Cpu, TrendingUp, Globe, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import heroBg from "@/assets/hero-bg.png";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: "easeOut" as const },
  }),
};

const productCategories = [
  { icon: Monitor, title: "Desktop PCs", desc: "Estaciones de trabajo y equipos corporativos de alto rendimiento.", count: "120+ modelos" },
  { icon: Monitor, title: "Notebooks", desc: "Laptops empresariales para equipos de trabajo móvil.", count: "80+ modelos" },
  { icon: Zap, title: "Gaming PCs", desc: "Computadoras gamer con las últimas GPUs del mercado.", count: "45+ configuraciones" },
  { icon: Server, title: "Servidores", desc: "Infraestructura de servidores rack, torre y blade.", count: "30+ soluciones" },
  { icon: Network, title: "Networking", desc: "Switches, routers y equipamiento de red empresarial.", count: "60+ productos" },
  { icon: Cpu, title: "Componentes", desc: "Procesadores, memorias, almacenamiento y más.", count: "500+ componentes" },
];

const services = [
  { icon: Building2, title: "Consultoría IT", desc: "Asesoramiento estratégico para la transformación digital de su organización.", number: "01" },
  { icon: Server, title: "Infraestructura", desc: "Diseño e implementación de data centers, servidores y almacenamiento.", number: "02" },
  { icon: Shield, title: "Ciberseguridad", desc: "Protección integral: firewalls, auditorías y políticas de seguridad.", number: "03" },
  { icon: Headphones, title: "Soporte 24/7", desc: "Mesa de ayuda, soporte on-site y mantenimiento con SLA garantizado.", number: "04" },
];

const stats = [
  { value: "500+", label: "Empresas confían en nosotros" },
  { value: "15", label: "Años de trayectoria" },
  { value: "98%", label: "Índice de satisfacción" },
  { value: "24/7", label: "Soporte disponible" },
];

const trustItems = [
  "Distribuidores Autorizados",
  "Garantía Oficial de Fábrica",
  "Envíos a Todo el País",
  "Facturación A y B",
  "Soporte Post-Venta",
];

const Index = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative overflow-hidden min-h-[90vh] flex items-center">
        {/* Background layers */}
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="h-full w-full object-cover opacity-30" loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
          <div className="absolute inset-0 hero-radial" />
        </div>

        {/* Grid overlay */}
        <div className="absolute inset-0 hero-grid opacity-40" />

        {/* Content */}
        <div className="relative container mx-auto px-4 py-32 md:py-40 lg:py-48 lg:px-8">
          <motion.div
            initial="hidden"
            animate="visible"
            className="max-w-4xl"
          >
            <motion.div variants={fadeUp} custom={0}>
              <span className="enterprise-badge mb-8 inline-flex">
                <Globe size={12} />
                Soluciones IT Corporativas
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl"
            >
              Tecnología que impulsa{" "}
              <br className="hidden md:block" />
              <span className="text-gradient">el futuro de su empresa</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-7 max-w-xl text-lg text-muted-foreground leading-relaxed md:text-xl"
            >
              Hardware empresarial, infraestructura de redes, servidores y consultoría IT. 
              Soluciones integrales respaldadas por las mejores marcas del mercado.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="mt-10 flex flex-wrap gap-4">
              <Link to="/cotizacion">
                <Button size="lg" className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 glow-sm h-12 px-8 text-sm">
                  Solicitar Cotización <ArrowRight className="ml-2" size={16} />
                </Button>
              </Link>
              <Link to="/productos">
                <Button size="lg" variant="outline" className="border-border/60 text-foreground hover:bg-secondary h-12 px-8 text-sm">
                  Explorar Productos
                </Button>
              </Link>
            </motion.div>

            {/* Mini trust */}
            <motion.div
              variants={fadeUp}
              custom={4}
              className="mt-16 flex flex-wrap items-center gap-x-8 gap-y-3"
            >
              {["Dell", "HP", "Lenovo", "Cisco", "Intel"].map((brand) => (
                <span key={brand} className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">
                  {brand}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative">
        <div className="section-divider" />
        <div className="bg-surface">
          <div className="container mx-auto px-4 py-16 lg:px-8 lg:py-20">
            <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="text-center"
                >
                  <div className="stat-number text-4xl md:text-5xl">{stat.value}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
        <div className="section-divider" />
      </section>

      {/* Product Categories */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Catálogo de Productos"
            title="Hardware empresarial de"
            highlight="alto rendimiento"
            description="Equipamiento tecnológico de las mejores marcas para cada área de su organización."
            large
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {productCategories.map((cat, i) => (
              <motion.div
                key={cat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.5 }}
              >
                <Link
                  to="/productos"
                  className="group card-enterprise flex flex-col rounded-xl p-7"
                >
                  <div className="flex items-start justify-between">
                    <div className="icon-container h-12 w-12 text-primary">
                      <cat.icon size={22} />
                    </div>
                    <ArrowRight size={16} className="text-muted-foreground/30 transition-all group-hover:text-primary group-hover:translate-x-1" />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold text-foreground">{cat.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{cat.desc}</p>
                  <span className="mt-4 text-xs font-medium text-primary/70">{cat.count}</span>
                </Link>
              </motion.div>
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <Link to="/productos">
              <Button variant="outline" className="border-border/60 text-foreground hover:bg-secondary h-11 px-6 text-sm">
                Ver Catálogo Completo <ArrowRight size={14} className="ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Services */}
      <section className="relative">
        <div className="section-divider" />
        <div className="bg-surface py-24 lg:py-32">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid gap-16 lg:grid-cols-2 lg:items-start">
              <div className="lg:sticky lg:top-32">
                <SectionHeading
                  badge="Servicios Profesionales"
                  title="Servicios IT para empresas"
                  highlight="que escalan"
                  description="Desde la consultoría inicial hasta el soporte continuo, acompañamos a su empresa en cada etapa de su crecimiento tecnológico."
                  center={false}
                />
                <Link to="/servicios-it">
                  <Button className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 h-11 px-6 text-sm">
                    Conocer Servicios <ArrowRight size={14} className="ml-2" />
                  </Button>
                </Link>
              </div>

              <div className="space-y-4">
                {services.map((svc, i) => (
                  <motion.div
                    key={svc.title}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="card-enterprise rounded-xl p-6 lg:p-7"
                  >
                    <div className="flex items-start gap-5">
                      <span className="font-display text-3xl font-extrabold text-border/80">{svc.number}</span>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="icon-container h-9 w-9 text-primary">
                            <svc.icon size={16} />
                          </div>
                          <h3 className="font-display text-base font-semibold text-foreground">{svc.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{svc.desc}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="section-divider" />
      </section>

      {/* Enterprise CTA */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-2xl border border-border/40 bg-card p-12 md:p-20"
          >
            {/* Background effects */}
            <div className="absolute inset-0 hero-grid opacity-20" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 blur-[100px] rounded-full" />

            <div className="relative text-center">
              <span className="enterprise-badge mb-6 inline-flex">
                <TrendingUp size={12} />
                Potencie su Infraestructura
              </span>
              <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl lg:text-5xl tracking-tight">
                ¿Listo para transformar la
                <br className="hidden sm:block" />
                <span className="text-gradient"> tecnología de su empresa?</span>
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-muted-foreground leading-relaxed">
                Nuestro equipo de especialistas está preparado para diseñar la solución tecnológica que su empresa necesita.
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-4">
                <Link to="/cotizacion">
                  <Button size="lg" className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 glow-sm h-12 px-8 text-sm">
                    Solicitar Cotización
                  </Button>
                </Link>
                <Link to="/contacto">
                  <Button size="lg" variant="outline" className="border-border/60 text-foreground hover:bg-secondary h-12 px-8 text-sm">
                    Hablar con un Especialista
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust */}
      <section className="relative">
        <div className="section-divider" />
        <div className="bg-surface py-12">
          <div className="container mx-auto px-4 lg:px-8 text-center">
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {trustItems.map((item) => (
                <span key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 size={14} className="text-primary/70" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
