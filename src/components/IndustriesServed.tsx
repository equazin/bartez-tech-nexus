import { motion } from "framer-motion";
import { Building2, Landmark, GraduationCap, Heart, Factory, ShoppingCart, Plane, Banknote } from "lucide-react";
import SectionHeading from "./SectionHeading";

const industries = [
  { icon: Banknote, name: "Finanzas & Banca", desc: "Infraestructura crítica para operaciones financieras 24/7." },
  { icon: Landmark, name: "Sector Público", desc: "Soluciones tecnológicas para organismos gubernamentales." },
  { icon: Heart, name: "Salud", desc: "Equipamiento IT para hospitales, clínicas y laboratorios." },
  { icon: GraduationCap, name: "Educación", desc: "Tecnología para instituciones educativas y universidades." },
  { icon: Factory, name: "Industria & Manufactura", desc: "Automatización y sistemas de control industrial." },
  { icon: ShoppingCart, name: "Retail & Comercio", desc: "Infraestructura POS, redes y gestión de sucursales." },
  { icon: Plane, name: "Logística & Transporte", desc: "Conectividad y seguimiento en operaciones distribuidas." },
  { icon: Building2, name: "Corporativo & Oficinas", desc: "Equipamiento integral de puestos de trabajo y data centers." },
];

const IndustriesServed = () => {
  return (
    <section className="py-24 lg:py-32">
      <div className="container mx-auto px-4 lg:px-8">
        <SectionHeading
          badge="Industrias"
          title="Experiencia en los sectores más"
          highlight="exigentes"
          description="Más de 15 años brindando soluciones tecnológicas especializadas a las principales industrias del país."
          large
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {industries.map((ind, i) => (
            <motion.div
              key={ind.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              className="card-enterprise rounded-xl p-6 group"
            >
              <div className="icon-container h-11 w-11 text-primary mb-4">
                <ind.icon size={20} />
              </div>
              <h3 className="font-display text-sm font-semibold text-foreground">{ind.name}</h3>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{ind.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default IndustriesServed;
