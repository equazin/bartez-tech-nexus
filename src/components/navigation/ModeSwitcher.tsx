import { Link } from "react-router-dom";
import { Home, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

type Mode = "portal" | "admin";

interface ModeSwitcherProps {
  currentMode: Mode;
  className?: string;
}

const modes = [
  { id: "portal" as const, label: "Portal", to: "/portal", icon: Home },
  { id: "admin" as const, label: "Admin", to: "/admin", icon: ShieldCheck },
];

export function ModeSwitcher({ currentMode, className }: ModeSwitcherProps) {
  return (
    <nav
      aria-label="Cambiar modo de trabajo"
      className={cn(
        "inline-flex h-9 shrink-0 items-center rounded-full border border-border/70 bg-card/90 p-1 shadow-sm",
        className,
      )}
    >
      {modes.map((mode) => {
        const Icon = mode.icon;
        const active = mode.id === currentMode;

        return (
          <Link
            key={mode.id}
            to={mode.to}
            aria-current={active ? "page" : undefined}
            title={mode.id === "portal" ? "Ir al portal B2B" : "Ir al panel de administrador"}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">{mode.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
