import { SearchAutocomplete } from "./SearchAutocomplete";
import { FilterChips } from "./FilterChips";
import { ViewToggle } from "./ViewToggle";
import { SortMenu } from "./SortMenu";
import { PriceListDownload } from "./PriceListDownload";
import type { CatalogFilters, CatalogSortKey, CatalogViewMode, CategoryNode } from "./types";

interface Props {
  filters: CatalogFilters;
  categoryTree: CategoryNode[];
  sort: CatalogSortKey;
  viewMode: CatalogViewMode;
  clientId: string | undefined;
  onSearchChange: (search: string) => void;
  onFilterRemove: (key: keyof CatalogFilters) => void;
  onClearAll: () => void;
  onSortChange: (sort: CatalogSortKey) => void;
  onViewModeChange: (mode: CatalogViewMode) => void;
}

export function CatalogToolbar({
  filters,
  categoryTree,
  sort,
  viewMode,
  clientId,
  onSearchChange,
  onFilterRemove,
  onClearAll,
  onSortChange,
  onViewModeChange,
}: Props) {
  return (
    <div className="sticky top-0 z-10 flex flex-col gap-2 border-b border-border/60 bg-background/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-4 md:py-3">
      <div className="flex items-center gap-1.5 md:gap-2">
        <SearchAutocomplete
          value={filters.search}
          onChange={onSearchChange}
        />
        <SortMenu value={sort} onChange={onSortChange} />
        <ViewToggle value={viewMode} onChange={onViewModeChange} />
        <PriceListDownload clientId={clientId} />
      </div>

      <FilterChips
        filters={filters}
        categoryTree={categoryTree}
        onRemove={onFilterRemove}
        onClearAll={onClearAll}
      />
    </div>
  );
}
