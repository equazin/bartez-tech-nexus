import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useCatalogSegments } from "@/hooks/useCatalogSegments";
import { supabase } from "@/lib/supabase";
import { useOrders, type PortalOrder } from "@/hooks/useOrders";
import { useQuotes } from "@/hooks/useQuotes";
import { Quote } from "@/models/quote";
import { useCurrency } from "@/context/CurrencyContext";
import { toggleSetValue } from "@/lib/toggleSet";
import {
  LogOut, ShoppingCart, Search, LayoutGrid, List, Package,
  ClipboardList, ShieldCheck, AlertTriangle, CheckCircle2,
  Star, Sun, Moon, FileText, Table2, Zap, RotateCcw, Truck,
  Briefcase, Sparkles, Users, MessageSquare, Shield, BadgeCheck,
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
import { useAppTheme } from "@/hooks/useAppTheme";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { MapPin } from "lucide-react";
import { OrderStatusBadge as StatusBadge } from "@/components/OrderStatusBadge";

// â”€â”€ Theme helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type PortalTab = "home" | "catalog" | "orders" | "quotes" | "projects" | "express" | "invoices" | "cuenta" | "approvals" | "support" | "rma" | "bulk";
type ViewModeByContext = Record<CatalogContext, ViewMode>;

const VIEW_MODE_BY_CONTEXT_KEY = "b2b_view_mode_by_context";
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

function normalizePortalText(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isPosCategoryValue(value: unknown): boolean {
  const norm = normalizePortalText(value);
  return norm.includes("punto de venta") || /\bpos\b/i.test(norm);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function B2BPortal() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile: authProfile, user, isAdmin, signOut } = useAuth();
  const { activeProfile: profile, isImpersonating, stopImpersonation } = useImpersonate();
  const { computePrice, activeAgreement } = usePricing(profile);

  // â”€â”€ UI state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [catalogContext, setCatalogContext] = useState<CatalogContext>("default");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<PortalTab>("home");
  const dk = (dark: string, light: string) => (isDark ? dark : light);
  const [viewModeByContext, setViewModeByContext] = useState<ViewModeByContext>(() => loadViewModeByContext());
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadViewModeByContext().default);
  const [themeFlash, setThemeFlash] = useState(false);
  const [themeSwitchReady, setThemeSwitchReady] = useState(true);
  const [compareList, setCompareList] = useState<number[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; address: string; allows_pickup: boolean }[]>([]);

  const { isDark, toggleTheme: toggleAppTheme } = useAppTheme();

  // â”€â”€ Dynamic dashboard data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Catalog data (categories, filters, display products) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Cart, orders, quotes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    setActiveTab: (tab) => setActiveTab(tab as PortalTab),
  });
  const { setCart } = cart;
  const formatQuickPrice = useCallback((product: Product) => formatPrice(computePrice(product, 1).unitPrice), [computePrice, formatPrice]);

  // â”€â”€ Credit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const creditUsed = useMemo(() =>
    orders.filter((o) => ["pending", "approved", "preparing"].includes(o.status))
      .reduce((s, o) => s + o.total, 0),
    [orders]
  );

  // â”€â”€ Invoices â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Cart sync with Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useCartSync(cart.cart, cart.setCart);

  // â”€â”€ Shared cart token from URL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        setCart(newCart);
        localStorage.setItem(cartKey, JSON.stringify(newCart));
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("cart_token");
        setSearchParams(nextParams);
        alert("¡Carrito reconstruido desde el enlace compartido!");
      }
    });
  }, [cartToken, profile, cartKey, searchParams, setCart, setSearchParams]);

  // â”€â”€ Warehouses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    supabase.from("warehouses").select("*").eq("is_active", true).then(({ data }) => {
      if (data) setWarehouses(data as typeof warehouses);
    });
  }, []);

  // â”€â”€ noindex meta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  // â”€â”€ Theme effects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const toggleTheme = () => { toggleAppTheme(); setThemeFlash(true); };

  useEffect(() => { if (!themeFlash) return; const t = window.setTimeout(() => setThemeFlash(false), 260); return () => window.clearTimeout(t); }, [themeFlash]);
  useEffect(() => { const raf = window.requestAnimationFrame(() => setThemeSwitchReady(true)); return () => window.cancelAnimationFrame(raf); }, []);

  // â”€â”€ View mode effects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => { setViewMode(viewModeByContext[catalogContext]); }, [catalogContext, viewModeByContext]);
  useEffect(() => { localStorage.setItem(VIEW_MODE_BY_CONTEXT_KEY, JSON.stringify(viewModeByContext)); }, [viewModeByContext]);

  // â”€â”€ Catalog context from URL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const categoryParam = searchParams.get("category");
    if (isPosCategoryValue(categoryParam)) { setCatalogContext("pos"); return; }
    const ctx = normalizePortalText(searchParams.get("context"));
    if (ctx === "featured" || ctx === "oportunidades") setCatalogContext("featured");
    else if (ctx === "default") setCatalogContext("default");

    // Redirect old tabs to Account Hub
    const tabParam = searchParams.get("tab");
    if (tabParam === "quotes" || tabParam === "express" || tabParam === "payments") {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "cuenta");
        next.set("section", tabParam);
        return next;
      });
      setActiveTab("cuenta");
    }
  }, [searchParams, setSearchParams]);

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    setViewModeByContext((prev) => ({ ...prev, [catalogContext]: mode }));
  }

  // â”€â”€ Notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useNotifications(profile?.id, orders, catalog.products);

  // â”€â”€ Compare â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function toggleCompare(productId: number) {
    setCompareList((prev) => {
      if (prev.includes(productId)) return prev.filter((id) => id !== productId);
      if (prev.length >= 3) return prev;
      return [...prev, productId];
    });
  }

  // â”€â”€ Display products (requires purchase history and margins from cart hook) â”€
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

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const clientName = profile?.company_name ?? profile?.contact_name ?? "Cliente";
  const defaultMargin = profile?.default_margin ?? 20;

  return (
    <div className="dashboard-stage min-h-screen bg-background px-2 py-2 md:px-4 md:py-4">
      <div className="dashboard-canvas flex min-h-[calc(100vh-1rem)] flex-col overflow-hidden">

      {/* TOPBAR */}
      <PortalHeader
        clientName={clientName}
        search={search}
        setSearch={setSearch}
        currency={currency}
        setCurrency={setCurrency}
        isDark={isDark}
        toggleTheme={toggleTheme}
        themeFlash={themeFlash}
        themeSwitchReady={themeSwitchReady}
        cartItemsCount={cart.cartCount}
        onOpenCart={() => navigate("/cart")}
        onLogout={handleLogout}
        exchangeRate={exchangeRate}
        onRefreshRate={() => fetchExchangeRate().catch(() => {})}
        isFetchingRate={isFetchingRate}
      />


      {/* TABS */}
      <div className="flex overflow-x-auto whitespace-nowrap border-b border-border/70 bg-card/75 px-4 py-1.5 scrollbar-none md:px-6">
        {[
          { id: "home",     label: "Inicio",        icon: LayoutGrid },
          { id: "catalog",  label: "Catálogo",        icon: Package },
          { id: "orders",   label: `Mis Pedidos${orders.length ? ` (${orders.length})` : ""}`, icon: ClipboardList },
          { id: "projects", label: "Proyectos",      icon: Briefcase },
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
            className={`mx-0.5 my-0.5 flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-sm font-medium transition ${
              activeTab === id ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* BANNER SOPORTE (Impersonate) */}
      {isImpersonating && (
        <div className="sticky top-0 z-[100] flex items-center justify-center gap-4 bg-destructive px-4 py-2 text-center text-xs font-bold text-destructive-foreground shadow-lg">
          <div className="flex items-center gap-2">
            <Shield size={14} />
            MODO SOPORTE ACTIVO: {profile?.company_name || profile?.contact_name}
          </div>
          <button onClick={stopImpersonation} className="rounded-full bg-background px-3 py-1 text-destructive transition-colors hover:bg-background/90">
            Detener sesión de soporte
          </button>
        </div>
      )}

      {/* BANNER ADMIN */}
      {isAdmin && (
        <div className="flex items-center justify-between border-b border-border/70 bg-muted/30 px-4 py-2 md:px-6">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <ShieldCheck size={13} /> Vista de administrador
          </div>
          <Link to="/admin" className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <ShieldCheck size={11} /> Panel Admin
          </Link>
        </div>
      )}

      {/* BANNER CLIENTE */}
      {profile && !isAdmin && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-border/70 bg-muted/20 px-4 py-2 md:px-6">
          <span className="text-xs font-semibold text-foreground">
            {profile.company_name || profile.contact_name}
          </span>
          <span className="rounded-full border border-border/70 bg-card px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">
            {profile.client_type ?? "mayorista"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            Margen: <span className="font-semibold text-primary">{defaultMargin}%</span>
          </span>
          {profile.credit_limit != null && profile.credit_limit > 0 && (() => {
            const fmt = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
            const creditAvail = Math.max(0, profile.credit_limit! - creditUsed);
            const pct = Math.min(100, (creditUsed / profile.credit_limit!) * 100);
            const danger = pct >= 80;
            return (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  Crédito:<span className={`font-semibold ${danger ? "text-destructive" : "text-primary"}`}>{fmt(creditAvail)}</span>
                  <span className="ml-1 text-muted-foreground/80">/ {fmt(profile.credit_limit!)}</span>
                </span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full transition-all ${danger ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Active price agreement banner */}
      {activeAgreement && !isAdmin && (
        <div className="flex items-center gap-2 border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-[11px] font-semibold text-emerald-600 md:px-6 dark:text-emerald-400">
          <BadgeCheck size={12} />
          Acuerdo de precio activo: <span className="font-bold">{activeAgreement.name}</span>
          {activeAgreement.margin_pct != null && <span className="opacity-70">Â· Margen {activeAgreement.margin_pct}%</span>}
          {activeAgreement.discount_pct > 0 && <span className="opacity-70">Â· Descuento adicional -{activeAgreement.discount_pct}%</span>}
          {activeAgreement.valid_until && (
            <span className="ml-auto opacity-60">Vigente hasta {new Date(activeAgreement.valid_until).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}</span>
          )}
        </div>
      )}

      {/* Global banners */}
      {cart.creditError && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive md:mx-6">
          <AlertTriangle size={15} /> {cart.creditError}
        </div>
      )}
      {cart.orderSuccess && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-600 md:mx-6 dark:text-emerald-400">
          <CheckCircle2 size={15} /> Pedido confirmado. Lo estamos revisando y te contactaremos pronto.
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">

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
        <main className="flex-1 overflow-y-auto bg-transparent p-3 md:p-4 lg:p-5">

          {/* HOME */}
          {activeTab === "home" && profile && (
            <ClientDashboard
              profile={profile}
              orders={orders}
              invoices={myInvoices}
              products={catalog.products}
              creditLimit={profile.credit_limit ?? 0}
              creditUsed={creditUsed}
              onGoTo={(tab) => setActiveTab(tab as PortalTab)}
              onAddToCart={cart.handleSmartAddToCart}
              projects={projects}
              onCreateProject={createProject}
              alerts={alerts}
              assignedSeller={assignedSeller}
              activeAgreement={activeAgreement}
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
              cart={cart.cart}
              computePrice={computePrice}
              formatPrice={formatPrice}
              productMargins={cart.productMargins ?? {}}
              globalMargin={cart.globalMargin}
              onRemoveFromCart={cart.onRemoveFromCart}
              handleSmartAddToCart={cart.handleSmartAddToCart}
              handleToggleFavorite={cart.handleToggleFavorite}
              toggleCompare={toggleCompare}
              setSelectedProduct={setSelectedProduct}
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

          {/* ACCOUNT */}
          {activeTab === "cuenta" && profile && (
            <AccountCenter
              profile={profile}
              sessionEmail={authProfile?.email}
              orders={orders}
              quotes={quotes}
              invoices={myInvoices}
              favoriteProducts={favoriteProducts}
              savedCarts={cart.savedCarts}
              onNavigateToTab={setActiveTab}
              onLoadSavedCart={cart.handleLoadSavedCart}
              onDeleteSavedCart={cart.deleteSavedCart}
              isDark={isDark}
              onLoadQuote={cart.handleLoadQuote}
              onUpdateQuoteStatus={updateQuoteStatus}
              onDeleteQuote={deleteQuote}
              onDuplicateQuote={(id) => cart.handleDuplicateQuote(id, quotes)}
              onConvertQuoteToOrder={cart.handleConvertQuoteToOrder}
              products={catalog.products}
              onAddToCart={cart.handleSmartAddToCart}
            />
          )}

          {/* INVOICES */}
          {activeTab === "invoices" && (
            <InvoicesPanel
              invoices={myInvoices}
              orders={orders}
              loading={loadingInvoices}
              onGoToOrders={() => setActiveTab("orders")}
            />
          )}

          {/* APPROVALS */}
          {activeTab === "approvals" && (
            <ApprovalsPanel
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
            />
          )}

          {/* SUPPORT */}
          {activeTab === "support" && (
            <SupportCenter orders={orders} />
          )}

          {/* RMA */}
          {activeTab === "rma" && profile && (
            <RmaPanel clientId={profile.id} orders={orders} />
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPin className="text-primary" /> Seleccionar Punto de Retiro
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-3 py-4">
                {warehouses.filter((w) => w.allows_pickup).map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {}}
                    className="p-3 rounded-xl border border-border/70 bg-secondary/30 hover:bg-secondary text-left transition"
                  >
                    <p className="text-xs font-bold text-foreground">{w.name}</p>
                    <p className="text-[10px] text-muted-foreground">{w.address}</p>
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
          onClose={() => setSelectedProduct(null)}
          onAddToCart={cart.handleAddToCart}
          onRemoveFromCart={cart.onRemoveFromCart}
        />
      )}
      </div>
    </div>
  );
}




