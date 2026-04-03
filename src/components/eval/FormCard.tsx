import type { ReactNode } from "react";

interface FormCardProps {
  children: ReactNode;
  className?: string;
}

export function FormCard({ children, className = "" }: FormCardProps) {
  return (
    <div className={`rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm shadow-2xl shadow-black/20 p-8 lg:p-10 ${className}`}>
      {children}
    </div>
  );
}

export function FieldGroup({ label, children, hint }: { label?: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-foreground/80">{label}</p>}
      {children}
      {hint && <p className="text-xs text-muted-foreground/60">{hint}</p>}
    </div>
  );
}
