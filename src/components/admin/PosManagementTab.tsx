import { useState } from "react";
import { ShoppingBag, Package, Layers, Zap, Tag } from "lucide-react";
import { Product } from "@/models/products";
import { PosProductsTab }   from "./pos/PosProductsTab";
import { PosKitsTab }        from "./pos/PosKitsTab";
import { PosRulesTab }       from "./pos/PosRulesTab";
import { PosCategoriesTab }  from "./pos/PosCategoriesTab";
import { posStorage }        from "./pos/types";

interface Category { id: number; name: string; parent_id: number | null; }
interface BrandOption { id: string; name: string; }

interface Props {
  products: Product[];
  categories: Category[];
  brands?: BrandOption[];
  onRefreshProducts: () => void;
  isDark?: boolean;
  canEdit?: boolean;
}

type PosTab = "products" | "kits" | "rules" | "categories";

const TABS: { id: PosTab; label: string; icon: React.ReactNode }[] = [
  { id: "products",   label: "Productos POS", icon: <Package size={14} /> },
  { id: "kits",       label: "Kits",          icon: <Layers  size={14} /> },
  { id: "rules",      label: "Reglas",        icon: <Zap     size={14} /> },
  { id: "categories", label: "Categorías",    icon: <Tag     size={14} /> },
];

function getBadge(id: PosTab, products: Product[]): number | null {
  if (id === "products") {
    const posEntries = posStorage.loadProducts();
    const posIds = new Set(posEntries.map((e) => e.productId));
    const count = products.filter((p) => {
      const n = String(p.category ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      return posIds.has(p.id) || n.includes("punto de venta") || /\bpos\b/.test(n);
    }).length;
    return count || null;
  }
  if (id === "kits")  return posStorage.loadKits().length  || null;
  if (id === "rules") return posStorage.loadRules().length || null;
  return null;
}

export function PosManagementTab({ products, categories, brands, onRefreshProducts, isDark }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);
  const [activeTab, setActiveTab] = useState<PosTab>("products");

  return (
    <div className="space-y-5 w-full max-w-none">
      {/* Module header */}
      <div className={`flex items-center gap-3 rounded-xl px-5 py-3 border ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center bg-violet-500/10 border border-violet-500/20`}>
          <ShoppingBag size={15} className="text-violet-400" />
        </div>
        <div>
          <p className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Punto de Venta</p>
          <p className="text-[10px] text-gray-500">Productos, kits y reglas de sugerencia POS</p>
        </div>
      </div>

      {/* Internal tab bar */}
      <div className={`flex items-center gap-1 rounded-xl p-1 border w-fit ${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-[#f5f5f5] border-[#e5e5e5]")}`}>
        {TABS.map((tab) => {
          const badge   = getBadge(tab.id, products);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                isActive
                  ? dk("bg-[#1a2e22] text-[#2D9F6A]", "bg-white text-[#1a7a50] shadow-sm")
                  : dk("text-[#737373] hover:text-white hover:bg-[#1a1a1a]", "text-[#737373] hover:text-[#171717] hover:bg-white")
              }`}
            >
              {tab.icon}
              {tab.label}
              {badge !== null && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  isActive
                    ? "bg-[#2D9F6A]/20 text-[#2D9F6A]"
                    : dk("bg-[#222] text-[#525252]", "bg-[#e8e8e8] text-[#737373]")
                }`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "products" && (
        <PosProductsTab
          products={products}
          categories={categories}
          brands={brands}
          onRefreshProducts={onRefreshProducts}
          isDark={isDark}
        />
      )}
      {activeTab === "kits" && (
        <PosKitsTab
          products={products}
          isDark={isDark}
        />
      )}
      {activeTab === "rules" && (
        <PosRulesTab
          products={products}
          isDark={isDark}
        />
      )}
      {activeTab === "categories" && (
        <PosCategoriesTab isDark={isDark} />
      )}
    </div>
  );
}
