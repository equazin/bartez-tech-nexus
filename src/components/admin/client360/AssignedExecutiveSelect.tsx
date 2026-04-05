import { useMemo, useState } from "react";
import { Search, UserRoundCheck } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { ExecutiveOption } from "@/components/admin/client360/types";

interface AssignedExecutiveSelectProps {
  value: string;
  options: ExecutiveOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function AssignedExecutiveSelect({
  value,
  options,
  onChange,
  disabled = false,
}: AssignedExecutiveSelectProps) {
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) =>
      [option.name, option.role, option.email ?? ""].join(" ").toLowerCase().includes(normalized),
    );
  }, [options, query]);

  const current = options.find((option) => option.id === value) ?? null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        <UserRoundCheck className="h-3 w-3" />
        Ejecutivo asignado
      </div>
      <div className="grid gap-1.5 md:grid-cols-[1fr_190px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar vendedor o account manager"
            className="h-9 rounded-lg pl-8 text-[12px]"
            disabled={disabled}
          />
        </div>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full rounded-lg border border-input/80 bg-card px-3 py-2 text-[12px] transition-[border-color,box-shadow,background-color]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <option value="">Sin ejecutivo asignado</option>
          {filteredOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} ? {option.role}
            </option>
          ))}
        </select>
      </div>
      <p className="text-[12px] text-muted-foreground">
        {current ? `${current.name} ? ${current.role}` : "La cuenta no tiene responsable comercial asignado."}
      </p>
    </div>
  );
}
