import { Compass, Cpu } from "lucide-react";
import type { BuilderMode } from "@/models/pcBuilder";

interface BuilderModeToggleProps {
  mode: BuilderMode;
  onChange: (mode: BuilderMode) => void;
}

export function BuilderModeToggle({ mode, onChange }: BuilderModeToggleProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl border border-border/70 bg-card p-1">
      <button
        type="button"
        onClick={() => onChange("guided")}
        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
          mode === "guided" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <Compass size={14} />
        Guiado
      </button>
      <button
        type="button"
        onClick={() => onChange("manual")}
        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
          mode === "manual" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <Cpu size={14} />
        Manual
      </button>
    </div>
  );
}
