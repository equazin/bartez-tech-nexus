import { PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export function EmptyCatalog({ hasActiveFilters, onClearFilters }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <PackageSearch className="h-12 w-12 text-muted-foreground/40" />
      <div>
        <p className="font-medium">No se encontraron productos</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasActiveFilters
            ? "Probá ajustando los filtros o la búsqueda."
            : "El catálogo no tiene productos disponibles."}
        </p>
      </div>
      {hasActiveFilters && (
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}
