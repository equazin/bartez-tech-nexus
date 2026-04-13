import { Sparkles, Wallet } from "lucide-react";
import type { BuilderCurrency, BuilderGoal, BuilderPriority } from "@/models/pcBuilder";

interface BuilderStepWizardProps {
  goal: BuilderGoal;
  onGoalChange: (goal: BuilderGoal) => void;
  budgetMin?: number;
  budgetMax?: number;
  onBudgetMinChange: (value?: number) => void;
  onBudgetMaxChange: (value?: number) => void;
  budgetCurrency: BuilderCurrency;
  onBudgetCurrencyChange: (currency: BuilderCurrency) => void;
  priority: BuilderPriority;
  onPriorityChange: (priority: BuilderPriority) => void;
  onGenerateBase: () => void;
}

const GOALS: Array<{ id: BuilderGoal; label: string }> = [
  { id: "office", label: "Oficina" },
  { id: "gaming", label: "Gaming" },
  { id: "workstation", label: "Diseño / Workstation" },
];

const PRIORITIES: Array<{ id: BuilderPriority; label: string }> = [
  { id: "price", label: "Precio" },
  { id: "balanced", label: "Balanceado" },
  { id: "performance", label: "Rendimiento" },
];

function parseInputNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

export function BuilderStepWizard({
  goal,
  onGoalChange,
  budgetMin,
  budgetMax,
  onBudgetMinChange,
  onBudgetMaxChange,
  budgetCurrency,
  onBudgetCurrencyChange,
  priority,
  onPriorityChange,
  onGenerateBase,
}: BuilderStepWizardProps) {
  return (
    <section className="rounded-[24px] border border-border/70 bg-card p-4 md:p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Modo Guiado</p>
      <h2 className="mt-2 text-lg font-bold text-foreground">Definí objetivo, presupuesto y prioridad</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Generamos una base compatible para acelerar la cotización y después podés ajustar cada slot.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">1) Objetivo</p>
          <div className="flex flex-wrap gap-2">
            {GOALS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => onGoalChange(id)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  goal === id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70 bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">2) Presupuesto</p>
          <div className="grid gap-2 sm:grid-cols-[auto_1fr_1fr] sm:items-center">
            <div className="inline-flex w-fit items-center gap-1 rounded-xl border border-border/70 bg-background p-1">
              {(["ARS", "USD"] as const).map((currency) => (
                <button
                  key={currency}
                  type="button"
                  onClick={() => onBudgetCurrencyChange(currency)}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                    budgetCurrency === currency
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {currency}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2">
              <Wallet size={13} className="text-muted-foreground" />
              <input
                type="number"
                min={0}
                value={budgetMin ?? ""}
                onChange={(event) => onBudgetMinChange(parseInputNumber(event.target.value))}
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                placeholder="Mínimo"
              />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2">
              <Wallet size={13} className="text-muted-foreground" />
              <input
                type="number"
                min={0}
                value={budgetMax ?? ""}
                onChange={(event) => onBudgetMaxChange(parseInputNumber(event.target.value))}
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                placeholder="Máximo"
              />
            </label>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">3) Prioridad</p>
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => onPriorityChange(id)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  priority === id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70 bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onGenerateBase}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90"
      >
        <Sparkles size={14} />
        Generar base recomendada
      </button>
    </section>
  );
}
