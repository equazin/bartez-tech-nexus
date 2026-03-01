import { motion } from "framer-motion";
import { Shield, Award, Clock, Users, Handshake, BadgeCheck, BarChart3, Headphones } from "lucide-react";
import SectionHeading from "./SectionHeading";

const trustPillars = [
  { icon: Shield, title: "Seguridad Garantizada", desc: "Protocolos de seguridad empresarial, auditorías y cumplimiento normativo en cada implementación." },
  { icon: Award, title: "Certificaciones Oficiales", desc: "Partner autorizado de Dell, HP, Lenovo, Cisco e Intel con técnicos certificados por cada fabricante." },
  { icon: Clock, title: "SLA Garantizado", desc: "Tiempos de respuesta definidos contractualmente. Soporte crítico en menos de 4 horas." },
  { icon: Users, title: "Ejecutivo Dedicado", desc: "Cada cliente corporativo cuenta con un ejecutivo de cuenta y un equipo técnico asignado." },
];

const expertise = [
  { icon: BarChart3, value: "2,500+", label: "Proyectos completados" },
  { icon: Handshake, value: "500+", label: "Clientes corporativos" },
  { icon: BadgeCheck, value: "50+", label: "Certificaciones técnicas" },
  { icon: Headphones, value: "99.7%", label: "Uptime garantizado" },
];

const partnerBrands = [
  { name: "Dell Technologies", tier: "Platinum Partner" },
  { name: "HP Enterprise", tier: "Gold Partner" },
  { name: "Lenovo", tier: "Authorized Partner" },
  { name: "Cisco Systems", tier: "Select Partner" },
  { name: "Intel", tier: "Technology Partner" },
  { name: "Microsoft", tier: "Silver Partner" },
];

const CorporateClients = () => {
  return (
    <section className="relative">
      <div className="section-divider" />
      <div className="bg-surface py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Confianza Corporativa"
            title="La solidez de un partner con"
            highlight="15+ años de experiencia"
            description="Las empresas más exigentes nos eligen por nuestra trayectoria, confiabilidad técnica y compromiso con los resultados."
            large
          />

          {/* Trust Pillars */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-16">
            {trustPillars.map((pillar, i) => (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="card-glass rounded-xl p-6"
              >
                <div className="icon-container h-11 w-11 text-primary mb-4">
                  <pillar.icon size={20} />
                </div>
                <h3 className="font-display text-sm font-semibold text-foreground">{pillar.title}</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{pillar.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Expertise Numbers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-border/30 bg-card p-8 lg:p-10 mb-16"
          >
            <div className="text-center mb-8">
              <h3 className="font-display text-lg font-bold text-foreground md:text-xl">
                Respaldados por <span className="text-gradient">resultados comprobables</span>
              </h3>
              <p className="mt-2 text-xs text-muted-foreground">Cifras que reflejan nuestro compromiso con la excelencia operativa.</p>
            </div>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {expertise.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="text-center"
                >
                  <div className="icon-container h-9 w-9 text-primary mx-auto mb-3">
                    <item.icon size={16} />
                  </div>
                  <div className="stat-number text-2xl md:text-3xl">{item.value}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{item.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Partner Brands */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl border border-border/30 bg-card p-8 lg:p-10"
          >
            <div className="text-center mb-8">
              <h3 className="font-display text-lg font-bold text-foreground md:text-xl">
                Alianzas estratégicas con <span className="text-gradient">líderes globales</span>
              </h3>
              <p className="mt-2 text-xs text-muted-foreground">Distribuidores autorizados con acceso directo a fábrica, garantía oficial y soporte técnico especializado.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {partnerBrands.map((brand, i) => (
                <motion.div
                  key={brand.name}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  className="flex flex-col items-center justify-center rounded-xl border border-border/20 bg-surface p-4 text-center transition-all hover:border-primary/15"
                >
                  <span className="font-display text-xs font-semibold text-foreground">{brand.name}</span>
                  <span className="mt-1 text-[9px] font-medium uppercase tracking-widest text-primary/60">{brand.tier}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
      <div className="section-divider" />
    </section>
  );
};

export default CorporateClients;