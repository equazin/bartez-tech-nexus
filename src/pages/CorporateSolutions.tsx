import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Building2, Network, Shield, Server, Monitor, HeadphonesIcon, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";

const solutions = [
  { icon: Building2, title: "Equipamiento de Oficinas", desc: "Provisión completa de equipos para oficinas. PCs, notebooks, monitores, periféricos y mobiliario tecnológico." },
  { icon: Network, title: "Redes Corporativas", desc: "Diseño e implementación de redes LAN/WAN, WiFi empresarial, VPN y conectividad segura." },
  { icon: Server, title: "Data Center", desc: "Soluciones de infraestructura de servidores, almacenamiento y virtualización para su centro de datos." },
  { icon: Shield, title: "Ciberseguridad", desc: "Protección integral de datos, firewalls, antivirus corporativo y políticas de seguridad." },
  { icon: Monitor, title: "Salas de Reuniones", desc: "Equipamiento audiovisual, sistemas de videoconferencia y colaboración para salas de reuniones." },
  { icon: HeadphonesIcon, title: "Soporte Dedicado", desc: "Mesa de ayuda, soporte on-site y mantenimiento preventivo con SLA garantizado." },
];

const CorporateSolutions = () => {
  return (
    <Layout>
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Corporativo"
            title="Soluciones"
            highlight="Corporativas"
            description="Diseñamos e implementamos soluciones tecnológicas a medida para empresas de todos los tamaños."
          />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {solutions.map((sol, i) => (
              <motion.div
                key={sol.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-xl border border-border/50 bg-card p-6"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <sol.icon size={24} />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground">{sol.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{sol.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="mt-16 text-center">
            <Link to="/cotizacion">
              <Button size="lg" className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90">
                Consultar por Soluciones Corporativas <ArrowRight size={18} className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default CorporateSolutions;
