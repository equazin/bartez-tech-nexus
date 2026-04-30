import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CatalogFilters, CategoryNode } from "./types";

function findNodeById(roots: CategoryNode[], id: number): CategoryNode | null {
  for (const n of roots) {
    if (n.id === id) return n;
    const found = findNodeById(n.children, id);
    if (found) return found;
  }
  return null;
}

interface Props {
  filters: CatalogFilters;
  categoryTree: CategoryNode[];
  onRemove: (key: keyof CatalogFilters) => void;
  onClearAll: () => void;
}

export function FilterChips({ filters, categoryTree, onRemove, onClearAll }: Props) {
  const chips: { key: keyof CatalogFilters; label: string }[] = [];

  if (filters.categoryId !== null) {
    const node = findNodeById(categoryTree, filters.categoryId);
    chips.push({ key: "categoryId", label: node?.name ?? `Cat. ${filters.categoryId}` });
  }
  if (filters.brandId) chips.push({ key: "brandId", label: `Marca: ${filters.brandId}` });
  if (filters.search)  chips.push({ key: "search",  label: `"${filters.search}"` });
  if (filters.minPrice !== null) chips.push({ key: "minPrice", label: `≥ $${filters.minPrice}` });
  if (filters.maxPrice !== null) chips.push({ key: "maxPrice", label: `≤ $${filters.maxPrice}` });

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <Badge key={chip.key} variant="secondary" className="gap-1 pl-2 pr-1 text-xs">
          {chip.label}
          <button
            type="button"
            onClick={() => onRemove(chip.key)}
            className="rounded-full p-0.5 hover:bg-muted-foreground/20"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClearAll}>
        Limpiar todo
      </Button>
    </div>
  );
}
