import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Monitor, Laptop, Gamepad2, Server, Network, Mouse, Cpu, ArrowRight } from "lucide-react";
import Layout from "@/components/Layout";
import SectionHeading from "@/components/SectionHeading";

const categories = [
  { icon: Monitor, title: "Desktop PCs", desc: "Equipos de escritorio para oficinas, estaciones de trabajo y uso profesional. Configuraciones personalizadas según las necesidades de su empresa.", features: ["Equipos corporativos", "Workstations", "All-in-One", "Configuración a medida"] },
  { icon: Laptop, title: "Notebooks", desc: "Laptops corporativas de las mejores marcas. Ideales para equipos de trabajo móvil y ejecutivos.", features: ["Ultrabooks", "Notebooks corporativas", "Laptops de alto rendimiento", "Equipos refurbished"] },
  { icon: Gamepad2, title: "Gaming PCs", desc: "Computadoras gamer de alta performance con las últimas GPU y procesadores del mercado.", features: ["PCs Gamer armadas", "Notebooks Gaming", "Monitores gaming", "Accesorios gamer"] },
  { icon: Network, title: "Networking", desc: "Equipamiento completo para redes empresariales. Switches, routers, access points y más.", features: ["Switches gestionables", "Routers empresariales", "Access Points", "Cableado estructurado"] },
  { icon: Server, title: "Servidores & Infraestructura", desc: "Soluciones de servidor para empresas de todos los tamaños. Rack, torre y blade.", features: ["Servidores rack", "Servidores torre", "Storage", "UPS y energía"] },
  { icon: Mouse, title: "Periféricos", desc: "Teclados, mouse, monitores, auriculares y todos los accesorios que su equipo necesita.", features: ["Monitores", "Teclados y mouse", "Auriculares", "Webcams"] },
  { icon: Cpu, title: "Componentes", desc: "Procesadores, memorias, discos, placas de video y todos los componentes para armar o actualizar equipos.", features: ["Procesadores", "Memorias RAM", "Discos SSD/HDD", "Placas de video"] },
];

const Products = () => {
  return (
    <Layout>
      <section className="py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Catálogo"
            title="Nuestros"
            highlight="Productos"
            description="Descubra nuestra amplia variedad de productos tecnológicos para empresas. Trabajamos con las mejores marcas del mercado."
          />
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat, i) => (
              <motion.div
                key={cat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group rounded-xl border border-border/50 bg-card p-6 transition-all hover:border-primary/30"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <cat.icon size={28} />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground">{cat.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{cat.desc}</p>
                <ul className="mt-4 space-y-1.5">
                  {cat.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-secondary-foreground">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/cotizacion"
                  className="mt-5 flex items-center text-sm font-medium text-primary transition-opacity hover:underline"
                >
                  Solicitar cotización <ArrowRight size={14} className="ml-1" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Products;
