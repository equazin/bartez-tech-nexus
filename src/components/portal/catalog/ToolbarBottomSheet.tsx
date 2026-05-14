import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import type { CatalogFilters, CatalogSortKey, CatalogViewMode, CategoryNode } from "./types";
import { SearchAutocomplete } from "./SearchAutocomplete";
import { SortMenu } from "./SortMenu";
import { ViewToggle } from "./ViewToggle";
import { FilterChips } from "./FilterChips";

interface Props {
  filters: CatalogFilters;
  categoryTree: CategoryNode[];
  sort: CatalogSortKey;
  viewMode: CatalogViewMode;
  onSearchChange: (search: string) => void;
  onFilterRemove: (key: keyof CatalogFilters) => void;
  onClearAll: () => void;
  onSortChange: (sort: CatalogSortKey) => void;
  onViewModeChange: (mode: CatalogViewMode) => void;
}

export function ToolbarBottomSheet({
  filters,
  categoryTree,
  sort,
  viewMode,
  onSearchChange,
  onFilterRemove,
  onClearAll,
  onSortChange,
  onViewModeChange,
}: Props) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 md:hidden">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Filtros y ordenamiento</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-4 p-4 pb-8">
          <SearchAutocomplete value={filters.search} onChange={onSearchChange} />
          <div className="flex items-center gap-2">
            <SortMenu value={sort} onChange={onSortChange} />
            <ViewToggle value={viewMode} onChange={onViewModeChange} />
          </div>
          <FilterChips
            filters={filters}
            categoryTree={categoryTree}
            onRemove={onFilterRemove}
            onClearAll={onClearAll}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
