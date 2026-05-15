import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Shield, Server, Monitor, Headphones, CheckCircle2, Building2, Network, TrendingUp, Briefcase, Settings, ClipboardCheck, Store, PackageCheck, ScanBarcode, Printer, ScanLine, BarChart3, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import EnterpriseCTA from "@/components/EnterpriseCTA";
import CorporateClients from "@/components/CorporateClients";
import IndustriesServed from "@/components/IndustriesServed";
import WorkMethodology from "@/components/WorkMethodology";
import FeaturedProducts from "@/components/FeaturedProducts";
import HeroContactForm from "@/components/HeroContactForm";
import ProductCounter from "@/components/ProductCounter";
import ITSavingsCalculator from "@/components/ITSavingsCalculator";
import FAQSection from "@/components/FAQSection";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import heroBg from "@/assets/hero-bg.png";
import { trackCTAClick } from "@/lib/marketingTracker";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: "easeOut" as const },
  }),
};

const corporateSolutions = [
  { icon: Server, title: "Infraestructura IT", desc: "Diseño e implementación de servidores, almacenamiento y data centers adaptados a su operación.", link: "/soluciones-corporativas" },
  { icon: Network, title: "Redes Corporativas", desc: "Conectividad LAN/WAN, WiFi empresarial, VPN y seguridad perimetral para su organización.", link: "/soluciones-corporativas" },
  { icon: Monitor, title: "Equipamiento Corporativo", desc: "Provisión integral de estaciones de trabajo, notebooks y periféricos para toda su empresa.", link: "/tecnologia" },
  { icon: Settings, title: "Consultoría Tecnológica", desc: "Análisis, planificación y roadmap tecnológico para potenciar el crecimiento de su organización.", link: "/servicios-it" },
  { icon: Shield, title: "Ciberseguridad", desc: "Protección integral de datos, firewalls, backup y políticas de seguridad corporativa.", link: "/servicios-it" },
  { icon: Headphones, title: "Soporte IT Continuo", desc: "Mesa de ayuda, mantenimiento preventivo y soporte on-site con SLA garantizado.", link: "/servicios-it" },
];

const services = [
  { icon: ClipboardCheck, title: "Evaluación Tecnológica", desc: "Diagnosticamos su infraestructura actual e identificamos oportunidades de mejora y optimización.", number: "01" },
  { icon: Building2, title: "Gestión de Infraestructura", desc: "Administramos y mantenemos su entorno IT como un departamento de tecnología dedicado.", number: "02" },
  { icon: Shield, title: "Seguridad y Continuidad", desc: "Protegemos sus datos, sistemas y operaciones con planes de contingencia y recuperación.", number: "03" },
  { icon: Headphones, title: "Soporte Permanente", desc: "Equipo técnico certificado disponible con tiempos de respuesta garantizados por SLA.", number: "04" },
];

const stats = [
  { value: "500+",  label: "Empresas confían en nosotros" },
  { value: "15+",   label: "Años de trayectoria" },
  { value: "98%",   label: "Índice de satisfacción" },
  { value: "24/7",  label: "Soporte disponible" },
  { value: "live",  label: "Productos en catálogo" },
];

const trustItems = [
  "Distribuidores Autorizados",
  "Garantía Oficial de Fábrica",
  "Cobertura en Todo el País",
  "Facturación A y B",
  "Soporte Post-Implementación",
];

const POS_WHATSAPP_URL =
  "https://wa.me/5493415104902?text=Hola%2C%20quiero%20cotizar%20un%20punto%20de%20venta%20completo%20para%20mi%20kiosco%20o%20minisuper.%20Necesito%20equipos%20y%20sistema%20listos%20para%20empezar.";

const posSegments = ["Kioscos", "Minisúper", "Almacenes", "Retail"];

const posHighlights = [
  { icon: Store, title: "Kit completo", desc: "Terminal, pantalla, impresora, lector y cajón preparados para mostrador." },
  { icon: PackageCheck, title: "Sistema listo", desc: "POS configurado para ventas, tickets, caja e inventario inicial." },
  { icon: Headphones, title: "Puesta en marcha", desc: "Acompañamiento para que el comercio empiece a operar sin vueltas." },
];

