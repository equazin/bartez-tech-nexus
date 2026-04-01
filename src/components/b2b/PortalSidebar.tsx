import React from "react";
import { SlidersHorizontal, ChevronDown, ChevronRight } from "lucide-react";
import { Product } from "@/models/products";

interface PortalSidebarProps {
  isDark: boolean;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  categoryFilter: string;
  setCategoryFilter: (c: string) => void;
  categoryCounts: Record<string, number>;
  categoryTree: {
    parents: Array<{ name: string; children: string[] }>;
    leaves: string[];
  };
  expandedParents: Set<string>;
  setExpandedParents: (s: (prev: Set<string>) => Set<string>) => void;
  toggleSetValue: (s: Set<string>, v: string) => Set<string>;
  activeBrandsWithProducts: any[];
  brandFilter: string;
  setBrandFilter: (b: string) => void;
  brandCounts: Record<string, number>;
  minPrice: string;
  setMinPrice: (p: string) => void;
  maxPrice: string;
  setMaxPrice: (p: string) => void;
  totalProductsCount: number;
}

export const PortalSidebar: React.FC<PortalSidebarProps> = ({
  isDark,
  hasActiveFilters,
  clearFilters,
  categoryFilter,
  setCategoryFilter,
  categoryCounts,
  categoryTree,
  expandedParents,
  setExpandedParents,
  toggleSetValue,
  activeBrandsWithProducts,
  brandFilter,
  setBrandFilter,
  brandCounts,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  totalProductsCount,
}) => {
  const dk = (d: string, l: string) => (isDark ? d : l);

  return (
    <aside className={`hidden md:flex flex-col w-64 xl:w-72 ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-white border-[#e5e5e5]")} border-r p-3 gap-4 shrink-0 min-h-0 overflow-y-auto overflow-x-hidden`}>
      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className={`flex items-center gap-1.5 text-xs ${dk("text-[#a3a3a3] hover:text-white border-[#262626] hover:border-[#333] hover:bg-[#1c1c1c]", "text-[#525252] hover:text-[#171717] border-[#e5e5e5] hover:border-[#d4d4d4] hover:bg-[#f5f5f5]")} border bg-transparent rounded-lg px-3 py-1.5 transition font-medium`}
        >
          <SlidersHorizontal size={11} /> Limpiar filtros
        </button>
      )}

      {/* Categorías */}
      <div>
        <h3 className={`text-[10px] font-bold uppercase tracking-widest ${dk("text-[#525252]", "text-[#a3a3a3]")} mb-2 px-1`}>Categoría</h3>
        <div className="flex flex-col gap-0.5 max-h-[54vh] overflow-y-auto overflow-x-hidden pr-1">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`flex items-center justify-between text-left text-sm px-2.5 py-1.5 rounded-lg transition group border-l-2 ${
              categoryFilter === "all"
                ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]`
                : `${dk("text-[#737373] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`
            }`}
          >
            <span>Todas</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${
              categoryFilter === "all" ? dk("bg-[#262626] text-white", "bg-[#2D9F6A]/20 text-[#1a7a50]") : dk("bg-[#1a1a1a] text-[#525252]", "bg-[#f0f0f0] text-[#737373]")
            }`}>{categoryCounts["all"] || totalProductsCount}</span>
          </button>

          {categoryTree.parents.map(({ name: parent, children }) => {
            const isParentActive = categoryFilter === parent;
            const canExpand = children.length > 0;
            const isExpanded = canExpand && expandedParents.has(parent);
            const parentCount = categoryCounts[parent] || 0;

            return (
              <div key={parent}>
                <div className="flex items-center gap-0">
                  {canExpand ? (
                    <button onClick={() => setExpandedParents((prev) => toggleSetValue(prev, parent))} className={`p-1 rounded transition shrink-0 ${dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#a3a3a3] hover:text-[#525252]")}`}>
                      {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                    </button>
                  ) : <span className="w-[18px] shrink-0" />}
                  <button onClick={() => setCategoryFilter(parent)} className={`flex-1 flex items-center justify-between text-left text-sm px-1.5 py-1.5 rounded-lg transition group border-l-2 ${isParentActive ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]` : `${dk("text-[#737373] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`}`}>
                    <span className="min-w-0 pr-1 leading-tight text-left font-medium">{parent}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${isParentActive ? dk("bg-[#262626] text-white", "bg-[#2D9F6A]/20 text-[#1a7a50]") : dk("bg-[#1a1a1a] text-[#525252]", "bg-[#f0f0f0] text-[#737373]")}`}>{parentCount}</span>
                  </button>
                </div>
                {isExpanded && (
                  <div className="ml-5 flex flex-col gap-0.5 mt-0.5 mb-1">
                    {children.map((child) => {
                      const isActive = categoryFilter === child;
                      const count = categoryCounts[child] || 0;
                      return (
                        <button key={child} onClick={() => setCategoryFilter(child)} className={`flex items-center justify-between text-left text-xs px-2.5 py-1.5 rounded-lg transition group border-l-2 ${isActive ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]` : `${dk("text-[#525252] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#a3a3a3] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`}`}>
                          <span className="min-w-0 pr-1 leading-tight text-left">{child}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${isActive ? dk("bg-[#262626] text-white", "bg-[#2D9F6A]/20 text-[#1a7a50]") : dk("bg-[#1a1a1a] text-[#525252]", "bg-[#f0f0f0] text-[#737373]")}`}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {categoryTree.leaves.map((c) => {
            const isActive = categoryFilter === c;
            return (
              <button key={c} onClick={() => setCategoryFilter(c)} className={`flex items-center justify-between text-left text-sm px-2.5 py-1.5 rounded-lg transition group border-l-2 ${isActive ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]` : `${dk("text-[#737373] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`}`}>
                <span className="min-w-0 pr-1 leading-tight text-left">{c}</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${isActive ? dk("bg-[#262626] text-white", "bg-[#2D9F6A]/20 text-[#1a7a50]") : dk("bg-[#1a1a1a] text-[#525252]", "bg-[#f0f0f0] text-[#737373]")}`}>{categoryCounts[c] || 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Marcas */}
      {activeBrandsWithProducts.length > 0 && (
        <div>
          <h3 className={`text-[10px] font-bold uppercase tracking-widest ${dk("text-[#525252]", "text-[#a3a3a3]")} mb-2 px-1`}>Marca</h3>
          <div className="flex flex-col gap-0.5">
            <button onClick={() => setBrandFilter("all")} className={`flex items-center justify-between text-left text-sm px-2.5 py-1.5 rounded-lg transition group border-l-2 ${brandFilter === "all" ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]` : `${dk("text-[#737373] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`}`}>
              <span>Todas</span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${brandFilter === "all" ? dk("bg-[#262626] text-white", "bg-[#2D9F6A]/20 text-[#1a7a50]") : dk("bg-[#1a1a1a] text-[#525252]", "bg-[#f0f0f0] text-[#737373]")}`}>{totalProductsCount}</span>
            </button>
            {activeBrandsWithProducts.map((brand) => {
              const isActive = brandFilter === brand.id;
              const count = brandCounts[brand.id] ?? 0;
              return (
                <button key={brand.id} onClick={() => setBrandFilter(brand.id)} className={`flex items-center justify-between text-left text-sm px-2.5 py-1.5 rounded-lg transition group border-l-2 ${isActive ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]` : `${dk("text-[#737373] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`}`}>
                  <span className="min-w-0 pr-1 leading-tight text-left">{brand.name}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${isActive ? dk("bg-[#262626] text-white", "bg-[#2D9F6A]/20 text-[#1a7a50]") : dk("bg-[#1a1a1a] text-[#525252]", "bg-[#f0f0f0] text-[#737373]")}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Precio */}
      <div>
        <h3 className={`text-[10px] font-bold uppercase tracking-widest ${dk("text-[#525252]", "text-[#a3a3a3]")} mb-2 px-1`}>Precio</h3>
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#737373] text-xs">$</span>
            <input type="number" placeholder="Mínimo" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className={`w-full ${dk("bg-[#0d0d0d] border-[#222] text-white focus:border-[#404040] placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4] placeholder:text-[#c4c4c4]")} border text-xs rounded-lg pl-6 pr-2 py-1.5 outline-none transition`} />
          </div>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#737373] text-xs">$</span>
            <input type="number" placeholder="Máximo" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={`w-full ${dk("bg-[#0d0d0d] border-[#222] text-white focus:border-[#404040] placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4] placeholder:text-[#c4c4c4]")} border text-xs rounded-lg pl-6 pr-2 py-1.5 outline-none transition`} />
          </div>
        </div>
      </div>
    </aside>
  );
};
