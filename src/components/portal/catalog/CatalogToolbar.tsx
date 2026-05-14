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
    <div className="flex flex-col gap-2 border-b bg-background px-4 py-3">
      <div className="flex items-center gap-2">
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
