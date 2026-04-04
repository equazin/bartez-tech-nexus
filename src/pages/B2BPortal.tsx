import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useCatalogSegments } from "@/hooks/useCatalogSegments";
import { supabase } from "@/lib/supabase";
import { useOrders, type PortalOrder } from "@/hooks/useOrders";
import { useQuotes } from "@/hooks/useQuotes";
import { Quote } from "@/models/quote";
import { QuoteList } from "@/components/QuoteList";
import { useCurrency } from "@/context/CurrencyContext";
import { toggleSetValue } from "@/lib/toggleSet";
import {
  LogOut, ShoppingCart, Search, LayoutGrid, List, Package,
  ClipboardList, ShieldCheck, AlertTriangle, CheckCircle2,
  Star, Sun, Moon, FileText, Table2, Zap, RotateCcw, Truck,
  Briefcase, Sparkles, Users, MessageSquare, Shield,
} from "lucide-react";
import { usePricing } from "@/hooks/usePricing";
import { exportCatalogCSV } from "@/lib/exportCsv";
import { exportCatalogPdf } from "@/lib/exportPdf";
import { useNotifications } from "@/hooks/useNotifications";
import ProductCompare from "@/components/ProductCompare";
import { Link } from "react-router-dom";
import { fetchMyInvoices, type Invoice } from "@/lib/api/invoices";
import type { Product } from "@/models/products";
import { OrdersPanel } from "@/components/b2b/OrdersPanel";
import { InvoicesPanel } from "@/components/b2b/InvoicesPanel";
import { ApprovalsPanel } from "@/components/b2b/ApprovalsPanel";
import { RmaPanel } from "@/components/b2b/RmaPanel";
import { PortalHeader } from "@/components/b2b/PortalHeader";
import { PortalSidebar } from "@/components/b2b/PortalSidebar";
import { AccountCenter } from "@/components/b2b/AccountCenter";
import { SupportCenter } from "@/components/b2b/SupportCenter";
import { ProjectsPanel } from "@/components/b2b/ProjectsPanel";
import { ExpressQuoter } from "@/components/b2b/ExpressQuoter";
import { ProductDetailModal } from "@/components/b2b/ProductDetailModal";
import { CatalogSection } from "@/components/b2b/CatalogSection";
import { ClientDashboard } from "@/components/b2b/ClientDashboard";
import type { AssignedSeller } from "@/components/b2b/ClientDashboard";
import type { ViewMode, CatalogContext } from "@/components/b2b/CatalogSection";
import { useClientProjects } from "@/hooks/useClientProjects";
import { useBusinessAlerts } from "@/hooks/useBusinessAlerts";
import { useCartSync } from "@/hooks/useCartSync";
import { useImpersonate } from "@/context/ImpersonateContext";
import { BulkImport } from "@/components/b2b/BulkImport";
import { DetailedAccountView } from "@/components/b2b/DetailedAccountView";
import { usePortalCatalog } from "@/hooks/usePortalCatalog";
import { usePortalCart } from "@/hooks/usePortalCart";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { MapPin } from "lucide-react";
import { OrderStatusBadge as StatusBadge } from "@/components/OrderStatusBadge";

// ── Theme helpers ─────────────────────────────────────────────────────────────

type PortalTab = "home" | "catalog" | "orders" | "quotes" | "projects" | "express" | "invoices" | "cuenta" | "approvals" | "support" | "rma" | "bulk";
type ThemeMode = "dark" | "light";
type ViewModeByContext = Record<CatalogContext, ViewMode>;

const VIEW_MODE_BY_CONTEXT_KEY = "b2b_view_mode_by_context";
const THEME_KEY = "theme";
const DEFAULT_VIEW_MODE_BY_CONTEXT: ViewModeByContext = { default: "list", featured: "grid", pos: "grid" };

