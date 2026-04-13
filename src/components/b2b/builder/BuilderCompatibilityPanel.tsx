import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { BuildCompatibilityResult } from "@/models/pcBuilder";

interface BuilderCompatibilityPanelProps {
  compatibility: BuildCompatibilityResult;
}

function statusLabel(state: BuildCompatibilityResult["state"]): string {
  if (state === "compatible") return "Compatible";
  if (state === "incomplete") return "Incompleto";
  if (state === "incompatible") return "Incompatible";
  return "Sin validar";
}

function statusClass(state: BuildCompatibilityResult["state"]): string {
  if (state === "compatible") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (state === "incomplete") return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  if (state === "incompatible") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-border/70 bg-muted/20 text-muted-foreground";
}

export function BuilderCompatibilityPanel({ compatibility }: BuilderCompatibilityPanelProps) {
  return (
    <section className="rounded-[24px] border border-border/70 bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Compatibilidad</p>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(compatibility.state)}`}>
          {statusLabel(compatibility.state)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
          Consumo estimado: <span className="font-bold text-foreground">{compatibility.estimatedPowerW}W</span>
        </div>
        <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
          PSU recomendada: <span className="font-bold text-foreground">{compatibility.recommendedPsuW}W</span>
        </div>
      </div>

      {compatibility.issues.length === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={16} />
          Sin bloqueos detectados. Podés cotizar o agregar al carrito.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {compatibility.issues.map((issue) => (
            <div
              key={issue.id}
              className={`rounded-xl border px-3 py-2 ${
                issue.severity === "error"
                  ? "border-destructive/30 bg-destructive/10"
                  : issue.severity === "warning"
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "border-border/70 bg-muted/20"
              }`}
            >
              <div className="flex items-start gap-2">
                {issue.severity === "error" ? (
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-destructive" />
                ) : (
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{issue.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{issue.description}</p>
                  {issue.action ? <p className="mt-1 text-xs font-medium text-foreground/80">{issue.action}</p> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
