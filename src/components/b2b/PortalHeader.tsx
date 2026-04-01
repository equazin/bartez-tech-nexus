import React from "react";
import { Search, Zap, Plus, X, LayoutGrid, List, Table2, Moon, Sun, Download, ShoppingCart, TrendingUp } from "lucide-react";
import { Product } from "@/models/products";

interface PortalHeaderProps {
  clientName: string;
  search: string;
  setSearch: (s: string) => void;
  quickSku: string;
  setQuickSku: (s: string) => void;
  quickError: string;
  handleQuickOrder: () => void;
  viewMode: "grid" | "list" | "table";
  handleViewModeChange: (m: "grid" | "list" | "table") => void;
  currency: "USD" | "ARS";
  setCurrency: (c: "USD" | "ARS") => void;
  exchangeRate: { rate: number; updatedAt: string };
  isDark: boolean;
  toggleTheme: () => void;
  themeFlash: boolean;
  themeSwitchReady: boolean;
  activeTab: string;
  displayProducts: Product[];
  exportCatalogCSV: (products: Product[]) => void;
  handleExportCatalogPDF: () => void;
  cartItemsCount: number;
  onOpenCart: () => void;
}

export const PortalHeader: React.FC<PortalHeaderProps> = ({
  clientName,
  search,
  setSearch,
  quickSku,
  setQuickSku,
  quickError,
  handleQuickOrder,
  viewMode,
  handleViewModeChange,
  currency,
  setCurrency,
  exchangeRate,
  isDark,
  toggleTheme,
  themeFlash,
  themeSwitchReady,
  activeTab,
  displayProducts,
  exportCatalogCSV,
  handleExportCatalogPDF,
  cartItemsCount,
  onOpenCart,
}) => {
  const dk = (d: string, l: string) => (isDark ? d : l);

  return (
    <header className={`flex items-center gap-3 px-4 md:px-6 py-2.5 ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-white border-[#e5e5e5]")} border-b flex-wrap`}>
      <div className="flex items-center gap-2.5 shrink-0">
        <img src="/icon.png" alt="Bartez" className="h-8 w-8 object-contain" />
        <div>
          <span className={`font-bold ${dk("text-white", "text-[#171717]")} text-sm leading-none`}>Portal B2B</span>
          <span className="block text-[11px] text-[#737373] leading-none mt-0.5 font-medium">{clientName}</span>
        </div>
      </div>

      {/* Search */}
      <div className="flex-1 min-w-[160px] max-w-sm relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar productos, SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`w-full ${dk("bg-[#0d0d0d] border-[#222] text-white focus:border-[#404040] focus:ring-white/5 placeholder:text-[#525252]", "bg-white border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4] focus:ring-black/5 placeholder:text-[#a3a3a3]")} border text-sm rounded-xl pl-9 pr-8 py-2 outline-none focus:ring-1 transition`}
        />
        {search && (
          <button onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition p-0.5">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Quick Order */}
      <div className="hidden md:flex flex-col gap-0.5 shrink-0">
        <div className="flex items-center gap-1">
          <div className="relative">
            <Zap size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#2D9F6A] pointer-events-none" />
            <input
              type="text"
              placeholder="SKU [qty]"
              value={quickSku}
              onChange={(e) => setQuickSku(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleQuickOrder(); }}
              className={`w-32 ${dk("bg-[#0d0d0d] border-[#222] text-white focus:border-[#2D9F6A]/50 placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]/50 placeholder:text-[#c4c4c4]")} border text-xs rounded-lg pl-7 pr-2 py-2 outline-none focus:ring-1 focus:ring-[#2D9F6A]/20 transition font-mono`}
            />
          </div>
          <button
            onClick={handleQuickOrder}
            title="Agregar al carrito (Enter)"
            className="h-8 w-8 bg-[#2D9F6A] hover:bg-[#25835A] text-white rounded-lg flex items-center justify-center transition active:scale-95 shrink-0"
          >
            <Plus size={13} />
          </button>
        </div>
        {quickError && <p className="text-[10px] text-red-400 px-0.5">{quickError}</p>}
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        {/* Vista + Moneda */}
        <div className={`hidden md:flex items-center ${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-[#f0f0f0] border-[#e5e5e5]")} border rounded-lg p-1 gap-0.5`}>
          <button onClick={() => handleViewModeChange("grid")} title="Grilla"
            className={`p-1.5 rounded transition ${viewMode === "grid" ? dk("bg-[#262626] text-white", "bg-white text-[#171717] shadow-sm") : dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#737373] hover:text-[#171717]")}`}>
            <LayoutGrid size={13} />
          </button>
          <button onClick={() => handleViewModeChange("list")} title="Lista"
            className={`p-1.5 rounded transition ${viewMode === "list" ? dk("bg-[#262626] text-white", "bg-white text-[#171717] shadow-sm") : dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#737373] hover:text-[#171717]")}`}>
            <List size={13} />
          </button>
          <button onClick={() => handleViewModeChange("table")} title="Lista de precios"
            className={`p-1.5 rounded transition ${viewMode === "table" ? dk("bg-[#262626] text-white", "bg-white text-[#171717] shadow-sm") : dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#737373] hover:text-[#171717]")}`}>
            <Table2 size={13} />
          </button>
          <div className={`w-px h-4 ${dk("bg-[#262626]", "bg-[#e5e5e5]")} mx-0.5`} />
          {(["USD", "ARS"] as const).map((c) => (
            <button key={c} onClick={() => setCurrency(c)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition ${currency === c ? dk("bg-[#262626] text-white", "bg-white text-[#171717] shadow-sm") : dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#737373] hover:text-[#171717]")}`}>
              {c}
            </button>
          ))}
        </div>

        {/* Theme Switch */}
        <button
          type="button"
          onClick={toggleTheme}
          role="switch"
          aria-checked={isDark}
          className={`group relative h-7 w-[84px] shrink-0 overflow-hidden rounded-full border transition-all duration-300 ease-in-out hover:shadow-md active:scale-[0.97] ${
            isDark ? "bg-neutral-800 border-neutral-700" : "bg-neutral-200 border-neutral-300"
          } ${themeFlash ? "shadow-[0_0_0_3px_rgba(45,159,106,0.22)]" : ""} ${themeSwitchReady ? "opacity-100" : "opacity-0"}`}
        >
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2">
            <Moon size={12} className={`transition-all ${isDark ? "text-white opacity-100" : "text-neutral-500 opacity-45"}`} />
          </span>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
            <Sun size={12} className={`transition-all ${isDark ? "text-neutral-500 opacity-45" : "text-amber-500 opacity-100"}`} />
          </span>
          <span className={`pointer-events-none absolute left-[1px] top-[1px] h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ${isDark ? "translate-x-[2px]" : "translate-x-[54px]"}`} />
        </button>

        {/* Currency Rate Display */}
        <div className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg border ${dk("bg-[#111] border-[#1f1f1f] text-gray-400", "bg-[#f9f9f9] border-[#e5e5e5] text-[#525252]")} text-[11px] font-medium animate-in fade-in slide-in-from-right-4 duration-500`}>
          <TrendingUp size={11} className="text-[#2D9F6A]" />
          <span>USD oficial: </span>
          <span className={`font-bold ${dk("text-white", "text-[#171717]")}`}>$ {exchangeRate.rate.toLocaleString("es-AR")}</span>
        </div>

        {/* Cart Button */}
        <button
          onClick={onOpenCart}
          className={`relative h-9 px-4 flex items-center gap-2 rounded-xl border transition-all active:scale-95 ${
            cartItemsCount > 0
              ? "bg-[#2D9F6A] border-[#2D9F6A] text-white shadow-[0_0_15px_rgba(45,159,106,0.3)]"
              : dk("bg-[#111] border-[#1f1f1f] text-gray-400 hover:text-white hover:border-[#333]", "bg-white border-[#e5e5e5] text-[#525252] hover:text-[#171717] hover:border-[#d4d4d4]")
          }`}
        >
          <ShoppingCart size={15} className={cartItemsCount > 0 ? "animate-bounce-short" : ""} />
          <span className="text-xs font-bold md:block hidden">Carrito</span>
          {cartItemsCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-[#2D9F6A] shadow-sm">
              {cartItemsCount}
            </span>
          )}
        </button>

        {/* Export */}
        {activeTab === "catalog" && (
          <div className={`hidden md:flex items-center ${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-[#f0f0f0] border-[#e5e5e5]")} border rounded-lg p-1 gap-0.5`}>
            <button onClick={() => exportCatalogCSV(displayProducts)} className={`px-2 py-1 rounded text-[11px] transition ${dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#737373] hover:text-[#171717]")}`}>
              <Download size={11} className="inline mr-1" /> CSV
            </button>
            <button onClick={handleExportCatalogPDF} className={`px-2 py-1 rounded text-[11px] transition ${dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#737373] hover:text-[#171717]")}`}>
              <Download size={11} className="inline mr-1" /> PDF
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
