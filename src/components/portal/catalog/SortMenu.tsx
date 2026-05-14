import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CatalogSortKey } from "./types";

const SORT_OPTIONS: { value: CatalogSortKey; label: string }[] = [
  { value: "featured",   label: "Destacados primero" },
  { value: "name_asc",   label: "Nombre A → Z" },
  { value: "name_desc",  label: "Nombre Z → A" },
  { value: "price_asc",  label: "Precio menor" },
  { value: "price_desc", label: "Precio mayor" },
  { value: "stock_desc", label: "Mayor stock" },
];

interface Props {
  value: CatalogSortKey;
  onChange: (sort: CatalogSortKey) => void;
}

export function SortMenu({ value, onChange }: Props) {
  const current = SORT_OPTIONS.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{current?.label ?? "Ordenar"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as CatalogSortKey)}>
          {SORT_OPTIONS.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value}>
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
