import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { HandshakeIcon, ArrowRight, CheckCircle2, TrendingUp, Shield, Briefcase, Zap, Package, CreditCard, Truck, Users, LayoutGrid, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import EnterpriseCTA from "@/components/EnterpriseCTA";

const partnerBenefits = [
  { icon: TrendingUp, title: "Precios de Gremio", desc: "Escalas de precios competitivas y márgenes reales para que su negocio crezca." },
  { icon: Shield, title: "Garantía Oficial", desc: "Respaldo directo de los fabricantes líderes con gestión de RMA ágil y transparente." },
  { icon: CreditCard, title: "Línea de Crédito", desc: "Financiamiento flexible y condiciones de pago adaptadas a proyectos de escala." },
  { icon: Truck, title: "Logística Nacional", desc: "Despacho prioritario y envíos a todo el país con seguimiento en tiempo real." },
];

const portalFeatures = [
  { icon: Zap, title: "Stock Real 24/7", desc: "Vea disponibilidad inmediata en nuestros depósitos sin demoras ni consultas externas." },
  { icon: LayoutGrid, title: "Gestión de Proyectos", desc: "Reserve equipamiento para sus pedidos futuros y mantenga su inventario asegurado." },
  { icon: Users, title: "Sub-cuentas Empresa", desc: "Delegue permisos a su equipo de compras manteniendo el control total de las operaciones." },
  { icon: Briefcase, title: "Panel Administrativo", desc: "Descargue facturas, movimientos de cuenta y estados de pedidos en un solo lugar." },
];

const partnerChecklist = [
  "Atención personalizada con Ejecutivo de Cuentas",
  "Capacitaciones y certificaciones de marca",
  "Soporte preventa para licitaciones y pliegos",
  "Entrega 'Vaina Blanca' para sus clientes finales",
  "Acceso a ofertas exclusivas y preventas",
  "Integración vía API para su propio e-commerce",
];

const B2BSolutions = () => {
  return (
    <Layout>
      <section className="page-hero">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Canal Mayorista & Gremio"
            title="El motor de abastecimiento para"
            highlight="integradores y revendedores"
            description="Acceda al portal B2B más avanzado del mercado. Potenciamos su capacidad de respuesta con stock real, logística federal y soporte experto."
            large
          />
          <div className="mt-10 flex justify-center gap-4">
            <Link to="/registrarse">
              <Button size="lg" className="bg-gradient-primary font-bold text-primary-foreground h-12 px-8">
                Postularse como Partner <ArrowRight size={16} className="ml-2" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="h-12 px-8">
                Acceder al Portal
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Partner Benefits Grid */}
      <section className="py-20 lg:py-28 bg-surface/30">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Por qué Bartez Mayorista"
            title="Suministros IT con"
            highlight="respaldo real"
            description="Nos convertimos en el brazo logístico y financiero de su departamento de compras o de su negocio de reventa."
          />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {partnerBenefits.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="card-enterprise rounded-2xl p-7"
              >
                <div className="icon-container h-12 w-12 text-primary mb-5">
                  <feat.icon size={22} />
                </div>
                <h3 className="font-display text-lg font-bold text-foreground mb-2">{feat.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Portal B2B Deep Dive */}
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid gap-16 lg:grid-cols-2 items-center">
            <div>
              <SectionHeading
                badge="Portal B2B Pro"
                title="Gestione toda su operación"
                highlight="en un solo lugar"
                description="Nuestra plataforma está diseñada para el flujo de trabajo moderno. Olvide las consultas por stock y los presupuestos manuales."
                center={false}
              />
              <div className="grid gap-6 sm:grid-cols-2 mt-10">
                {portalFeatures.map((f, i) => (
                  <div key={f.title} className="flex gap-4">
                    <div className="flex-shrink-0 h-10 w-10 icon-container text-primary">
                      <f.icon size={18} />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground text-sm">{f.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative rounded-3xl overflow-hidden border border-primary/20 bg-card p-4 lg:p-6 glow-sm shadow-2xl"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
              <div className="bg-surface/80 rounded-2xl border border-border/50 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-red-500/20" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500/20" />
                    <div className="h-3 w-3 rounded-full bg-green-500/20" />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground/40">bartez-b2b-portal.v1</span>
                </div>
                <div className="space-y-4">
                  <div className="h-8 w-1/3 bg-muted/30 rounded-lg animate-pulse" />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="h-16 bg-muted/20 rounded-xl" />
                    <div className="h-16 bg-muted/20 rounded-xl" />
                    <div className="h-16 bg-muted/20 rounded-xl" />
                  </div>
                  <div className="h-32 bg-muted/10 rounded-xl flex items-center justify-center border border-dashed border-white/5">
                    <Monitor className="text-muted-foreground/20" size={40} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="h-6 w-20 bg-primary/20 rounded-full" />
                    <div className="h-10 w-32 bg-gradient-primary rounded-lg opacity-50" />
                  </div>
                </div>
              </div>
              <p className="text-center mt-6 text-xs font-semibold text-primary/70 uppercase tracking-widest">Vista previa exclusiva para Partners</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Program Benefits Check */}
      <section className="py-20 lg:py-28 bg-surface">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-4xl mx-auto rounded-3xl border border-white/5 bg-card p-10 lg:p-16">
            <h3 className="font-display text-2xl lg:text-3xl font-bold text-foreground text-center mb-12">
              Sea un Partner <span className="text-gradient">Bartez Mayorista</span>
            </h3>
            <div className="grid gap-6 sm:grid-cols-2">
              {partnerChecklist.map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-secondary-foreground">
                  <CheckCircle2 size={18} className="text-primary shrink-0" />
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-14 pt-10 border-t border-white/5 text-center">
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto italic">
                "Apoyamos el crecimiento de integradores en todo el país con las mejores marcas y atención personalizada."
              </p>
              <Link to="/registrarse">
                <Button size="lg" className="bg-gradient-primary font-bold text-primary-foreground h-14 px-10 shadow-lg glow-sm">
                  Solicitar Apertura de Cuenta <ArrowRight size={18} className="ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <EnterpriseCTA
            badge="Respaldo Total"
            badgeIcon={HandshakeIcon}
            title="Lleve su negocio IT al"
            highlight="próximo nivel"
            description="Únase a la red de partners de Bartez. Disponibilidad inmediata, acompañamiento técnico y el Portal B2B más veloz del país."
            primaryLabel="Registrar mi Empresa"
            primaryTo="/registrarse"
            secondaryLabel="Hablar con un Ejecutivo"
            secondaryTo="/contacto"
          />
        </div>
      </section>
    </Layout>
  );
};

export default B2BSolutions;
