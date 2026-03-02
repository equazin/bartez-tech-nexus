import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Monitor, Laptop, Server, Network, Cpu, Mouse, ArrowRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";
import EnterpriseCTA from "@/components/EnterpriseCTA";

const categories = [
  { icon: Monitor, title: "Equipos de Escritorio", desc: "Estaciones de trabajo corporativas, workstations y equipos all-in-one para cada rol en su organización.", features: ["Equipos corporativos", "Workstations profesionales", "All-in-One", "Configuración a medida"] },
  { icon: Laptop, title: "Notebooks Corporativas", desc: "Laptops empresariales de las mejores marcas. Ideales para equipos de trabajo móvil, ejecutivos y trabajo remoto.", features: ["Ultrabooks empresariales", "Notebooks corporativas", "Laptops de alto rendimiento", "Equipos certificados"] },
  { icon: Server, title: "Servidores e Infraestructura", desc: "Soluciones de servidor para empresas de todos los tamaños. Infraestructura que soporta su operación crítica.", features: ["Servidores rack y torre", "Almacenamiento empresarial", "UPS y energía", "Virtualización"] },
  { icon: Network, title: "Networking y Conectividad", desc: "Equipamiento completo para redes empresariales. Conectividad segura y de alto rendimiento.", features: ["Switches gestionables", "Routers empresariales", "Access Points", "Cableado estructurado"] },
  { icon: Cpu, title: "Componentes y Upgrades", desc: "Procesadores, memorias, almacenamiento y componentes para ampliar o actualizar la infraestructura existente.", features: ["Procesadores", "Memorias RAM", "Discos SSD/NVMe", "Componentes de servidor"] },
  { icon: Mouse, title: "Periféricos y Accesorios", desc: "Monitores, teclados, docking stations y todo lo necesario para equipar puestos de trabajo productivos.", features: ["Monitores profesionales", "Docking stations", "Periféricos", "Videoconferencia"] },
];

const Products = () => {
  return (
    <Layout>
      <section className="page-hero">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Tecnología Corporativa"
            title="Equipamiento tecnológico para"
            highlight="su empresa"
            description="Provisión integral de hardware de las mejores marcas del mercado. Cada solución se adapta a las necesidades específicas de su organización."
            large
          />
        </div>
      </section>

      {/* Enterprise banner */}
      <section className="pb-12">
        <div className="container mx-auto px-4 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="card-enterprise rounded-xl p-6 lg:p-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="icon-container h-12 w-12 text-primary shrink-0">
                <Building2 size={22} />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold text-foreground">¿Necesita equipar su empresa?</h3>
                <p className="text-sm text-muted-foreground">Solicite una evaluación tecnológica y reciba una propuesta integral adaptada a su operación.</p>
              </div>
            </div>
            <Link to="/evaluacion-tecnologica" className="shrink-0">
              <Button className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 h-11 px-6 text-sm">
                Evaluación Tecnológica <ArrowRight size={14} className="ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="pb-24 lg:pb-32">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat, i) => (
              <motion.div
                key={cat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.5 }}
                className="group card-enterprise rounded-xl p-7"
              >
                <div className="icon-container-lg h-14 w-14 text-primary mb-5">
                  <cat.icon size={26} />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground">{cat.title}</h3>
                <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed">{cat.desc}</p>
                <ul className="mt-5 space-y-2">
                  {cat.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-secondary-foreground">
                      <div className="h-1 w-1 rounded-full bg-primary/50" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/evaluacion-tecnologica"
                  className="mt-6 inline-flex items-center text-sm font-medium text-primary transition-all hover:gap-2 gap-1"
                >
                  Consultar disponibilidad <ArrowRight size={14} />
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="mt-20">
            <EnterpriseCTA
              badge="Provisión Integral"
              badgeIcon={Building2}
              title="¿Necesita equipar múltiples"
              highlight="puestos de trabajo?"
              description="Diseñamos la solución de equipamiento completa para su organización. Desde la evaluación hasta la implementación y soporte continuo."
              primaryLabel="Solicitar Evaluación Tecnológica"
              primaryTo="/evaluacion-tecnologica"
              secondaryLabel="Hablar con un Especialista"
              secondaryTo="/contacto"
              variant="compact"
            />
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Products;
