import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  CheckCircle2,
  Download,
  Eye,
  Image as ImageIcon,
  RefreshCw,
  Search,
  X,
  XCircle,
  Zap,
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  Star,
  ImageOff,
} from "lucide-react";
import {
  fetchProductsForImageSearch,
  processImageSearch,
  fetchSuggestionsForProduct,
  approveSuggestion,
  rejectSuggestion,
  getImageStats,
  type ImageSearchProgress,
  type ImageSearchSummary,
  type ImageSuggestion,
  type ImageSearchFilter,
} from "@/lib/api/imageSearchService";
import type { Product } from "@/models/products";
import { supabase } from "@/lib/supabase";

interface Props {
  isDark?: boolean;
  products?: Product[];
  onRefreshProducts?: () => void;
}

const SOURCE_LABELS: Record<string, { label: string; color: string; darkColor: string }> = {
  supplier: { label: "Proveedor", color: "bg-emerald-100 text-emerald-700 border-emerald-200", darkColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  mercadolibre: { label: "MercadoLibre", color: "bg-yellow-100 text-yellow-700 border-yellow-200", darkColor: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  bing: { label: "Bing", color: "bg-blue-100 text-blue-700 border-blue-200", darkColor: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  serpapi: { label: "Google", color: "bg-purple-100 text-purple-700 border-purple-200", darkColor: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  manual: { label: "Manual", color: "bg-gray-100 text-gray-600 border-gray-200", darkColor: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
};

function SourceBadge({ source, isDark }: { source: string; isDark: boolean }) {
  const cfg = SOURCE_LABELS[source] ?? SOURCE_LABELS.manual;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${isDark ? cfg.darkColor : cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function ScoreBadge({ score, isDark }: { score: number; isDark: boolean }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.85
    ? isDark ? "text-emerald-400" : "text-emerald-600"
    : score >= 0.60
      ? isDark ? "text-yellow-400" : "text-yellow-600"
      : isDark ? "text-red-400" : "text-red-600";
  return (
    <span className={`text-[11px] font-bold tabular-nums ${color}`}>
      {pct}%
    </span>
  );
}

export function ImageManagerTab({ isDark = true, products: externalProducts, onRefreshProducts }: Props) {
  const dk = (d: string, l: string) => (isDark ? d : l);

  // --- State ---
  const [stats, setStats] = useState({ total: 0, withImage: 0, withoutImage: 0, pendingSuggestions: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  const [filter, setFilter] = useState<ImageSearchFilter>("missing_only");
  const [searchText, setSearchText] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<ImageSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<ImageSearchProgress | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const [processSummary, setProcessSummary] = useState<ImageSearchSummary | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [autoAssign, setAutoAssign] = useState(false);
  const [autoAssignThreshold, setAutoAssignThreshold] = useState(0.85);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // --- Derived ---
  const filteredProducts = useMemo(() => {
    if (!searchText.trim()) return products;
    const q = searchText.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q) ||
        (p.brand_name ?? "").toLowerCase().includes(q)
    );
  }, [products, searchText]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  // --- Effects ---
  useEffect(() => {
    loadStats();
    loadProducts();
  }, []);

  async function loadStats() {
    setLoadingStats(true);
    try {
      const s = await getImageStats();
      setStats(s);
    } catch { /* ignore */ }
    setLoadingStats(false);
  }

  async function loadProducts() {
    setLoadingProducts(true);
    try {
      const data = await fetchProductsForImageSearch(filter);
      setProducts(data);
    } catch { /* ignore */ }
    setLoadingProducts(false);
  }

  useEffect(() => {
    loadProducts();
  }, [filter]);

  useEffect(() => {
    if (selectedProductId) {
      loadSuggestions(selectedProductId);
    }
  }, [selectedProductId]);

  async function loadSuggestions(productId: number) {
    setLoadingSuggestions(true);
    try {
      const data = await fetchSuggestionsForProduct(productId);
      setSuggestions(data);
    } catch { /* ignore */ }
    setLoadingSuggestions(false);
  }

  // --- Actions ---
  async function handleStartProcess() {
    setProcessing(true);
    setProcessError(null);
    setProcessSummary(null);
    setProgress(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const candidates = await fetchProductsForImageSearch(filter);
      if (candidates.length === 0) {
        setProcessSummary({ total: 0, auto_assigned: 0, suggested: 0, skipped: 0, already_has_image: 0 });
        setProcessing(false);
        return;
      }

      const summary = await processImageSearch(
        candidates,
        autoAssign,
        autoAssignThreshold,
        (p) => setProgress(p),
        controller.signal
      );

      setProcessSummary(summary);
      await loadStats();
      await loadProducts();
      if (selectedProductId) {
        await loadSuggestions(selectedProductId);
      }
      onRefreshProducts?.();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setProcessError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setProcessing(false);
      abortRef.current = null;
    }
  }

  function handleCancelProcess() {
    abortRef.current?.abort();
  }

  async function handleApprove(suggestion: ImageSuggestion) {
    setActionLoading(suggestion.id);
    try {
      await approveSuggestion(suggestion);
      // Reload data
      if (selectedProductId) await loadSuggestions(selectedProductId);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === suggestion.product_id
            ? { ...p, image: suggestion.image_url }
            : p
        )
      );
      await loadStats();
      onRefreshProducts?.();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  async function handleReject(suggestion: ImageSuggestion) {
    setActionLoading(suggestion.id);
    try {
      await rejectSuggestion(suggestion);
      if (selectedProductId) await loadSuggestions(selectedProductId);
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  async function handleRetrySearch(productId: number) {
    setActionLoading(`retry-${productId}`);
    try {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      await processImageSearch(
        [product],
        false,
        0.85,
        () => {},
      );
      await loadSuggestions(productId);
      await loadStats();
    } catch { /* ignore */ }
    setActionLoading(null);
  }

  // --- Render ---
  const progressPercent = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-5 w-full max-w-none">
      {/* ===== HEADER / STATS ===== */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={`text-lg font-bold ${dk("text-white", "text-[#171717]")}`}>
            Gestión de Imágenes
          </h2>
          <p className={`text-xs mt-0.5 ${dk("text-gray-500", "text-[#737373]")}`}>
            Busca, revisa y asigna imágenes a tu catálogo desde múltiples fuentes.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleStartProcess}
            disabled={processing}
            className="flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg bg-[#2D9F6A] hover:bg-[#25835A] text-white font-semibold transition disabled:opacity-50"
          >
            {processing ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Zap size={12} />
            )}
            {processing ? "Buscando..." : "Completar imágenes"}
          </button>
          {processing && (
            <button
              onClick={handleCancelProcess}
              className={`flex items-center gap-1 text-xs px-2.5 py-2 rounded-lg border transition ${dk(
                "border-[#333] text-gray-400 hover:text-red-400 hover:border-red-500/30",
                "border-[#e5e5e5] text-[#737373] hover:text-red-600 hover:border-red-200"
              )}`}
            >
              <X size={11} /> Cancelar
            </button>
          )}
        </div>
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total productos", value: stats.total, icon: ImageIcon, accent: "text-[#2D9F6A]" },
          { label: "Con imagen", value: stats.withImage, icon: CheckCircle2, accent: "text-emerald-400" },
          { label: "Sin imagen", value: stats.withoutImage, icon: ImageOff, accent: "text-red-400" },
          { label: "Sugerencias pendientes", value: stats.pendingSuggestions, icon: AlertTriangle, accent: "text-yellow-400" },
        ].map(({ label, value, icon: Icon, accent }) => (
          <div
            key={label}
            className={`rounded-xl border p-3.5 ${dk(
              "bg-[#111] border-[#1f1f1f]",
              "bg-white border-[#e5e5e5]"
            )}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${dk("bg-[#1a1a1a]", "bg-[#f5f5f5]")}`}>
                <Icon size={13} className={accent} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
                {label}
              </span>
            </div>
            <p className={`text-xl font-extrabold tabular-nums ${dk("text-white", "text-[#171717]")}`}>
              {loadingStats ? "..." : value.toLocaleString("es-AR")}
            </p>
          </div>
        ))}
      </div>

      {/* ===== PROGRESS BAR ===== */}
      {processing && progress && (
        <div className={`rounded-xl border p-4 ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-semibold ${dk("text-white", "text-[#171717]")}`}>
              Procesando {progress.done} de {progress.total} productos...
            </span>
            <span className={`text-xs tabular-nums ${dk("text-gray-400", "text-[#737373]")}`}>
              {progressPercent}%
            </span>
          </div>
          <div className={`h-2 rounded-full overflow-hidden ${dk("bg-[#1a1a1a]", "bg-[#e5e5e5]")}`}>
            <div
              className="h-full bg-[#2D9F6A] rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {progress.summary && (
            <div className="flex gap-4 mt-2 text-[11px]">
              <span className="text-emerald-400">✅ Auto: {progress.summary.auto_assigned}</span>
              <span className="text-yellow-400">💡 Sugeridas: {progress.summary.suggested}</span>
              <span className={dk("text-gray-500", "text-[#a3a3a3]")}>⏭️ Saltadas: {progress.summary.skipped}</span>
            </div>
          )}
        </div>
      )}

      {/* ===== SUMMARY AFTER PROCESS ===== */}
      {processSummary && !processing && (
        <div className={`rounded-xl border p-4 ${dk("bg-emerald-500/5 border-emerald-500/20", "bg-emerald-50 border-emerald-200")}`}>
          <p className={`text-sm font-semibold mb-1 ${dk("text-emerald-400", "text-emerald-700")}`}>
            ✅ Búsqueda completada
          </p>
          <div className="flex gap-4 text-xs">
            <span>Total: <strong>{processSummary.total}</strong></span>
            <span className="text-emerald-500">Auto-asignadas: <strong>{processSummary.auto_assigned}</strong></span>
            <span className="text-yellow-500">Sugeridas: <strong>{processSummary.suggested}</strong></span>
            <span className={dk("text-gray-500", "text-[#a3a3a3]")}>Saltadas: <strong>{processSummary.skipped}</strong></span>
            <span className={dk("text-gray-500", "text-[#a3a3a3]")}>Ya tenían: <strong>{processSummary.already_has_image}</strong></span>
          </div>
        </div>
      )}

      {processError && (
        <div className={`rounded-xl border p-3 ${dk("bg-red-500/5 border-red-500/20", "bg-red-50 border-red-200")}`}>
          <p className="text-xs text-red-400">{processError}</p>
        </div>
      )}

      {/* ===== SETTINGS ROW ===== */}
      <div className={`rounded-xl border p-4 ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
        <div className="flex flex-wrap items-center gap-4">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <label className={`text-[11px] font-semibold uppercase tracking-wider ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
              Filtro:
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as ImageSearchFilter)}
              className={`text-xs rounded-lg border px-2.5 py-1.5 outline-none ${dk(
                "bg-[#0d0d0d] border-[#262626] text-white",
                "bg-white border-[#e5e5e5] text-[#171717]"
              )}`}
            >
              <option value="missing_only">Solo sin imagen</option>
              <option value="all">Todos los productos</option>
            </select>
          </div>

          {/* Auto-assign toggle */}
          <div className="flex items-center gap-2">
            <label className={`text-[11px] font-semibold uppercase tracking-wider ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
              Auto-asignar:
            </label>
            <button
              onClick={() => setAutoAssign(!autoAssign)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                autoAssign ? "bg-[#2D9F6A]" : dk("bg-[#333]", "bg-[#d4d4d4]")
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  autoAssign ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
            {autoAssign && (
              <span className={`text-[11px] ${dk("text-gray-400", "text-[#737373]")}`}>
                Score ≥ {Math.round(autoAssignThreshold * 100)}%
              </span>
            )}
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={12} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${dk("text-gray-500", "text-[#a3a3a3]")}`} />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buscar producto..."
                className={`w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border outline-none ${dk(
                  "bg-[#0d0d0d] border-[#262626] text-white placeholder:text-gray-600 focus:border-[#2D9F6A]",
                  "bg-white border-[#e5e5e5] text-[#171717] placeholder:text-[#a3a3a3] focus:border-[#2D9F6A]"
                )}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT: PRODUCT LIST + DETAIL PANEL ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Product list */}
        <div className="lg:col-span-3 space-y-1">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-semibold ${dk("text-gray-400", "text-[#737373]")}`}>
              {filteredProducts.length} producto{filteredProducts.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={loadProducts}
              className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition ${dk(
                "text-gray-500 hover:text-white hover:bg-[#1c1c1c]",
                "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]"
              )}`}
            >
              <RefreshCw size={10} /> Recargar
            </button>
          </div>

          {loadingProducts ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`h-14 ${dk("bg-[#111]", "bg-[#f5f5f5]")} rounded-lg animate-pulse`} />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className={`text-center py-12 rounded-xl border ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
              <ImageIcon size={32} className={dk("text-gray-600", "text-[#d4d4d4]")} />
              <p className={`text-sm mt-2 ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
                {filter === "missing_only" ? "🎉 Todos los productos tienen imagen" : "No se encontraron productos"}
              </p>
            </div>
          ) : (
            <div className={`rounded-xl border overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
              <div className="max-h-[600px] overflow-y-auto">
                {filteredProducts.map((product) => {
                  const hasImage = product.image && product.image.startsWith("http");
                  const isSelected = selectedProductId === product.id;
                  return (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProductId(product.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition border-b last:border-b-0 ${
                        isSelected
                          ? dk("bg-[#1a2e22] border-[#1f1f1f]", "bg-[#f0faf5] border-[#e5e5e5]")
                          : dk("bg-[#0d0d0d] hover:bg-[#111] border-[#1a1a1a]", "bg-white hover:bg-[#fafafa] border-[#f0f0f0]")
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className={`h-10 w-10 rounded-lg border flex-shrink-0 overflow-hidden flex items-center justify-center ${dk("border-[#262626] bg-[#1a1a1a]", "border-[#e5e5e5] bg-[#f5f5f5]")}`}>
                        {hasImage ? (
                          <img
                            src={product.image}
                            alt=""
                            className="h-full w-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <ImageOff size={14} className={dk("text-gray-600", "text-[#d4d4d4]")} />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${dk("text-white", "text-[#171717]")}`}>
                          {product.name}
                        </p>
                        <p className={`text-[10px] truncate ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
                          {product.sku ? `SKU: ${product.sku}` : ""}{product.sku && product.category ? " · " : ""}{product.category ?? ""}
                        </p>
                      </div>

                      {/* Status */}
                      <div className="flex-shrink-0">
                        {hasImage ? (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${dk("text-emerald-400", "text-emerald-600")}`}>
                            <CheckCircle2 size={11} />
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${dk("text-red-400", "text-red-500")}`}>
                            <XCircle size={11} />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Detail / Suggestions panel */}
        <div className="lg:col-span-2">
          {selectedProduct ? (
            <div className={`rounded-xl border p-4 space-y-4 sticky top-4 ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
              {/* Product header */}
              <div>
                <p className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>
                  {selectedProduct.name}
                </p>
                <p className={`text-[11px] ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
                  {selectedProduct.sku ? `SKU: ${selectedProduct.sku}` : "Sin SKU"}
                  {selectedProduct.brand_name ? ` · ${selectedProduct.brand_name}` : ""}
                </p>
              </div>

              {/* Current image */}
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
                  Imagen actual
                </p>
                <div className={`aspect-square max-w-[200px] rounded-xl border overflow-hidden flex items-center justify-center ${dk("border-[#262626] bg-[#0d0d0d]", "border-[#e5e5e5] bg-[#f5f5f5]")}`}>
                  {selectedProduct.image && selectedProduct.image.startsWith("http") ? (
                    <img
                      src={selectedProduct.image}
                      alt={selectedProduct.name}
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <div className="text-center">
                      <ImageOff size={24} className={dk("text-gray-600", "text-[#d4d4d4]")} />
                      <p className={`text-[11px] mt-1 ${dk("text-gray-600", "text-[#a3a3a3]")}`}>Sin imagen</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Suggestions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
                    Sugerencias
                  </p>
                  <button
                    onClick={() => handleRetrySearch(selectedProduct.id)}
                    disabled={actionLoading === `retry-${selectedProduct.id}`}
                    className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg transition ${dk(
                      "text-gray-500 hover:text-white hover:bg-[#1c1c1c]",
                      "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]"
                    )} disabled:opacity-50`}
                  >
                    <RefreshCw size={9} className={actionLoading === `retry-${selectedProduct.id}` ? "animate-spin" : ""} />
                    Reintentar
                  </button>
                </div>

                {loadingSuggestions ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className={`h-20 ${dk("bg-[#1a1a1a]", "bg-[#f5f5f5]")} rounded-lg animate-pulse`} />
                    ))}
                  </div>
                ) : suggestions.filter((s) => s.status === "pending").length === 0 ? (
                  <p className={`text-xs py-4 text-center ${dk("text-gray-600", "text-[#a3a3a3]")}`}>
                    Sin sugerencias pendientes. Presioná "Reintentar" para buscar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {suggestions
                      .filter((s) => s.status === "pending")
                      .map((suggestion, idx) => (
                      <div
                        key={suggestion.id}
                        className={`rounded-lg border p-2.5 ${dk("border-[#262626] bg-[#0d0d0d]", "border-[#e5e5e5] bg-[#fafafa]")}`}
                      >
                        <div className="flex gap-2.5">
                          {/* Suggestion thumbnail */}
                          <div className={`h-16 w-16 rounded-lg border overflow-hidden flex-shrink-0 flex items-center justify-center ${dk("border-[#333] bg-[#1a1a1a]", "border-[#e5e5e5] bg-white")}`}>
                            <img
                              src={suggestion.image_url}
                              alt={`Sugerencia ${idx + 1}`}
                              className="h-full w-full object-contain p-0.5"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </div>

                          {/* Info + actions */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {idx === 0 && (
                                <Star size={10} className="text-yellow-400 fill-yellow-400" />
                              )}
                              <ScoreBadge score={suggestion.score} isDark={isDark} />
                              <SourceBadge source={suggestion.source} isDark={isDark} />
                            </div>
                            <p className={`text-[10px] truncate mb-1.5 ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
                              {suggestion.image_url.split("/").pop()?.slice(0, 40)}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleApprove(suggestion)}
                                disabled={actionLoading === suggestion.id}
                                className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-[#2D9F6A] hover:bg-[#25835A] text-white transition disabled:opacity-50"
                              >
                                <Check size={10} /> Usar
                              </button>
                              <button
                                onClick={() => handleReject(suggestion)}
                                disabled={actionLoading === suggestion.id}
                                className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border transition disabled:opacity-50 ${dk(
                                  "border-[#333] text-gray-400 hover:text-red-400 hover:border-red-500/30",
                                  "border-[#e5e5e5] text-[#737373] hover:text-red-600 hover:border-red-200"
                                )}`}
                              >
                                <X size={10} /> Rechazar
                              </button>
                              <a
                                href={suggestion.image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-md transition ${dk(
                                  "text-gray-500 hover:text-white",
                                  "text-[#a3a3a3] hover:text-[#171717]"
                                )}`}
                              >
                                <ExternalLink size={10} />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Approved/rejected history */}
                {suggestions.filter((s) => s.status !== "pending").length > 0 && (
                  <details className="mt-3">
                    <summary className={`text-[10px] cursor-pointer ${dk("text-gray-600", "text-[#a3a3a3]")}`}>
                      Historial ({suggestions.filter((s) => s.status !== "pending").length})
                    </summary>
                    <div className="mt-1.5 space-y-1">
                      {suggestions
                        .filter((s) => s.status !== "pending")
                        .map((s) => (
                        <div key={s.id} className={`flex items-center gap-2 text-[10px] px-2 py-1 rounded-md ${dk("bg-[#1a1a1a]", "bg-[#f5f5f5]")}`}>
                          {s.status === "approved" ? (
                            <CheckCircle2 size={10} className="text-emerald-400" />
                          ) : (
                            <XCircle size={10} className="text-red-400" />
                          )}
                          <span className={dk("text-gray-400", "text-[#737373]")}>
                            {s.source} · {Math.round(s.score * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          ) : (
            <div className={`rounded-xl border p-8 text-center ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
              <Eye size={28} className={dk("text-gray-600 mx-auto", "text-[#d4d4d4] mx-auto")} />
              <p className={`text-sm mt-3 ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
                Seleccioná un producto para ver sus imágenes y sugerencias.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
