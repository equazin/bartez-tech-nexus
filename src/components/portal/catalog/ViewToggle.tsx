import { LayoutGrid, Table2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CatalogViewMode } from "./types";

interface Props {
  value: CatalogViewMode;
  onChange: (mode: CatalogViewMode) => void;
}

export function ViewToggle({ value, onChange }: Props) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => { if (v) onChange(v as CatalogViewMode); }}
      className="shrink-0"
    >
      <ToggleGroupItem value="table" aria-label="Vista tabla" size="sm">
        <Table2 className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="grid" aria-label="Vista grilla" size="sm">
        <LayoutGrid className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
