import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calculator, ArrowRight, TrendingDown, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import SectionHeading from "@/components/SectionHeading";

const EMPLOYEE_OPTIONS = [
  { id: "5",   label: "1–10",   value: 7 },
  { id: "25",  label: "11–50",  value: 25 },
  { id: "100", label: "51–200", value: 100 },
  { id: "300", label: "200+",   value: 300 },
];

const PAIN_OPTIONS = [
  { id: "support",  label: "Soporte lento o caro",  costPerUser: 120 },
  { id: "downtime", label: "Caídas frecuentes",       costPerUser: 200 },
  { id: "security", label: "Riesgos de seguridad",   costPerUser: 150 },
  { id: "old",      label: "Equipos desactualizados",costPerUser: 80  },
  { id: "no_it",    label: "Sin IT dedicado",         costPerUser: 180 },
];

// Estimated savings rate Bartez delivers vs typical unmanaged IT spend
const SAVINGS_RATE = 0.35;

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium border transition-all
        ${selected ? "border-primary/60 bg-primary/10 text-primary" : "border-border/40 bg-card text-muted-foreground hover:border-border/70"}`}
    >
      {children}
    </button>
  );
}

export default function ITSavingsCalculator() {
  const [employees, setEmployees] = useState("");
  const [pains, setPains]         = useState<string[]>([]);
  const [shown, setShown]         = useState(false);

  const togglePain = (id: string) =>
    setPains(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const result = useMemo(() => {
    if (!employees || pains.length === 0) return null;
    const emp = EMPLOYEE_OPTIONS.find(e => e.id === employees)?.value ?? 0;
    const costPerUser = pains.reduce((acc, id) => {
      return acc + (PAIN_OPTIONS.find(p => p.id === id)?.costPerUser ?? 0);
    }, 0);
    const currentAnnual = emp * costPerUser * 12;
    const savings = Math.round(currentAnnual * SAVINGS_RATE);
    return { currentAnnual, savings, emp };
  }, [employees, pains]);

  const canCalculate = employees && pains.length > 0;

  return (
    <section className="relative">
      <div className="section-divider" />
      <div className="bg-surface py-20 lg:py-28">
        <div className="container mx-auto px-4 lg:px-8">
          <SectionHeading
            badge="Calculadora de Ahorro IT"
            title="¿Cuánto podrías"
            highlight="ahorrar con Bartez?"
            description="Estimá en 30 segundos cuánto gasta tu empresa en IT desorganizado y cuánto podés ahorrar con un partner profesional."
          />

          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm p-8 space-y-7">

              {/* Employees */}
              <div>
                <p className="text-sm font-medium text-foreground/80 mb-3">¿Cuántos empleados tiene la empresa?</p>
                <div className="flex flex-wrap gap-2">
                  {EMPLOYEE_OPTIONS.map(e => (
                    <Chip key={e.id} selected={employees === e.id} onClick={() => { setEmployees(e.id); setShown(false); }}>
                      {e.label}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* Pains */}
              <div>
                <p className="text-sm font-medium text-foreground/80 mb-3">¿Cuáles son sus problemas IT actuales?</p>
                <div className="flex flex-wrap gap-2">
                  {PAIN_OPTIONS.map(p => (
                    <Chip key={p.id} selected={pains.includes(p.id)} onClick={() => { togglePain(p.id); setShown(false); }}>
                      {p.label}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <button
                type="button"
                disabled={!canCalculate}
                onClick={() => setShown(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-primary h-12 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Calculator size={15} /> Calcular ahorro estimado
              </button>

              {/* Result */}
              <AnimatePresence>
                {shown && result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.35 }}
                    className="rounded-xl border border-primary/20 bg-primary/5 p-6"
                  >
                    <div className="grid sm:grid-cols-2 gap-5 mb-5">
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">Costo IT estimado actual</p>
                        <p className="font-display text-2xl font-extrabold text-foreground">
                          USD {result.currentAnnual.toLocaleString("en-US")}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">por año ({result.emp} empleados)</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70 mb-1">Ahorro potencial con Bartez</p>
                        <p className="font-display text-2xl font-extrabold text-primary flex items-center justify-center gap-1">
                          <TrendingDown size={20} />
                          USD {result.savings.toLocaleString("en-US")}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">aprox. {Math.round(SAVINGS_RATE * 100)}% de reducción</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 text-center mb-4">
                      * Estimación basada en costos promedio de IT no gestionado en Argentina. Los ahorros reales varían según cada empresa.
                    </p>
                    <Link to="/evaluacion-tecnologica">
                      <button className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-primary h-11 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
                        <DollarSign size={14} /> Obtener evaluación real gratuita <ArrowRight size={13} />
                      </button>
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      <div className="section-divider" />
    </section>
  );
}
