import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import SectionHeading from "@/components/SectionHeading";

const faqs = [
  {
    q: "¿Qué diferencia a Bartez de una empresa de soporte IT tradicional?",
    a: "Bartez actúa como un departamento IT externo, no como un proveedor reactivo. Planificamos, implementamos y mantenemos toda la infraestructura con compromiso de largo plazo, SLAs definidos y un consultor dedicado a cada cuenta. No respondemos a tickets: prevenimos los problemas.",
  },
  {
    q: "¿Cuánto demora una implementación típica?",
    a: "Depende del alcance del proyecto. Una red corporativa para 50 usuarios se implementa en 1-2 semanas. Un proyecto de infraestructura completo (servidores + red + seguridad) puede llevar 4-8 semanas incluyendo planificación. Damos plazos reales, no optimistas.",
  },
  {
    q: "¿Trabajamos fuera de Rosario?",
    a: "Sí. Atendemos clientes en todo el país. Para proyectos fuera de Rosario, combinamos trabajo remoto con visitas técnicas programadas según el alcance. Muchos de nuestros clientes en Buenos Aires, Córdoba y Mendoza operan 100% con soporte remoto.",
  },
  {
    q: "¿Necesito tener conocimientos técnicos para trabajar con Bartez?",
    a: "No. Nuestro trabajo es traducir las necesidades de su empresa a soluciones tecnológicas concretas. Vos nos contás los problemas del negocio, nosotros diseñamos e implementamos la solución. Sin tecnicismos innecesarios.",
  },
  {
    q: "¿Qué pasa si ya tengo un proveedor IT?",
    a: "Podemos trabajar en conjunto, reemplazar un proveedor que no cumple expectativas, o hacer una auditoría de la infraestructura actual. Muchos clientes nos contratan para complementar o mejorar lo que ya tienen.",
  },
  {
    q: "¿Cómo funciona el portal B2B para revendedores e integradores?",
    a: "El portal B2B de Bartez permite a integradores y revendedores acceder a precios mayoristas, gestionar cotizaciones, hacer pedidos y ver stock en tiempo real. El acceso es por invitación — solicitalo por WhatsApp o desde la sección de registro.",
  },
  {
    q: "¿Tienen stock local o importan a pedido?",
    a: "Tenemos más de 14.000 productos disponibles en nuestro catálogo con stock local en Argentina. Los productos más demandados (notebooks, switches, servidores) tienen disponibilidad inmediata. Para proyectos específicos coordinamos con anticipación.",
  },
  {
    q: "¿Qué garantías ofrecen en los equipos?",
    a: "Todos los productos se comercializan con garantía oficial de fábrica del fabricante en Argentina. Adicionalmente, ofrecemos soporte post-venta y gestión de RMA para reemplazos en garantía sin que el cliente tenga que lidiar con el proceso.",
  },
];

function FAQItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className={`rounded-xl border transition-colors ${open ? "border-primary/30 bg-primary/4" : "border-border/30 bg-card/40 hover:border-border/50"}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="font-medium text-sm text-foreground leading-snug">{q}</span>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 mt-0.5"
        >
          <ChevronDown size={16} className={open ? "text-primary" : "text-muted-foreground"} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className="py-20 lg:py-28">
      <div className="container mx-auto px-4 lg:px-8">
        <SectionHeading
          badge="Preguntas Frecuentes"
          title="Todo lo que necesitás"
          highlight="saber"
          description="Las preguntas más comunes de empresas antes de trabajar con nosotros."
        />
        <div className="max-w-3xl mx-auto space-y-2">
          {faqs.map((faq, i) => (
            <FAQItem
              key={i}
              q={faq.q}
              a={faq.a}
              open={openIdx === i}
              onToggle={() => setOpenIdx(openIdx === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