const posEquipment = [
  { icon: Monitor, label: "Terminal o PC" },
  { icon: Printer, label: "Impresora térmica" },
  { icon: ScanBarcode, label: "Lector de códigos" },
  { icon: Shield, label: "Soporte inicial" },
];

const Index = () => {
  return (
    <>
    <Layout>
      {/* Hero: Portal B2B Focused */}
      <section className="relative flex min-h-[calc(100svh-96px)] items-center overflow-hidden">
        <div className="absolute inset-0">
          <video
            autoPlay muted loop playsInline
            className="h-full w-full object-cover opacity-20"
            poster={heroBg}
          >
            <source src="https://www.pexels.com/download/video/3129957/" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
          <div className="absolute inset-0 hero-radial" />
        </div>
        <div className="absolute inset-0 hero-grid opacity-15" />

        <div className="relative container mx-auto px-4 py-16 md:py-36 lg:py-44 lg:px-8">
          <motion.div initial="hidden" animate="visible" className="mx-auto w-full max-w-[22rem] text-center sm:max-w-4xl">
            <motion.div variants={fadeUp} custom={0} className="flex justify-center">
              <span className="enterprise-badge mb-6 inline-flex max-w-[19rem] items-center justify-center gap-2 whitespace-normal px-3 text-center tracking-[0.1em] sm:mb-8 sm:max-w-full sm:px-4 sm:tracking-[0.15em]">
                <Shield size={12} className="text-primary" />
                <span className="sm:hidden">Portal para empresas</span>
                <span className="hidden sm:inline">Portal Exclusivo para Empresas · Argentina</span>
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="mx-auto max-w-[19rem] text-balance font-display text-[2.1rem] font-extrabold leading-[1.08] tracking-tight text-foreground sm:max-w-4xl sm:text-5xl md:text-6xl lg:text-7xl"
            >
              Potencie sus compras IT con nuestro{" "}
              <span className="text-gradient">Portal B2B Inteligente</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="mx-auto mt-6 max-w-[19rem] text-base leading-relaxed text-muted-foreground sm:max-w-2xl md:mt-8 md:text-xl"
            >
              Precios mayoristas, stock en tiempo real y gestión integral de suministros tecnológicos. 
              La herramienta definitiva para el departamento de compras y tecnología.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="mx-auto mt-9 flex max-w-[18rem] flex-col justify-center gap-3 sm:mt-12 sm:max-w-none sm:flex-row sm:flex-wrap sm:gap-4">
              <Link to="/login" className="w-full sm:w-auto">
                <Button size="lg" className="bg-gradient-primary btn-interactive h-14 w-full px-6 text-base font-bold text-primary-foreground glow-md hover:opacity-90 sm:w-auto sm:px-10">
                  Acceder al Portal B2B <ArrowRight className="ml-2" size={18} />
                </Button>
              </Link>
              <Link to="/registrarse" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="btn-interactive h-14 w-full border-primary/30 bg-primary/5 px-6 text-base font-semibold text-foreground hover:bg-primary/10 sm:w-auto sm:px-10"
                  onClick={() => trackCTAClick("home_hero_solicitar_cuenta_b2b")}
                >
                  Solicitar cuenta B2B
                </Button>
              </Link>
            </motion.div>

            <motion.div variants={fadeUp} custom={3.5} className="mx-auto mt-4 flex max-w-[18rem] items-center justify-center gap-2 text-xs text-muted-foreground/80 sm:max-w-none sm:text-sm">
              <span>¿Buscás equipamiento para tu comercio?</span>
              <Link
                to="/puntos-de-venta"
                className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
              >
                <Store size={14} />
                Punto de Venta y BARpos
                <ArrowRight size={12} />
              </Link>
            </motion.div>

            <motion.div variants={fadeUp} custom={4} className="mx-auto mt-10 grid max-w-[18rem] gap-3 text-left sm:mt-14 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center sm:gap-x-10 sm:gap-y-4 sm:text-center">
              {[
                { icon: TrendingUp, label: "Precios Mayoristas Reales" },
                { icon: Store, label: "BARpos para Kioscos y Minisuper" },
                { icon: Shield, label: "Garantía Oficial de Fábrica" }
              ].map((item) => (
                <span key={item.label} className="flex items-center gap-3 text-sm font-medium text-muted-foreground/80">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <item.icon size={12} />
                  </div>
                  {item.label}
                </span>
              ))}
            </motion.div>

            {/* Quick Portal Inquiry */}
            <motion.div variants={fadeUp} custom={5} className="relative mx-auto mt-12 max-w-md px-0 sm:mt-16 sm:px-4">
              <p className="text-xs text-muted-foreground/60 mb-4 uppercase tracking-widest font-semibold">¿Interesado en ser cliente? Déjenos su email:</p>
              <HeroContactForm />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* BARpos + Punto de Venta */}
      <section className="relative py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="card-enterprise rounded-2xl p-7 lg:p-9"
            >
              <div className="mb-5 flex items-center gap-3">
                <div className="icon-container h-12 w-12 text-primary">
                  <Store size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Punto de Venta</p>
                  <h2 className="font-display text-2xl font-bold text-foreground lg:text-3xl">BARpos para comercios de alta rotacion</h2>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Sistema de venta y kits POS para kioscos, chinos, maxikioscos, almacenes y minisuper. Hardware,
                caja rapida, stock, codigos de barra y reportes en una misma solucion.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/puntos-de-venta">
                  <Button className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 h-11 px-6 text-sm">
                    Ver Punto de Venta <ArrowRight size={14} className="ml-2" />
                  </Button>
                </Link>
                <a href="https://wa.me/5493415104902?text=Hola%2C%20quiero%20conocer%20BARpos%20para%20mi%20comercio." target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="border-border/60 text-foreground hover:bg-secondary h-11 px-6 text-sm">
                    Consultar BARpos
                  </Button>
                </a>
              </div>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: ShoppingCart, title: "Caja rapida", desc: "Venta por codigo, tickets e interfaz pensada para mostrador." },
                { icon: ScanLine, title: "Codigos y stock", desc: "Lectores, etiquetas, reposicion y control diario de inventario." },
                { icon: BarChart3, title: "Reportes BARpos", desc: "Ventas, productos y movimientos para decidir sin planillas." },
                { icon: Store, title: "Kits listos", desc: "Combos con o sin BARpos incluido, configurables desde el admin." },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.45 }}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <item.icon size={20} className="text-primary" />
                  <h3 className="mt-3 text-sm font-bold text-foreground">{item.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats + Brands */}
      <section className="relative">
        <div className="section-divider" />
        <div className="bg-surface">
          <div className="container mx-auto px-4 py-14 lg:px-8 lg:py-16">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-5 mb-12">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="text-center"
                >
                  <div className="stat-number text-3xl md:text-4xl lg:text-5xl">
                    {stat.value === "live" ? <ProductCounter /> : stat.value}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>
            {/* Logos de marcas distribuidas */}
            <div className="border-t border-border/20 pt-10">
              <p className="text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50 font-semibold mb-6">
                Distribuidores autorizados
              </p>
              <div className="overflow-hidden relative">
                <div className="flex animate-[marquee_25s_linear_infinite] w-max gap-x-14">
                  {["Dell", "HP", "Lenovo", "Cisco", "Microsoft", "Intel", "AMD", "Fortinet", "Ubiquiti", "Dell", "HP", "Lenovo", "Cisco", "Microsoft", "Intel", "AMD", "Fortinet", "Ubiquiti"].map((brand, i) => (
                    <span key={i} className="text-sm font-bold uppercase tracking-[0.15em] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors whitespace-nowrap">
                      {brand}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="section-divider" />
      </section>

      {/* Portal Features Grid */}
      <section className="py-20 lg:py-28 bg-gradient-to-b from-transparent to-surface/30">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Ecosistema B2B"
            title="Diseñado para la"
            highlight="agilidad empresarial"
            description="Más que una tienda, una plataforma integral de abastecimiento IT con herramientas exclusivas para su organización."
            large
          />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: TrendingUp, title: "Precios en Tiempo Real", desc: "Acceda a listas de precios actualizadas y descuentos por volumen instantáneos." },
              { icon: Server, title: "Stock Garantizado", desc: "Vea disponibilidad real en nuestros depósitos y reserve equipamiento al instante." },
              { icon: ClipboardCheck, title: "Cotizador Autónomo", desc: "Genere presupuestos formales en PDF para aprobación interna en segundos." },
              { icon: Briefcase, title: "Línea de Crédito", desc: "Gestione sus pagos y acceda a condiciones financieras exclusivas para empresas." },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card-enterprise p-6 rounded-2xl border-primary/5 hover:border-primary/20"
              >
                <div className="icon-container h-12 w-12 text-primary mb-5">
                  <feature.icon size={22} />
                </div>
                <h3 className="font-display font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Point of Sale Solutions */}
      <section className="relative">
        <div className="section-divider" />
        <div className="bg-surface py-20 lg:py-28">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
              <div>
                <SectionHeading
                  badge="Puntos de Venta"
                  title="Puntos de venta completos"
                  highlight="para comercios"
                  description="Equipos y sistema listos para operar en kioscos, minisúper, almacenes y locales que necesitan cobrar, imprimir tickets y controlar stock desde el primer día."
                  center={false}
                />
                <div className="mb-8 flex flex-wrap gap-2">
                  {posSegments.map((segment) => (
                    <span
                      key={segment}
                      className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                    >
                      {segment}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    asChild
                    className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 h-11 px-6 text-sm"
                    onClick={() => trackCTAClick("home_pos_whatsapp_quote")}
                  >
                    <a href={POS_WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                      Cotizar punto de venta <ArrowRight size={14} className="ml-2" />
                    </a>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="border-border/60 text-foreground hover:bg-secondary h-11 px-6 text-sm"
                    onClick={() => trackCTAClick("home_pos_view_page")}
                  >
                    <Link to="/puntos-de-venta">
                      Ver solución POS
                    </Link>
                  </Button>
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.55 }}
                className="card-enterprise overflow-hidden rounded-2xl p-6 lg:p-8"
              >
                <div className="mb-6 flex items-center justify-between gap-4 border-b border-border/40 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="icon-container h-12 w-12 text-primary">
                      <Store size={22} />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-bold text-foreground">Kit POS llave en mano</h3>
                      <p className="text-xs text-muted-foreground">Equipos + sistema + puesta en marcha</p>
                    </div>
                  </div>
                  <span className="hidden rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary sm:inline-flex">
                    Listo para usar
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {posEquipment.map((item) => (
                    <div key={item.label} className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <item.icon size={16} />
                      </div>
                      <span className="text-sm font-medium text-secondary-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {posHighlights.map((highlight, i) => (
                    <div key={highlight.title} className="rounded-xl border border-border/40 bg-card/80 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <highlight.icon size={17} className="text-primary" />
                        <span className="font-display text-lg font-extrabold text-border/70">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <h4 className="font-display text-sm font-semibold text-foreground">{highlight.title}</h4>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{highlight.desc}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
        <div className="section-divider" />
      </section>

      {/* Corporate Solutions (Secondary Support) */}
      <section className="py-20 lg:py-28 relative">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Respaldo Profesional"
            title="El motor humano"
            highlight="detrás del portal"
            description="Complementamos nuestra plataforma con soporte experto e ingeniería de campo para implementaciones complejas."
            center={false}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {corporateSolutions.map((sol, i) => (
              <motion.div
                key={sol.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
              >
                <Link to={sol.link} className="group card-enterprise flex flex-col rounded-xl p-6 lg:p-7 h-full border-white/5">
                  <div className="icon-container h-11 w-11 text-primary mb-4">
                    <sol.icon size={20} />
                  </div>
                  <h3 className="font-display text-sm font-semibold text-foreground">{sol.title}</h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed flex-1">{sol.desc}</p>
                  <span className="mt-4 inline-flex items-center text-xs font-medium text-primary transition-all group-hover:gap-2 gap-1 uppercase tracking-widest">
                    Ver servicio <ArrowRight size={10} />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <FeaturedProducts />

      {/* Work Methodology */}
      <section className="relative">
        <div className="section-divider" />
        <div className="bg-surface py-20 lg:py-28">
          <WorkMethodology />
        </div>
        <div className="section-divider" />
      </section>

      {/* Services — Technology Partnership */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-start">
            <div className="lg:sticky lg:top-32">
              <SectionHeading
                badge="Partnership Tecnológico"
                title="Su departamento IT,"
                highlight="sin contratarlo"
                description="Nos integramos a su operación como un equipo de tecnología externo. Planificamos, implementamos y mantenemos su infraestructura con compromiso de largo plazo."
                center={false}
              />
              <div className="flex flex-wrap gap-3">
                <Link to="/servicios-it">
                  <Button className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 h-10 px-6 text-sm">
                    Conocer Servicios <ArrowRight size={13} className="ml-2" />
                  </Button>
                </Link>
                <Link to="/evaluacion-tecnologica">
                  <Button variant="outline" className="border-border/60 text-foreground hover:bg-secondary h-10 px-6 text-sm">
                    Evaluación Gratuita
                  </Button>
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              {services.map((svc, i) => (
                <motion.div
                  key={svc.title}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="card-enterprise rounded-xl p-5 lg:p-6"
                >
                  <div className="flex items-start gap-4">
                    <span className="font-display text-2xl font-extrabold text-border/70 shrink-0">{svc.number}</span>
                    <div>
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div className="icon-container h-8 w-8 text-primary">
                          <svc.icon size={14} />
                        </div>
                        <h3 className="font-display text-sm font-semibold text-foreground">{svc.title}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{svc.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Corporate Clients & Trust */}
      <CorporateClients />

      {/* Industries Served */}
      <IndustriesServed />

      {/* IT Savings Calculator */}
      <ITSavingsCalculator />

      {/* FAQ */}
      <FAQSection />

      {/* B2B Partner CTA */}
      <section className="relative">
        <div className="section-divider" />
        <div className="bg-surface py-20 lg:py-28">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid gap-5 lg:grid-cols-2">
              <EnterpriseCTA
                badge="Gestión IT Integral"
                badgeIcon={Briefcase}
                title="¿Necesita un partner"
                highlight="tecnológico confiable?"
                description="Nos convertimos en su departamento IT externo. Infraestructura, soporte, seguridad y planificación tecnológica — todo bajo un mismo acuerdo."
                primaryLabel="Solicitar Evaluación"
                primaryTo="/evaluacion-tecnologica"
                variant="compact"
              />
              <EnterpriseCTA
                badge="Transformación Digital"
                badgeIcon={Settings}
                title="¿Planifica modernizar"
                highlight="su infraestructura?"
                description="Nuestro equipo de consultores certificados diseña el roadmap tecnológico que su empresa necesita para escalar."
                primaryLabel="Hablar con un Consultor"
                primaryTo="/contacto"
                variant="compact"
              />
            </div>
          </div>
        </div>
        <div className="section-divider" />
      </section>

      {/* Equipamiento + Canal Mayorista — sección unificada */}
      <section className="relative">
        <div className="section-divider" />
        <div className="bg-surface py-20 lg:py-28">
          <div className="container mx-auto px-4 lg:px-8">
            <SectionHeading
              badge="Para empresas e integradores"
              title="Equipamiento y"
              highlight="Canal Mayorista"
              description="Proveemos hardware corporativo y trabajamos bajo modalidad B2B con empresas, integradores y revendedores en todo el país."
            />
            <div className="grid gap-6 lg:grid-cols-2 max-w-5xl mx-auto">
              {/* Col 1: Equipamiento */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="card-enterprise rounded-2xl p-8"
              >
                <div className="icon-container h-11 w-11 text-primary mb-5">
                  <Monitor size={20} />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">Equipamiento Corporativo</h3>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                  Notebooks, servidores, networking y hardware especializado para toda su empresa, con garantía oficial de fábrica y soporte post-entrega.
                </p>
                <ul className="space-y-2 mb-6">
                  {["Distribuidores autorizados Dell, HP, Lenovo, Cisco", "Stock disponible y entrega en todo el país", "Cotizaciones en 24hs hábiles"].map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-secondary-foreground">
                      <CheckCircle2 size={14} className="text-primary shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <a href="https://wa.me/5493415104902?text=Hola%2C%20quiero%20consultar%20por%20equipamiento%20tecnol%C3%B3gico." target="_blank" rel="noopener noreferrer">
                  <Button className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 h-10 px-5 text-sm">
                    Consultar equipamiento <ArrowRight size={13} className="ml-2" />
                  </Button>
                </a>
              </motion.div>

              {/* Col 2: Canal Mayorista */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="card-enterprise rounded-2xl p-8"
              >
                <div className="icon-container h-11 w-11 text-primary mb-5">
                  <Briefcase size={20} />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">Canal B2B y Mayorista</h3>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                  Acompañamos a integradores y revendedores con precios preferenciales, soporte técnico y condiciones especiales para proyectos de escala.
                </p>
                <ul className="space-y-2 mb-6">
                  {["Precios mayoristas para integradores", "Asesoramiento técnico para proyectos", "Atención personalizada y cuenta dedicada"].map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-secondary-foreground">
                      <CheckCircle2 size={14} className="text-primary shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <a href="https://wa.me/5493415104902?text=Hola%2C%20quiero%20consultar%20sobre%20provisi%C3%B3n%20mayorista%20de%20equipamiento." target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="border-border/60 text-foreground hover:bg-secondary h-10 px-5 text-sm">
                    Consultar canal mayorista <ArrowRight size={13} className="ml-2" />
                  </Button>
                </a>
              </motion.div>
            </div>
          </div>
        </div>
        <div className="section-divider" />
      </section>

      {/* B2B Portal Access CTA */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-4xl mx-auto rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-10 lg:p-14 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary mb-5">
              Portal Exclusivo para Clientes
            </span>
            <h2 className="font-display text-2xl lg:text-3xl font-bold text-foreground mb-3">
              ¿Ya es cliente? Acceda a su{" "}
              <span className="text-gradient">Portal B2B</span>
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
              Consulte precios en tiempo real, gestione sus pedidos, descargue facturas y solicite cotizaciones desde un solo lugar — disponible las 24 horas.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link to="/login">
                <Button className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 h-11 px-8 text-sm">
                  Ingresar al Portal B2B <ArrowRight size={14} className="ml-2" />
                </Button>
              </Link>
              <Link to="/registrarse">
                <Button
                  variant="outline"
                  className="border-border/60 text-foreground hover:bg-secondary h-11 px-8 text-sm"
                  onClick={() => trackCTAClick("home_portal_solicitar_cuenta_b2b")}
                >
                  Solicitar cuenta B2B
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Enterprise CTA */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <EnterpriseCTA
            badge="Comience Hoy"
            badgeIcon={TrendingUp}
            title="¿Listo para profesionalizar la"
            highlight="tecnología de su empresa?"
            description="Más de 500 empresas ya confían en nosotros como su partner tecnológico. Solicite una evaluación sin cargo y descubra cómo podemos optimizar su infraestructura."
            primaryLabel="Solicitar Evaluación Tecnológica"
            primaryTo="/evaluacion-tecnologica"
            secondaryLabel="Hablar con un Especialista"
            secondaryTo="/contacto"
          />
        </div>
      </section>

      {/* Trust Footer Bar */}
      <section className="relative">
        <div className="section-divider" />
        <div className="bg-surface py-10">
          <div className="container mx-auto px-4 lg:px-8 text-center">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {trustItems.map((item) => (
                <span key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 size={12} className="text-primary/60" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Layout>

    {/* WhatsApp floating button */}
    <WhatsAppFloat />
    </>
  );
};

export default Index;
