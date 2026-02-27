import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Monitor, Laptop, Gamepad2, Server, Network, Mouse, Cpu, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";

const categories = [
  { icon: Monitor, title: "Desktop PCs", desc: "Equipos de escritorio para oficinas, estaciones de trabajo y uso profesional. Configuraciones personalizadas según las necesidades de su empresa.", features: ["Equipos corporativos", "Workstations", "All-in-One", "Configuración a medida"], count: "120+ modelos" },
  { icon: Laptop, title: "Notebooks", desc: "Laptops corporativas de las mejores marcas. Ideales para equipos de trabajo móvil y ejecutivos.", features: ["Ultrabooks", "Notebooks corporativas", "Laptops de alto rendimiento", "Equipos refurbished"], count: "80+ modelos" },
  { icon: Gamepad2, title: "Gaming PCs", desc: "Computadoras gamer de alta performance con las últimas GPU y procesadores del mercado.", features: ["PCs Gamer armadas", "Notebooks Gaming", "Monitores gaming", "Accesorios gamer"], count: "45+ configuraciones" },
  { icon: Network, title: "Networking", desc: "Equipamiento completo para redes empresariales. Switches, routers, access points y más.", features: ["Switches gestionables", "Routers empresariales", "Access Points", "Cableado estructurado"], count: "60+ productos" },
  { icon: Server, title: "Servidores & Infraestructura", desc: "Soluciones de servidor para empresas de todos los tamaños. Rack, torre y blade.", features: ["Servidores rack", "Servidores torre", "Storage", "UPS y energía"], count: "30+ soluciones" },
  { icon: Mouse, title: "Periféricos", desc: "Teclados, mouse, monitores, auriculares y todos los accesorios que su equipo necesita.", features: ["Monitores", "Teclados y mouse", "Auriculares", "Webcams"], count: "200+ productos" },
  { icon: Cpu, title: "Componentes", desc: "Procesadores, memorias, discos, placas de video y todos los componentes para armar o actualizar equipos.", features: ["Procesadores", "Memorias RAM", "Discos SSD/HDD", "Placas de video"], count: "500+ componentes" },
];

const Products = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative py-20 lg:py-28">
        <div className="absolute inset-0 hero-radial" />
        <div className="relative container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Catálogo de Productos"
            title="Equipamiento tecnológico"
            highlight="profesional"
            description="Hardware de las mejores marcas del mercado para satisfacer las necesidades de cada área de su organización."
            large
          />
        </div>
      </section>

      {/* Categories */}
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
                <div className="flex items-start justify-between mb-5">
                  <div className="icon-container-lg h-14 w-14 text-primary">
                    <cat.icon size={26} />
                  </div>
                  <span className="text-xs font-medium text-primary/60">{cat.count}</span>
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
                  to="/cotizacion"
                  className="mt-6 inline-flex items-center text-sm font-medium text-primary transition-all hover:gap-2 gap-1"
                >
                  Solicitar cotización <ArrowRight size={14} />
                </Link>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16 text-center"
          >
            <p className="text-muted-foreground mb-6">¿No encuentra lo que busca? Contáctenos para soluciones personalizadas.</p>
            <Link to="/cotizacion">
              <Button className="bg-gradient-primary font-semibold text-primary-foreground hover:opacity-90 h-11 px-7 text-sm">
                Cotizar Productos <ArrowRight size={14} className="ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Products;
