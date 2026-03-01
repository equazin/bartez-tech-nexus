import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import SectionHeading from "./SectionHeading";

const testimonials = [
  {
    quote: "Bartez Tecnología equipó nuestras 12 sucursales con infraestructura de red y puestos de trabajo en tiempo récord. Su equipo técnico es de primer nivel.",
    author: "María González",
    role: "CTO",
    company: "Grupo Financiero del Sur",
  },
  {
    quote: "Llevamos 8 años trabajando con Bartez como nuestro partner IT. La calidad del soporte y los tiempos de respuesta son excepcionales.",
    author: "Carlos Méndez",
    role: "Director de Tecnología",
    company: "Laboratorios Pharma Plus",
  },
  {
    quote: "La consultoría de infraestructura que nos brindaron transformó nuestra operación. Redujimos costos un 35% y mejoramos el uptime al 99.9%.",
    author: "Laura Vásquez",
    role: "Gerente de Operaciones IT",
    company: "Logística Nacional S.A.",
  },
];

const ClientTestimonials = () => {
  return (
    <section className="relative">
      <div className="section-divider" />
      <div className="bg-surface py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Clientes Corporativos"
            title="Lo que dicen nuestros"
            highlight="clientes"
            description="La confianza de empresas líderes respalda nuestra trayectoria de más de 15 años."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.author}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="card-glass rounded-xl p-6 lg:p-7 flex flex-col"
              >
                <Quote size={20} className="text-primary/25 mb-3" />
                <p className="text-xs text-secondary-foreground leading-relaxed flex-1">"{t.quote}"</p>
                <div className="mt-5 pt-4 border-t border-border/30">
                  <p className="font-display text-xs font-semibold text-foreground">{t.author}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t.role} — {t.company}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      <div className="section-divider" />
    </section>
  );
};

export default ClientTestimonials;