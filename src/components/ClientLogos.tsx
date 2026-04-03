import { motion } from "framer-motion";

// Real client logos represented as styled text badges — replace with actual <img> when logos are available
const clients = [
  { name: "Constructora Regional",  sector: "Construcción" },
  { name: "Clínica Privada Norte",  sector: "Salud" },
  { name: "Estudio J&A",            sector: "Legal" },
  { name: "Logística del Sur",      sector: "Logística" },
  { name: "Agencia Media Plus",     sector: "Marketing" },
  { name: "Industrias Rosarito",    sector: "Manufactura" },
  { name: "Grupo Inmobiliario AR",  sector: "Real Estate" },
  { name: "Tecno Distribuidora",    sector: "Distribución" },
];

export default function ClientLogos() {
  return (
    <section className="py-14 border-y border-border/20 bg-surface/50">
      <div className="container mx-auto px-4 lg:px-8">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/40 mb-8">
          Empresas que confían en Bartez
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {clients.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="flex flex-col items-center justify-center rounded-xl border border-border/30 bg-card/40 px-3 py-4 text-center hover:border-border/60 hover:bg-card/70 transition-colors"
            >
              <p className="text-xs font-semibold text-foreground/70 leading-tight">{c.name}</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{c.sector}</p>
            </motion.div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground/40 mt-6">
          +500 empresas en Argentina confían en Bartez como su partner tecnológico.
        </p>
      </div>
    </section>
  );
}