function loadViewModeByContext(): ViewModeByContext {
  try {
    const raw = localStorage.getItem(VIEW_MODE_BY_CONTEXT_KEY);
    if (!raw) return DEFAULT_VIEW_MODE_BY_CONTEXT;
    const parsed = JSON.parse(raw) as Partial<ViewModeByContext>;
    const valid = (v: unknown): v is ViewMode => v === "grid" || v === "list" || v === "table";
    return {
      default:  valid(parsed.default)  ? parsed.default  : DEFAULT_VIEW_MODE_BY_CONTEXT.default,
      featured: valid(parsed.featured) ? parsed.featured : DEFAULT_VIEW_MODE_BY_CONTEXT.featured,
      pos:      valid(parsed.pos)      ? parsed.pos      : DEFAULT_VIEW_MODE_BY_CONTEXT.pos,
    };
  } catch {
    return DEFAULT_VIEW_MODE_BY_CONTEXT;
  }
}

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch { /* ignore */ }
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark" : "light";
}

function normalizePortalText(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isPosCategoryValue(value: unknown): boolean {
  const norm = normalizePortalText(value);
  return norm.includes("punto de venta") || /\bpos\b/i.test(norm);
}

// ─────────────────────────────────────────────────────────────────────────────

export default function B2BPortal() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile: authProfile, user, isAdmin, signOut } = useAuth();
  const { activeProfile: profile, isImpersonating, stopImpersonation } = useImpersonate();
  const { computePrice } = usePricing(profile);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [catalogContext, setCatalogContext] = useState<CatalogContext>("default");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<PortalTab>("home");
  const [viewModeByContext, setViewModeByContext] = useState<ViewModeByContext>(() => loadViewModeByContext());
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadViewModeByContext().default);
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [themeFlash, setThemeFlash] = useState(false);
  const [themeSwitchReady, setThemeSwitchReady] = useState(false);
  const [compareList, setCompareList] = useState<number[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; address: string; allows_pickup: boolean }[]>([]);

  const isDark = theme === "dark";
  const dk = (d: string, l: string) => isDark ? d : l;

  // ── Dynamic dashboard data ────────────────────────────────────────────────
  const dashboardUserId = profile?.id ?? "";
  const { projects, createProject } = useClientProjects(dashboardUserId);
  const { alerts } = useBusinessAlerts(dashboardUserId);
  const [assignedSeller, setAssignedSeller] = useState<AssignedSeller | null>(null);

  useEffect(() => {
    if (!profile?.assigned_seller_id) { setAssignedSeller(null); return; }
    supabase.from("profiles").select("id, contact_name, phone")
      .eq("id", profile.assigned_seller_id).single()
      .then(({ data }) => {
        if (data) {
          const raw = data as { id: string; contact_name: string; phone?: string };
          setAssignedSeller({ id: raw.id, name: raw.contact_name, phone: raw.phone });
        }
      });
  }, [profile?.assigned_seller_id]);

  // ── Catalog data (categories, filters, display products) ──────────────────
  const { hiddenProductIds } = useCatalogSegments(profile?.id);

  const catalog = usePortalCatalog({
    catalogContext,
    isAdmin: !!isAdmin,
    hiddenProductIds,
  });

  // Override useProducts search from portal header
  // NOTE: usePortalCatalog manages its own search internally via useProducts.
  // We pass search from the header to filter; catalog.products already respects it
  // via its own useProducts call. However search is a separate state in the header.
  // For now we keep search in portal and use displayProducts which already filters.

  // ── Cart, orders, quotes ──────────────────────────────────────────────────
  const { orders, addOrder, updateOrder, fetchOrders, fetchManagedOrders } = useOrders();
  const [managedOrders, setManagedOrders] = useState<PortalOrder[]>([]);
  const { quotes, addQuote, updateStatus: updateQuoteStatus, deleteQuote } = useQuotes(profile?.id || "guest");
  const { currency, setCurrency, formatPrice, formatUSD, formatARS, exchangeRate, fetchExchangeRate, isFetchingRate } = useCurrency();

  const cart = usePortalCart({
    profile,
    products: catalog.products,
    computePrice,
    currency,
    orders,
    addOrder,
    updateOrder,
    addQuote,
    updateQuoteStatus,
    navigate,
    setActiveTab,
  });

  // ── Credit ────────────────────────────────────────────────────────────────
  const creditUsed = useMemo(() =>
    orders.filter((o) => ["pending", "approved", "preparing"].includes(o.status))
      .reduce((s, o) => s + o.total, 0),
    [orders]
  );

  // ── Invoices ──────────────────────────────────────────────────────────────
  const [myInvoices, setMyInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const loadMyInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try { const data = await fetchMyInvoices(); setMyInvoices(data); }
    catch { /* non-blocking */ }
    finally { setLoadingInvoices(false); }
  }, []);

  const refreshApprovals = useCallback(async () => {
    const data = await fetchManagedOrders();
    setManagedOrders(data);
  }, [fetchManagedOrders]);

  useEffect(() => {
    if (activeTab === "invoices" || activeTab === "cuenta" || activeTab === "home") loadMyInvoices();
    if (activeTab === "approvals") refreshApprovals();
  }, [activeTab, loadMyInvoices, refreshApprovals]);

  // ── Cart sync with Supabase ───────────────────────────────────────────────
  useCartSync(cart.cart, cart.setCart);

  // ── Shared cart token from URL ────────────────────────────────────────────
  const cartKey = `b2b_cart_${profile?.id || "guest"}`;
  const cartToken = searchParams.get("cart_token");
  useEffect(() => {
    if (!cartToken || !profile) return;
    supabase.from("shared_carts").select("items").eq("id", cartToken).single().then(({ data }) => {
      if (data?.items) {
        const newCart: Record<number, number> = {};
        (data.items as { product_id: number; quantity: number }[]).forEach((item) => {
          newCart[item.product_id] = item.quantity;
        });
        cart.setCart(newCart);
        localStorage.setItem(cartKey, JSON.stringify(newCart));
        searchParams.delete("cart_token");
        setSearchParams(searchParams);
        alert("¡Carrito reconstruido desde el enlace compartido!");
      }
    });
  }, [cartToken, profile]);

  // ── Warehouses ────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from("warehouses").select("*").eq("is_active", true).then(({ data }) => {
      if (data) setWarehouses(data as typeof warehouses);
    });
  }, []);

  // ── noindex meta ──────────────────────────────────────────────────────────
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  // ── Theme effects ─────────────────────────────────────────────────────────
  const toggleTheme = () => { setTheme((prev) => (prev === "dark" ? "light" : "dark")); setThemeFlash(true); };

  useEffect(() => { localStorage.setItem(THEME_KEY, theme); document.documentElement.classList.toggle("dark", isDark); }, [theme, isDark]);
  useEffect(() => { if (!themeFlash) return; const t = window.setTimeout(() => setThemeFlash(false), 260); return () => window.clearTimeout(t); }, [themeFlash]);
  useEffect(() => { const raf = window.requestAnimationFrame(() => setThemeSwitchReady(true)); return () => window.cancelAnimationFrame(raf); }, []);

  // ── View mode effects ─────────────────────────────────────────────────────
  useEffect(() => { setViewMode(viewModeByContext[catalogContext]); }, [catalogContext, viewModeByContext]);
  useEffect(() => { localStorage.setItem(VIEW_MODE_BY_CONTEXT_KEY, JSON.stringify(viewModeByContext)); }, [viewModeByContext]);

  // ── Catalog context from URL ──────────────────────────────────────────────
  useEffect(() => {
    const categoryParam = searchParams.get("category");
    if (isPosCategoryValue(categoryParam)) { setCatalogContext("pos"); return; }
    const ctx = normalizePortalText(searchParams.get("context"));
    if (ctx === "featured" || ctx === "oportunidades") setCatalogContext("featured");
    else if (ctx === "default") setCatalogContext("default");
  }, [searchParams]);

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    setViewModeByContext((prev) => ({ ...prev, [catalogContext]: mode }));
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  useNotifications(profile?.id, orders, catalog.products);

  // ── Compare ───────────────────────────────────────────────────────────────
  function toggleCompare(productId: number) {
    setCompareList((prev) => {
      if (prev.includes(productId)) return prev.filter((id) => id !== productId);
      if (prev.length >= 3) return prev;
      return [...prev, productId];
    });
  }

  // ── Display products (requires purchase history and margins from cart hook) ─
  const displayProducts = useMemo(
    () => catalog.displayProducts(cart.purchaseHistory, cart.productMargins ?? {}, cart.globalMargin),
    [catalog, cart.purchaseHistory, cart.productMargins, cart.globalMargin]
  );

  const favoriteProducts = useMemo(
    () => catalog.products.filter((p) => cart.favoriteProductIds.includes(p.id)),
    [cart.favoriteProductIds, catalog.products]
  );

  async function handleExportCatalogPDF() {
    await exportCatalogPdf(displayProducts, formatPrice, currency);
  }

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  // ── Render ────────────────────────────────────────────────────────────────
  const clientName = profile?.company_name ?? profile?.contact_name ?? "Cliente";
  const defaultMargin = profile?.default_margin ?? 20;

  return (
    <div className={`flex min-h-screen ${dk("bg-[#0a0a0a]", "bg-[#f5f5f5]")} flex-col`}>

      {/* TOPBAR */}
      <PortalHeader
        clientName={clientName}
        search={search}
        setSearch={setSearch}
        quickSku={cart.quickSku}
        setQuickSku={cart.setQuickSku}
        quickError={cart.quickError}
        handleQuickOrder={cart.handleQuickOrder}
        viewMode={viewMode}
        handleViewModeChange={handleViewModeChange}
        currency={currency}
        setCurrency={setCurrency}
        isDark={isDark}
        toggleTheme={toggleTheme}
        themeFlash={themeFlash}
        themeSwitchReady={themeSwitchReady}
        activeTab={activeTab}
        displayProducts={displayProducts}
        exportCatalogCSV={exportCatalogCSV}
        handleExportCatalogPDF={handleExportCatalogPDF}
        cartItemsCount={cart.cartCount}
        onOpenCart={() => navigate("/cart")}
        exchangeRate={exchangeRate}
        onRefreshRate={() => fetchExchangeRate().catch(() => {})}
        isFetchingRate={isFetchingRate}
      />

      {/* TABS */}
      <div className={`flex border-b ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")} px-4 md:px-6 overflow-x-auto whitespace-nowrap scrollbar-none`}>
        {[
          { id: "home",     label: "Inicio",        icon: LayoutGrid },
          { id: "catalog",  label: "Catálogo",       icon: Package },
          { id: "orders",   label: `Mis Pedidos${orders.length ? ` (${orders.length})` : ""}`, icon: ClipboardList },
          { id: "projects", label: "Proyectos",      icon: Briefcase },
          { id: "express",  label: "Cotizador Express", icon: Sparkles },
          { id: "quotes",   label: `Cotizaciones${quotes.length ? ` (${quotes.length})` : ""}`, icon: FileText },
          { id: "invoices", label: `Facturas${myInvoices.length ? ` (${myInvoices.length})` : ""}`, icon: FileText },
          { id: "cuenta",   label: "Mi Cuenta",      icon: Users },
          ...(profile?.b2b_role === "manager" || isAdmin ? [{
            id: "approvals",
            label: `Aprobaciones${managedOrders.filter(o => o.status === "pending_approval").length ? ` (${managedOrders.filter(o => o.status === "pending_approval").length})` : ""}`,
            icon: ShieldCheck,
          }] : []),
          { id: "rma", label: "Devoluciones", icon: RotateCcw },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as PortalTab)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === id
                ? `border-[#2D9F6A] ${dk("text-white", "text-[#171717]")}`
                : `border-transparent ${dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#737373] hover:text-[#525252]")}`
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* BANNER SOPORTE (Impersonate) */}
      {isImpersonating && (
        <div className="bg-red-600 text-white px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-4 z-[100] sticky top-0 shadow-lg animate-pulse">
          <div className="flex items-center gap-2">
            <Shield size={14} />
            MODO SOPORTE ACTIVO: {profile?.company_name || profile?.contact_name}
          </div>
          <button onClick={stopImpersonation} className="bg-white text-red-600 px-3 py-1 rounded-full hover:bg-red-50 transition-colors shadow-sm">
            Detener sesión de soporte
          </button>
        </div>
      )}

      {/* BANNER ADMIN */}
      {isAdmin && (
        <div className={`flex items-center justify-between ${dk("bg-[#111] border-[#1a1a1a]", "bg-[#f9f9f9] border-[#e5e5e5]")} border-b px-4 md:px-6 py-2`}>
          <div className="flex items-center gap-2 text-[#737373] text-xs font-medium">
            <ShieldCheck size={13} /> Vista de administrador
          </div>
          <Link to="/admin" className={`flex items-center gap-1.5 ${dk("bg-[#1c1c1c] hover:bg-[#262626] text-[#a3a3a3] hover:text-white border-[#262626] hover:border-[#333]", "bg-white hover:bg-[#f5f5f5] text-[#525252] hover:text-[#171717] border-[#e5e5e5] hover:border-[#d4d4d4]")} text-xs font-medium px-3 py-1.5 rounded-lg border transition`}>
            <ShieldCheck size={11} /> Panel Admin
          </Link>
        </div>
      )}

      {/* BANNER CLIENTE */}
      {profile && !isAdmin && (
        <div className={`flex flex-wrap items-center gap-x-5 gap-y-1 ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-[#f9f9f9] border-[#e5e5e5]")} border-b px-4 md:px-6 py-2`}>
          <span className={`text-xs font-semibold ${dk("text-gray-300", "text-[#525252]")}`}>
            {profile.company_name || profile.contact_name}
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${dk("bg-[#1c1c1c] text-[#a3a3a3] border-[#2a2a2a]", "bg-[#f0f0f0] text-[#525252] border-[#e5e5e5]")} border capitalize`}>
            {profile.client_type ?? "mayorista"}
          </span>
          <span className={`text-[11px] ${dk("text-gray-500", "text-[#737373]")}`}>
            Margen: <span className="font-semibold text-[#2D9F6A]">{defaultMargin}%</span>
          </span>
          {profile.credit_limit != null && profile.credit_limit > 0 && (() => {
            const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
            const creditAvail = Math.max(0, profile.credit_limit! - creditUsed);
            const pct = Math.min(100, (creditUsed / profile.credit_limit!) * 100);
            const danger = pct >= 80;
            return (
              <div className="flex items-center gap-2 ml-auto">
                <span className={`text-[11px] ${dk("text-gray-500", "text-[#737373]")}`}>
                  Crédito: <span className={`font-semibold ${danger ? "text-red-400" : "text-[#2D9F6A]"}`}>{fmt(creditAvail)}</span>
                  <span className={`${dk("text-gray-700", "text-[#c4c4c4]")} ml-1`}>/ {fmt(profile.credit_limit!)}</span>
                </span>
                <div className={`w-24 h-1.5 rounded-full ${dk("bg-[#1c1c1c]", "bg-[#e5e5e5]")} overflow-hidden`}>
                  <div className={`h-full rounded-full transition-all ${danger ? "bg-red-500" : "bg-[#2D9F6A]"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Global banners */}
      {cart.creditError && (
        <div className="mx-4 mt-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3 text-sm font-medium flex items-center gap-2">
          <AlertTriangle size={15} /> {cart.creditError}
        </div>
      )}
      {cart.orderSuccess && (
        <div className={`mx-4 mt-3 ${dk("bg-green-900/20 border-green-500/30 text-green-400", "bg-green-50 border-green-200 text-green-700")} border rounded-xl p-3 text-sm font-medium flex items-center gap-2`}>
          <CheckCircle2 size={15} /> Pedido confirmado. Lo estamos revisando y te contactaremos pronto.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* SIDEBAR */}
        {activeTab === "catalog" && (
          <PortalSidebar
            isDark={isDark}
            hasActiveFilters={catalog.hasActiveFilters}
            clearFilters={catalog.clearFilters}
            categoryFilter={catalog.categoryFilter}
            setCategoryFilter={catalog.setCategoryFilter}
            categoryCounts={catalog.categoryCounts}
            categoryTree={catalog.categoryTree}
            expandedParents={catalog.expandedParents}
            setExpandedParents={catalog.setExpandedParents}
            toggleSetValue={toggleSetValue}
            activeBrandsWithProducts={catalog.activeBrandsWithProducts}
            brandFilter={catalog.brandFilter}
            setBrandFilter={catalog.setBrandFilter}
            brandCounts={catalog.brandCounts}
            minPrice={catalog.minPrice}
            setMinPrice={catalog.setMinPrice}
            maxPrice={catalog.maxPrice}
            setMaxPrice={catalog.setMaxPrice}
            totalProductsCount={catalog.totalCount || catalog.products.length}
          />
        )}

        {/* MAIN CONTENT */}
        <main className="flex-1 p-4 md:p-5 overflow-y-auto">

          {/* HOME */}
          {activeTab === "home" && profile && (
            <ClientDashboard
              profile={profile}
              orders={orders}
              invoices={myInvoices}
              products={catalog.products}
              creditLimit={profile.credit_limit ?? 0}
              creditUsed={creditUsed}
              isDark={isDark}
              onGoTo={(tab) => setActiveTab(tab as PortalTab)}
              onAddToCart={cart.handleSmartAddToCart}
              projects={projects}
              onCreateProject={createProject}
              alerts={alerts}
              assignedSeller={assignedSeller}
            />
          )}

          {/* CATALOG */}
          {activeTab === "catalog" && (
            <CatalogSection
              displayProducts={displayProducts}
              products={catalog.products}
              productsLoading={catalog.productsLoading}
              totalCount={catalog.totalCount}
              hasMore={catalog.hasMore}
              loadMore={catalog.loadMore}
              search={search}
              hasActiveFilters={catalog.hasActiveFilters}
              clearFilters={catalog.clearFilters}
              viewMode={viewMode}
              handleViewModeChange={handleViewModeChange}
              catalogContext={catalogContext}
              setCatalogContext={setCatalogContext}
              isDark={isDark}
              dk={dk}
              cart={cart.cart}
              computePrice={computePrice}
              formatPrice={formatPrice}
              productMargins={cart.productMargins ?? {}}
              globalMargin={cart.globalMargin}
              handleAddToCart={cart.handleAddToCart}
              onRemoveFromCart={cart.onRemoveFromCart}
              handleSmartAddToCart={cart.handleSmartAddToCart}
              handleToggleFavorite={cart.handleToggleFavorite}
              toggleCompare={toggleCompare}
              setSelectedProduct={setSelectedProduct}
              setBrandFilter={catalog.setBrandFilter}
              isPosProduct={catalog.isPosProduct}
              favoriteProductIds={cart.favoriteProductIds}
              compareList={compareList}
              addedIds={cart.addedIds}
              purchaseHistory={cart.purchaseHistory}
              latestPurchaseUnitPrice={cart.latestPurchaseUnitPrice}
            />
          )}

          {/* ORDERS */}
          {activeTab === "orders" && (
            <OrdersPanel
              isDark={isDark}
              orders={orders}
              invoices={myInvoices}
              formatPrice={formatPrice}
              formatUSD={formatUSD}
              formatARS={formatARS}
              currency={currency}
              onRepeatOrder={cart.handleRepeatOrder}
              onGoToCatalog={() => setActiveTab("catalog")}
              onGoToInvoices={() => setActiveTab("invoices")}
              onUpdateOrderProofs={(id, pr) => updateOrder(id, { payment_proofs: pr })}
            />
          )}

          {/* QUOTES */}
          {activeTab === "quotes" && (
            <QuoteList
              quotes={quotes}
              isDark={isDark}
              onLoad={cart.handleLoadQuote}
              onUpdateStatus={updateQuoteStatus}
              onDelete={deleteQuote}
              onGoToCatalog={() => setActiveTab("catalog")}
              onDuplicate={(id) => cart.handleDuplicateQuote(id, quotes)}
              onConvertToOrder={cart.handleConvertQuoteToOrder}
            />
          )}

          {/* EXPRESS QUOTER */}
          {activeTab === "express" && (
            <ExpressQuoter
              products={catalog.products}
              onAddToCart={cart.handleSmartAddToCart}
              isDark={isDark}
            />
          )}

          {/* ACCOUNT */}
          {activeTab === "cuenta" && profile && (
            <AccountCenter
              profile={profile}
              sessionEmail={user?.email}
              isDark={isDark}
              orders={orders}
              quotes={quotes}
              invoices={myInvoices}
              favoriteProducts={favoriteProducts}
              savedCarts={cart.savedCarts}
              onGoToTab={setActiveTab}
              onLoadSavedCart={cart.handleLoadSavedCart}
              onDeleteSavedCart={cart.handleDeleteSavedCart}
            />
          )}

          {/* INVOICES */}
          {activeTab === "invoices" && (
            <InvoicesPanel
              invoices={myInvoices}
              orders={orders}
              isDark={isDark}
              loading={loadingInvoices}
              onGoToOrders={() => setActiveTab("orders")}
            />
          )}

          {/* APPROVALS */}
          {activeTab === "approvals" && (
            <ApprovalsPanel
              isDark={isDark}
              formatPrice={formatPrice}
              formatUSD={formatUSD}
              formatARS={formatARS}
              currency={currency}
              orders={managedOrders}
              onRefresh={refreshApprovals}
            />
          )}

          {/* PROJECTS */}
          {activeTab === "projects" && (
            <ProjectsPanel
              orders={orders}
              quotes={quotes}
              profileId={profile?.id || "guest"}
              isDark={isDark}
            />
          )}

          {/* SUPPORT */}
          {activeTab === "support" && (
            <SupportCenter isDark={isDark} orders={orders} />
          )}

          {/* RMA */}
          {activeTab === "rma" && profile && (
            <RmaPanel clientId={profile.id} orders={orders} isDark={isDark} />
          )}

          {/* BULK IMPORT */}
          {activeTab === "bulk" && (
            <BulkImport
              products={catalog.products}
              isDark={isDark}
              onAddAll={(items) => {
                items.forEach((it) => cart.handleSmartAddToCart(it.product, it.quantity));
                setActiveTab("catalog");
              }}
            />
          )}

          {/* PICKUP POINTS MODAL */}
          <Dialog open={!!confirmingOrderId} onOpenChange={() => {}}>
            <DialogContent className={`${isDark ? "bg-[#0d0d0d] border-[#1a1a1a] text-white" : "bg-white text-black"}`}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPin className="text-[#2D9F6A]" /> Seleccionar Punto de Retiro
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-3 py-4">
                {warehouses.filter((w) => w.allows_pickup).map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {}}
                    className={`p-3 rounded-xl border text-left transition ${isDark ? "bg-[#111] border-[#1f1f1f] hover:bg-[#1a1a1a]" : "bg-[#f8f8f8] border-[#eee] hover:bg-[#f0f0f0]"}`}
                  >
                    <p className="text-xs font-bold">{w.name}</p>
                    <p className="text-[10px] text-gray-500">{w.address}</p>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>

        </main>
      </div>

      {/* COMPARE FLOAT */}
      {compareList.length > 0 && (
        <ProductCompare
          products={catalog.products.filter((p) => compareList.includes(p.id))}
          onRemove={(id) => setCompareList((prev) => prev.filter((x) => x !== id))}
          onClear={() => setCompareList([])}
          formatPrice={formatPrice}
          currency={currency}
        />
      )}

      {/* PRODUCT MODAL */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          inCart={cart.cart[selectedProduct.id] || 0}
          computePrice={computePrice}
          formatPrice={formatPrice}
          formatARS={formatARS}
          formatUSD={formatUSD}
          currency={currency}
          setCurrency={setCurrency}
          isDark={isDark}
          dk={dk}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={cart.handleAddToCart}
          onRemoveFromCart={cart.onRemoveFromCart}
        />
      )}
    </div>
  );
}
