import React from "react";
import { ChevronDown, ChevronRight, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

interface PortalSidebarProps {
  isDark: boolean;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  categoryFilter: string;
  setCategoryFilter: (c: string) => void;
  categoryCounts: Record<string, number>;
  categoryTree: {
    parents: Array<{ name: string; children: Array<{ name: string; children: string[] }> }>;
    leaves: string[];
  };
  expandedParents: Set<string>;
  setExpandedParents: (s: (prev: Set<string>) => Set<string>) => void;
  toggleSetValue: (s: Set<string>, v: string) => Set<string>;
  activeBrandsWithProducts: Array<{ id: string; name: string }>;
  brandFilter: string;
  setBrandFilter: (b: string) => void;
  brandCounts: Record<string, number>;
  minPrice: string;
  setMinPrice: (p: string) => void;
  maxPrice: string;
  setMaxPrice: (p: string) => void;
  totalProductsCount: number;
}

function filterButtonClass(active: boolean, compact = false) {
  return cn(
    "flex w-full items-center justify-between gap-2 rounded-2xl border border-transparent px-3 py-2 text-left transition",
    compact ? "text-xs" : "text-sm",
    active ? "border-primary/15 bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:border-border hover:bg-secondary hover:text-foreground",
  );
}

function countBadgeClass(active: boolean) {
  return active ? "bg-primary/15 text-primary" : "bg-card text-muted-foreground";
}

export const PortalSidebar: React.FC<PortalSidebarProps> = ({
  hasActiveFilters,
  clearFilters,
  categoryFilter,
  setCategoryFilter,
  categoryCounts,
  categoryTree,
  expandedParents,
  setExpandedParents,
  toggleSetValue,
  totalProductsCount,
}) => {
  return (
    <aside className="hidden w-[286px] shrink-0 overflow-y-auto border-r border-border/70 bg-card/40 p-3 md:flex xl:w-[304px]">
      <div className="sticky top-4 flex w-full flex-col gap-4 self-start">
        {hasActiveFilters ? (
          <Button type="button" variant="outline" className="justify-start gap-2 rounded-2xl bg-card" onClick={clearFilters}>
            <SlidersHorizontal size={13} /> Limpiar filtros
          </Button>
        ) : null}

        <SurfaceCard tone="subtle" padding="md" className="dashboard-panel space-y-3 rounded-[24px] bg-card/85">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Categoria</p>
            <Badge variant="muted" className="rounded-full">{totalProductsCount}</Badge>
          </div>
          <div className="max-h-[52vh] space-y-1 overflow-y-auto pr-1">
            <button type="button" onClick={() => setCategoryFilter("all")} className={filterButtonClass(categoryFilter === "all")}>
              <span>Todas</span>
              <Badge variant="muted" className={countBadgeClass(categoryFilter === "all")}>{categoryCounts.all || totalProductsCount}</Badge>
            </button>

            {categoryTree.parents.map(({ name: parent, children }) => {
              const isActive = categoryFilter === parent;
              const isExpanded = children.length > 0 && expandedParents.has(parent);
              const count = categoryCounts[parent] || 0;

              return (
                <div key={parent} className="space-y-1">
                  <div className="flex items-center gap-1">
                    {children.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setExpandedParents((prev) => toggleSetValue(prev, parent))}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                      >
                        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </button>
                    ) : (
                      <span className="block h-8 w-8 shrink-0" />
                    )}
                    <button type="button" onClick={() => setCategoryFilter(parent)} className={filterButtonClass(isActive)}>
                      <span className="truncate font-medium">{parent}</span>
                      <Badge variant="muted" className={countBadgeClass(isActive)}>{count}</Badge>
                    </button>
                  </div>

                  {isExpanded ? (
                    <div className="ml-8 space-y-1">
                      {children.map((child) => {
                        const childActive = categoryFilter === child.name;
                        return (
                          <button key={child.name} type="button" onClick={() => setCategoryFilter(child.name)} className={filterButtonClass(childActive, true)}>
                            <span className="truncate">{child.name}</span>
                            <Badge variant="muted" className={countBadgeClass(childActive)}>{categoryCounts[child.name] || 0}</Badge>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {categoryTree.leaves.map((leaf) => {
              const isActive = categoryFilter === leaf;
              return (
                <button key={leaf} type="button" onClick={() => setCategoryFilter(leaf)} className={filterButtonClass(isActive)}>
                  <span className="truncate">{leaf}</span>
                  <Badge variant="muted" className={countBadgeClass(isActive)}>{categoryCounts[leaf] || 0}</Badge>
                </button>
              );
            })}
          </div>
        </SurfaceCard>

        <SurfaceCard tone="subtle" padding="md" className="dashboard-panel space-y-2 rounded-[24px] bg-card/85">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Compra rapida</p>
          <p className="text-sm font-semibold text-foreground">Las categorias viven aca. Los filtros avanzados estan arriba del listado.</p>
          <p className="text-xs leading-5 text-muted-foreground">Usa marca, RAM, almacenamiento, Hz y panel desde la barra superior para acelerar la compra sin perder contexto.</p>
        </SurfaceCard>
      </div>
    </aside>
  );
};
