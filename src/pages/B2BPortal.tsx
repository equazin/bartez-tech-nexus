import { useState, useMemo, useEffect, useCallback, useRef } from "react";
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
  Briefcase, Sparkles, Users, MessageSquare, Shield, BadgeCheck, Cpu, Upload,
} from "lucide-react";
import { usePricing } from "@/hooks/usePricing";
import { exportCatalogCSV } from "@/lib/exportCsv";
import { exportCatalogPdf } from "@/lib/exportPdf";
import { useNotifications } from "@/hooks/useNotifications";
import ProductCompare from "@/components/ProductCompare";
import { ComparisonBar } from "@/components/b2b/ComparisonBar";
import { Link } from "react-router-dom";
import { fetchMyInvoices, type Invoice } from "@/lib/api/invoices";
import type { Product } from "@/models/products";
import { getRecentlyViewedIds, addRecentlyViewed, clearRecentlyViewed } from "@/components/b2b/RecentlyViewed";
import { OrdersPanel } from "@/components/b2b/OrdersPanel";
import { InvoicesPanel } from "@/components/b2b/InvoicesPanel";
import { ApprovalsPanel } from "@/components/b2b/ApprovalsPanel";
import { RmaPanel } from "@/components/b2b/RmaPanel";
import { PortalHeader } from "@/components/b2b/PortalHeader";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import { PortalSidebar } from "@/components/b2b/PortalSidebar";
import { AccountCenter } from "@/components/b2b/AccountCenter";
import { SupportCenter } from "@/components/b2b/SupportCenter";
import { ProjectsPanel } from "@/components/b2b/ProjectsPanel";
import { ProductDetailModal } from "@/components/b2b/ProductDetailModal";
import { CatalogSection } from "@/components/b2b/CatalogSection";
import { ClientDashboard } from "@/components/b2b/ClientDashboard";
import type { AssignedSeller } from "@/components/b2b/ClientDashboard";
import type { ViewMode, CatalogContext } from "@/components/b2b/CatalogSection";
import { OperativeBar } from "@/components/b2b/OperativeBar";
import { useClientProjects } from "@/hooks/useClientProjects";
import { useBusinessAlerts } from "@/hooks/useBusinessAlerts";
import { useCartSync } from "@/hooks/useCartSync";
import { useImpersonate } from "@/context/ImpersonateContext";
import { BulkImport } from "@/components/b2b/BulkImport";
import { DetailedAccountView } from "@/components/b2b/DetailedAccountView";
import { usePortalCatalog } from "@/hooks/usePortalCatalog";
import { usePortalCart } from "@/hooks/usePortalCart";
import { useProducts } from "@/hooks/useProducts";
import { useAppTheme } from "@/hooks/useAppTheme";
import { usePurchaseLists, type PurchaseList } from "@/hooks/usePurchaseLists";
import { getAvailableStock } from "@/lib/pricing";
import { ProductConfigurator } from "@/components/b2b/ProductConfigurator";
import { PcBuilderPanel, type PcBuilderQuoteInput } from "@/components/b2b/PcBuilderPanel";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { QuoteList } from "@/components/QuoteList";
import { MapPin } from "lucide-react";
import { OrderStatusBadge as StatusBadge } from "@/components/OrderStatusBadge";
import { EmptyQuotesState } from "@/components/b2b/empty-states/EmptyQuotesState";

// â”€â”€ Theme helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type PortalTab = "home" | "catalog" | "configurator" | "pc_builder" | "orders" | "quotes" | "projects" | "express" | "invoices" | "cuenta" | "approvals" | "support" | "rma" | "bulk";
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
  const [activeTab, setActiveTab] = useState<PortalTab>(() => {
    const t = searchParams.get("tab") as PortalTab;
    if (["home", "catalog", "configurator", "pc_builder", "orders", "quotes", "cuenta", "approvals", "support", "rma", "bulk"].includes(t)) return t;
    if (window.location.pathname === "/catalogo") return "catalog";
    if (searchParams.get("category") || searchParams.get("categoria")) return "catalog";
    return "home";
  });
  const dk = (dark: string, light: string) => (isDark ? dark : light);
  const [viewModeByContext, setViewModeByContext] = useState<ViewModeByContext>(() => loadViewModeByContext());
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadViewModeByContext().default);
  const [themeFlash, setThemeFlash] = useState(false);
  const [themeSwitchReady, setThemeSwitchReady] = useState(true);
  const [compareList, setCompareList] = useState<number[]>([]);
  const [showCompareTable, setShowCompareTable] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<number[]>(getRecentlyViewedIds());
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; address: string; allows_pickup: boolean }[]>([]);
  const [quickSku, setQuickSku] = useState("");
  const [quickError, setQuickError] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [ordersMenuOpen, setOrdersMenuOpen] = useState(false);
  const ordersMenuRef = useRef<HTMLDivElement | null>(null);

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
    search,
  });

  const pcBuilderPortalCatalog = useProducts({
    category: "all",
    brand: "all",
    search: "",
    pageSize: 1000,
    isAdmin: false,
  });
  const pcBuilderAdminCatalog = useProducts({
    category: "all",
    brand: "all",
    search: "",
    pageSize: 1000,
    isAdmin: true,
  });

  const pcBuilderProducts = useMemo(() => {
    const mergedByKey = new Map<string, Product>();
    const sourceProducts = [...pcBuilderPortalCatalog.products, ...pcBuilderAdminCatalog.products];

    sourceProducts.forEach((product) => {
      const skuKey = product.sku?.trim().toLowerCase();
      const key = skuKey && skuKey.length > 0 ? `sku:${skuKey}` : `id:${product.id}`;
      const existing = mergedByKey.get(key);
      if (!existing) {
        mergedByKey.set(key, product);
        return;
      }

      const existingSpecs = existing.specs && typeof existing.specs === "object" ? Object.keys(existing.specs).length : 0;
      const nextSpecs = product.specs && typeof product.specs === "object" ? Object.keys(product.specs).length : 0;
      if (nextSpecs > existingSpecs) {
        mergedByKey.set(key, product);
      }
    });

    const source = mergedByKey.size > 0 ? Array.from(mergedByKey.values()) : catalog.products;
    if (!hiddenProductIds || hiddenProductIds.size === 0) return source;
    return source.filter((product) => !hiddenProductIds.has(product.id));
  }, [pcBuilderAdminCatalog.products, pcBuilderPortalCatalog.products, catalog.products, hiddenProductIds]);

  useEffect(() => {
    if (activeTab !== "pc_builder") return;
    if (!pcBuilderPortalCatalog.loading && pcBuilderPortalCatalog.hasMore) {
      pcBuilderPortalCatalog.loadMore();
    }
    if (!pcBuilderAdminCatalog.loading && pcBuilderAdminCatalog.hasMore) {
      pcBuilderAdminCatalog.loadMore();
    }
  }, [
    activeTab,
    pcBuilderAdminCatalog.hasMore,
    pcBuilderAdminCatalog.loadMore,
    pcBuilderAdminCatalog.loading,
    pcBuilderPortalCatalog.hasMore,
    pcBuilderPortalCatalog.loadMore,
    pcBuilderPortalCatalog.loading,
  ]);

  // Override useProducts search from portal header
  // NOTE: usePortalCatalog manages its own search internally via useProducts.
  // We pass search from the header to filter; catalog.products already respects it
  // via its own useProducts call. However search is a separate state in the header.
  // For now we keep search in portal and use displayProducts which already filters.

  // â”€â”€ Cart, orders, quotes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { orders, loading: ordersLoading, addOrder, updateOrder, fetchOrders, fetchManagedOrders } = useOrders();
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
    fetchOrders,
    addQuote,
    updateQuoteStatus,
    navigate,
    setActiveTab: (tab) => setActiveTab(tab as PortalTab),
  });
  const { setCart } = cart;
  const purchaseLists = usePurchaseLists({ userId: profile?.id });
  const formatQuickPrice = useCallback((product: Product) => formatPrice(computePrice(product, 1).unitPrice), [computePrice, formatPrice]);

  const mergePurchaseListIntoCart = useCallback((list: PurchaseList) => {
    setCart((current) => {
      const next = { ...current };

      list.items.forEach((item) => {
        const product = catalog.products.find((entry) => entry.id === item.product_id);
        if (!product) return;

        const available = getAvailableStock(product);
        if (available <= 0) return;

        const nextQuantity = Math.min(
          available,
          (next[item.product_id] ?? 0) + Math.max(1, item.quantity),
        );

        if (nextQuantity > 0) next[item.product_id] = nextQuantity;
      });

      return next;
    });
  }, [catalog.products, setCart]);

  const handleLoadListToCart = useCallback((list: PurchaseList) => {
    mergePurchaseListIntoCart(list);
  }, [mergePurchaseListIntoCart]);

  const handleCreateOrderFromList = useCallback((list: PurchaseList) => {
    mergePurchaseListIntoCart(list);
    navigate("/cart");
  }, [mergePurchaseListIntoCart, navigate]);

  const handleAddProductToList = useCallback(async (listId: number, product: Product) => {
    const updated = await purchaseLists.addItemToList(listId, {
      product_id: product.id,
      quantity: Math.max(1, product.min_order_qty ?? 1),
      name: product.name,
      sku: product.sku ?? null,
      note: null,
    });
    if (!updated) {
      throw new Error("No se pudo agregar el producto a la lista.");
    }
  }, [purchaseLists]);

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
  useEffect(() => { setAccountMenuOpen(false); setOrdersMenuOpen(false); }, [activeTab]);
  useEffect(() => {
    if (!accountMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !accountMenuRef.current || accountMenuRef.current.contains(target)) return;
      setAccountMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!ordersMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !ordersMenuRef.current || ordersMenuRef.current.contains(target)) return;
      setOrdersMenuOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOrdersMenuOpen(false); };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [ordersMenuOpen]);

  // â”€â”€ View mode effects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => { setViewMode(viewModeByContext[catalogContext]); }, [catalogContext, viewModeByContext]);
  useEffect(() => { localStorage.setItem(VIEW_MODE_BY_CONTEXT_KEY, JSON.stringify(viewModeByContext)); }, [viewModeByContext]);

  // â”€â”€ Catalog context from URL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const categoryParam = searchParams.get("categoria") || searchParams.get("category");
    if (isPosCategoryValue(categoryParam)) { setCatalogContext("pos"); return; }
    const ctx = normalizePortalText(searchParams.get("context"));
    if (ctx === "featured" || ctx === "oportunidades") setCatalogContext("featured");
    else if (ctx === "default") setCatalogContext("default");

    // Redirect old tabs to Account Hub
    const tabParam = searchParams.get("tab");
    if (tabParam === "express" || tabParam === "payments") {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "cuenta");
        next.set("section", tabParam);
        return next;
      });
      setActiveTab("cuenta");
    }

    // Sync URL 'categoria' param with catalog state
    if (categoryParam) {
      if (categoryParam !== catalog.categoryFilter) {
        catalog.setCategoryFilter(categoryParam);
      }
    } else if (catalog.categoryFilter !== "all" && !searchParams.get("context")) {
      // If we cleared the URL but hook has state, reset hook
      // catalog.setCategoryFilter("all");
    }
  }, [searchParams, setSearchParams, catalog.categoryFilter]);

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

  const quoteCount = quotes.length;
  const pendingApprovals = managedOrders.filter((order) => order.status === "pending_approval").length;
  const highlightedOrders = orders.filter((order) => !["delivered", "rejected"].includes(order.status)).length;
  const clientName = profile?.company_name ?? profile?.contact_name ?? "Cliente";
  const defaultMargin = profile?.default_margin ?? 20;

  const setPortalTab = useCallback((tab: PortalTab, options?: { section?: string }) => {
    setActiveTab(tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      if (options?.section) next.set("section", options.section);
      else next.delete("section");
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleCreateQuoteFromPcBuilder = useCallback(
    async (input: PcBuilderQuoteInput): Promise<boolean> => {
      if (!profile?.id || input.items.length === 0) return false;

      const rawSubtotal = input.items.reduce((sum, line) => sum + line.pricing.totalPrice, 0);
      const rawIvaTotal = input.items.reduce((sum, line) => sum + line.pricing.ivaAmount, 0);
      const rawTotal = input.items.reduce((sum, line) => sum + line.pricing.totalWithIVA, 0);
      const discountAmount = Math.max(0, Number(input.discount.amount || 0));
      const adjustedTotal = Math.max(0, rawTotal - discountAmount);
      const discountFactor = rawTotal > 0 ? adjustedTotal / rawTotal : 1;
      const now = new Date().toISOString();

      const quote = await addQuote({
        client_id: profile.id,
        client_name: clientName,
        items: input.items.map((line) => {
          const safeQuantity = Math.max(1, line.quantity);
          const totalPrice = Number((line.pricing.totalPrice * discountFactor).toFixed(2));
          const ivaAmount = Number((line.pricing.ivaAmount * discountFactor).toFixed(2));
          const totalWithIVA = Number((line.pricing.totalWithIVA * discountFactor).toFixed(2));

          return {
            product_id: line.product.id,
            name: line.product.name_custom?.trim() || line.product.name_original?.trim() || line.product.name,
            quantity: safeQuantity,
            cost: line.pricing.cost,
            margin: line.pricing.margin,
            unitPrice: Number((totalPrice / safeQuantity).toFixed(2)),
            totalPrice,
            ivaRate: line.pricing.ivaRate,
            ivaAmount,
            totalWithIVA,
          };
        }),
        subtotal: Number((rawSubtotal * discountFactor).toFixed(2)),
        ivaTotal: Number((rawIvaTotal * discountFactor).toFixed(2)),
        total: Number(adjustedTotal.toFixed(2)),
        currency,
        status: "draft",
        notes:
          input.discount.percentage > 0
            ? `Armador PC (${input.discount.label}) - descuento ${input.discount.percentage}%`
            : "Armador PC",
        created_at: now,
        updated_at: now,
      });

      if (!quote) return false;
      setPortalTab("quotes");
      return true;
    },
    [addQuote, clientName, currency, profile?.id, setPortalTab],
  );

  const handleQuickOrder = useCallback(() => {
    const [rawSku, rawQty] = quickSku.trim().split(/\s+/);
    if (!rawSku) {
      setQuickError("Ingresá un SKU o una referencia para cargar rápido.");
      return;
    }

    const quantity = Math.max(1, Number.parseInt(rawQty ?? "1", 10) || 1);
    const normalized = normalizePortalText(rawSku);
    const matchedProduct = catalog.products.find((product) => {
      const sku = normalizePortalText(product.sku);
      const name = normalizePortalText(product.name);
      const brand = normalizePortalText(product.brand_name);
      return sku === normalized || name.includes(normalized) || brand.includes(normalized);
    });

    if (!matchedProduct) {
      setQuickError(`No encontramos ${rawSku} en el catálogo activo.`);
      return;
    }

    cart.handleSmartAddToCart(matchedProduct, quantity);
    setQuickSku("");
    setQuickError("");
    setPortalTab("catalog");
  }, [cart, catalog.products, quickSku, setPortalTab]);

  const handleQuickAddProduct = useCallback((product: Product, qty = 1) => {
    cart.handleSmartAddToCart(product, qty);
    setQuickError("");
  }, [cart]);

  const journeySteps = [
    { id: "catalog" as PortalTab, label: "Buscar", helper: "Encontrá por SKU, marca o categoría" },
    { id: "catalog" as PortalTab, label: "Evaluar", helper: "Compará specs, stock y condición comercial" },
    { id: "quotes" as PortalTab, label: "Cotizar o comprar", helper: "Definí si seguís por pedido o propuesta" },
    { id: "orders" as PortalTab, label: "Seguir", helper: "Controlá pedido, factura y postventa" },
  ];

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        cartTotal={cart.cartTotal}
        onOpenCart={() => navigate("/cart")}
        onLogout={handleLogout}
        exchangeRate={exchangeRate}
        onRefreshRate={() => fetchExchangeRate().catch(() => {})}
        isFetchingRate={isFetchingRate}
        creditLimit={!isAdmin && profile?.credit_limit != null && profile.credit_limit > 0 ? profile.credit_limit : undefined}
        creditAvailable={!isAdmin && profile?.credit_limit != null && profile.credit_limit > 0 ? Math.max(0, profile.credit_limit - creditUsed) : undefined}
        partnerLevel={profile?.partner_level as string | undefined}
      />


      {/* TABS */}
      <div className="relative z-50 border-b border-border/70 bg-card/75 px-4 py-1.5 md:px-6">
        <div className="flex items-center gap-1 overflow-x-auto overflow-y-visible pb-1 lg:overflow-visible [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Primary tabs: Inicio + Catálogo */}
          {[
            { id: "home",    label: "Inicio",   icon: LayoutGrid },
            { id: "catalog", label: "Catálogo", icon: Package },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setPortalTab(id as PortalTab)}
              className={`mx-0.5 my-0.5 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl px-3.5 py-2 text-sm font-medium transition ${
                activeTab === id ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}

          <button
            onClick={() => setPortalTab("configurator")}
            className={`mx-0.5 my-0.5 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl px-3.5 py-2 text-sm font-medium transition ${
              activeTab === "configurator" ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Cpu size={13} /> Configurador
          </button>

          <button
            onClick={() => setPortalTab("pc_builder")}
            className={`mx-0.5 my-0.5 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl px-3.5 py-2 text-sm font-medium transition ${
              activeTab === "pc_builder" ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Cpu size={13} /> Armador PC
          </button>

          {/* Pedidos dropdown (orders + quotes + approvals) */}
          <div ref={ordersMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => { setOrdersMenuOpen((c) => !c); setAccountMenuOpen(false); }}
              aria-expanded={ordersMenuOpen}
              aria-haspopup="menu"
              className={`mx-0.5 my-0.5 flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-sm font-medium transition ${
                ["orders", "quotes", "approvals"].includes(activeTab)
                  ? "bg-accent text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <ClipboardList size={13} />
              Pedidos
              {(highlightedOrders + quoteCount + pendingApprovals) > 0 && (
                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary leading-none">
                  {highlightedOrders + quoteCount + (pendingApprovals ?? 0)}
                </span>
              )}
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"
                className={`ml-0.5 opacity-50 transition-transform ${ordersMenuOpen ? "rotate-180" : ""}`}>
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className={`absolute left-0 top-full z-50 pt-1 ${ordersMenuOpen ? "block" : "hidden"}`}>
              <div className="flex min-w-[200px] flex-col overflow-hidden rounded-xl border border-border/60 bg-card py-1.5 shadow-xl" role="menu">
                {[
                  { id: "orders",   label: `Pedidos${highlightedOrders ? ` (${highlightedOrders})` : ""}`, icon: ClipboardList },
                  { id: "quotes",   label: `Cotizaciones${quoteCount ? ` (${quoteCount})` : ""}`,          icon: FileText },
                  ...(profile?.b2b_role === "manager" || isAdmin ? [{
                    id: "approvals", label: `Aprobaciones${pendingApprovals ? ` (${pendingApprovals})` : ""}`, icon: ShieldCheck,
                  }] : []),
                ].map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => { setPortalTab(id as PortalTab); setOrdersMenuOpen(false); }}
                    role="menuitem"
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition ${activeTab === id ? "bg-accent/60 text-foreground font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Finanzas (invoices — top level) */}
          <button
            onClick={() => setPortalTab("invoices")}
            className={`mx-0.5 my-0.5 flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-2xl px-3.5 py-2 text-sm font-medium transition ${
              activeTab === "invoices" ? "bg-accent text-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <FileText size={13} />
            Finanzas
            {myInvoices.length > 0 && (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary leading-none">{myInvoices.length}</span>
            )}
          </button>

          <div className="mx-2 h-5 w-px bg-border/60 shrink-0 hidden md:block" />

          {/* Cuenta dropdown */}
          <div ref={accountMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => { setAccountMenuOpen((c) => !c); setOrdersMenuOpen(false); }}
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              className={`mx-0.5 my-0.5 flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-sm font-medium transition ${
                ["cuenta", "support", "projects", "rma", "bulk"].includes(activeTab)
                  ? "bg-accent/50 text-foreground ring-1 ring-border/50"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Users size={13} /> Cuenta
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"
                className={`ml-1 opacity-50 transition-transform ${accountMenuOpen ? "rotate-180" : ""}`}>
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className={`absolute right-0 top-full z-50 pt-1 md:left-0 md:right-auto ${accountMenuOpen ? "block" : "hidden"}`}>
              <div className="flex min-w-[220px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-xl border border-border/60 bg-card py-1.5 shadow-xl" role="menu">
                {[
                  { id: "cuenta",   label: "Centro de Cuenta", icon: Users },
                  { id: "projects", label: "Proyectos",        icon: Briefcase },
                  { id: "support",  label: "Soporte",          icon: MessageSquare },
                  { id: "rma",      label: "Devoluciones",     icon: RotateCcw },
                  { id: "bulk",     label: "Carga masiva",     icon: Upload },
                ].map(({ id, label, icon: Icon }) => (
                  <button key={id}
                    onClick={() => { setPortalTab(id as PortalTab); setAccountMenuOpen(false); }}
                    role="menuitem"
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition ${activeTab === id ? "bg-accent/60 text-foreground font-semibold" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                    <Icon size={14} /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
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



      {(activeTab === "catalog" || activeTab === "quotes" || activeTab === "orders") && (
        <OperativeBar
          quickSku={quickSku}
          setQuickSku={(value) => {
            setQuickSku(value);
            if (quickError) setQuickError("");
          }}
          quickError={quickError}
          handleQuickOrder={handleQuickOrder}
          quickProducts={catalog.products}
          cartSnapshot={cart.cart}
          onQuickAddProduct={handleQuickAddProduct}
          formatQuickPrice={formatQuickPrice}
          activeTab={activeTab}
          displayProducts={displayProducts}
          exportCatalogCSV={exportCatalogCSV}
          handleExportCatalogPDF={handleExportCatalogPDF}
        />
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* MAIN CONTENT (FULL WIDTH) */}

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto bg-transparent p-3 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-4 md:pb-4 lg:p-5">

          {/* HOME */}
          {activeTab === "home" && profile && (
            <ClientDashboard
              profile={profile}
              orders={orders}
              invoices={myInvoices}
              products={catalog.products}
              creditLimit={profile.credit_limit ?? 0}
              creditUsed={creditUsed}
              onGoTo={(tab) => setPortalTab(tab as PortalTab)}
              onAddToCart={cart.handleSmartAddToCart}
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
              setSelectedProduct={(p) => {
                if (p) setRecentlyViewedIds(addRecentlyViewed(p.id));
                setSelectedProduct(p);
              }}
              isPosProduct={catalog.isPosProduct}
              favoriteProductIds={cart.favoriteProductIds}
              compareList={compareList}
              addedIds={cart.addedIds}
              recentlyViewedIds={recentlyViewedIds}
              onClearRecentlyViewed={() => {
                clearRecentlyViewed();
                setRecentlyViewedIds([]);
              }}
              purchaseHistory={cart.purchaseHistory}
              latestPurchaseUnitPrice={cart.latestPurchaseUnitPrice}
              page={catalog.page}
              setPage={catalog.setPage}
              categoryTree={catalog.categoryTree}
              categoryFilter={catalog.categoryFilter}
              setCategoryFilter={(cat) => {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete("category"); // Remove old param
                  if (cat === "all") next.delete("categoria");
                  else next.set("categoria", cat);
                  return next;
                });
                catalog.setCategoryFilter(cat);
                setPortalTab("catalog");
              }}
              subCategoryFilters={catalog.subCategoryFilters}
              setSubCategoryFilters={catalog.setSubCategoryFilters}
              activeCategoryChildren={catalog.activeCategoryChildren}
              categoryCounts={catalog.categoryCounts}
              purchaseLists={purchaseLists.lists}
              onCreatePurchaseList={purchaseLists.createList}
              onAddProductToList={handleAddProductToList}
            />
          )}

          {activeTab === "configurator" && (
            <ProductConfigurator
              profileId={profile?.id}
              products={catalog.products}
              computePrice={computePrice}
              formatPrice={formatPrice}
              onAddToCart={cart.handleSmartAddToCart}
            />
          )}

          {activeTab === "pc_builder" && (
            <PcBuilderPanel
              products={pcBuilderProducts}
              computePrice={computePrice}
              formatPrice={formatPrice}
              onAddToCart={cart.handleSmartAddToCart}
              profileId={profile?.id}
              clientName={clientName}
              currency={currency}
              onCreateQuote={handleCreateQuoteFromPcBuilder}
              isAdmin={isAdmin}
              allProducts={catalog.products}
            />
          )}

          {/* ORDERS */}
          {activeTab === "orders" && (
            <OrdersPanel
              orders={orders}
              invoices={myInvoices}
              loading={ordersLoading}
              formatPrice={formatPrice}
              formatUSD={formatUSD}
              formatARS={formatARS}
              currency={currency}
              onRepeatOrder={cart.handleRepeatOrder}
              onGoToCatalog={() => setPortalTab("catalog")}
              onGoToInvoices={() => setPortalTab("cuenta", { section: "documentos" })}
              onUpdateOrderProofs={(id, pr) => updateOrder(id, { payment_proofs: pr })}
            />
          )}

          {/* QUOTES */}
          {activeTab === "quotes" && (
            quotes.length === 0 ? (
              <EmptyQuotesState
                onGoToCatalog={() => setPortalTab("catalog")}
                onGoToCart={() => navigate("/cart")}
              />
            ) : (
            <div className="mx-auto max-w-[1480px] space-y-4">
              <div className="rounded-[24px] border border-border/70 bg-card px-5 py-4 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Cotizaciones</p>
                <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">Propuestas listas para reutilizar o convertir</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Acá concentrás tus borradores, propuestas enviadas y pedidos nacidos desde una cotización.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPortalTab("catalog")}
                      className="rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    >
                      Volver al catálogo
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/cart")}
                      className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
                    >
                      Ir al checkout
                    </button>
                  </div>
                </div>
              </div>

              <QuoteList
                quotes={quotes}
                isDark={isDark}
                onLoad={cart.handleLoadQuote}
                onUpdateStatus={updateQuoteStatus}
                onDelete={deleteQuote}
                onGoToCatalog={() => setPortalTab("catalog")}
                onDuplicate={(id) => cart.handleDuplicateQuote(id, quotes)}
                onConvertToOrder={cart.handleConvertQuoteToOrder}
              />
            </div>
            )
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
              purchaseLists={purchaseLists.lists}
              purchaseListsLoading={purchaseLists.loading}
              onNavigateToTab={(tab) => tab === "invoices" ? setPortalTab("cuenta", { section: "documentos" }) : setPortalTab(tab as PortalTab)}
              onLoadSavedCart={cart.handleLoadSavedCart}
              onDeleteSavedCart={cart.handleDeleteSavedCart}
              onCreatePurchaseList={purchaseLists.createList}
              onUpdatePurchaseList={purchaseLists.updateList}
              onDeletePurchaseList={purchaseLists.deleteList}
              onLoadListToCart={handleLoadListToCart}
              onCreateOrderFromList={handleCreateOrderFromList}
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
              onGoToOrders={() => setPortalTab("orders")}
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
                setPortalTab("catalog");
              }}
            />
          )}

          {/* PICKUP POINTS MODAL */}
          <Dialog open={!!confirmingOrderId} onOpenChange={(open) => { if (!open) setConfirmingOrderId(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <MapPin className="text-primary" /> Seleccionar Punto de Retiro
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-3 py-4">
                {warehouses.filter((w) => w.allows_pickup).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay puntos de retiro disponibles. Contactá a tu vendedor para coordinar.
                  </p>
                ) : (
                  warehouses.filter((w) => w.allows_pickup).map((w) => (
                    <button
                      key={w.id}
                      onClick={() => {
                        setConfirmingOrderId(null);
                        alert(`Punto de retiro seleccionado: ${w.name}`);
                      }}
                      className="p-3 rounded-xl border border-border/70 bg-secondary/30 hover:bg-secondary text-left transition"
                    >
                      <p className="text-xs font-bold text-foreground">{w.name}</p>
                      <p className="text-[10px] text-muted-foreground">{w.address}</p>
                    </button>
                  ))
                )}
              </div>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setConfirmingOrderId(null)}
                  className="rounded-lg border border-border/70 bg-card px-4 py-2 text-sm text-muted-foreground transition hover:bg-muted"
                >
                  Cerrar
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </main>
      </div>

      {/* COMPARE FLOAT & TABLE */}
      {compareList.length > 0 && !showCompareTable && (
        <ComparisonBar
          compareList={compareList}
          products={catalog.products}
          onCompare={() => setShowCompareTable(true)}
          onRemove={(id) => setCompareList((prev) => prev.filter((x) => x !== id))}
          onClear={() => setCompareList([])}
        />
      )}
      
      {compareList.length > 0 && showCompareTable && (
        <ProductCompare
          products={catalog.products.filter((p) => compareList.includes(p.id))}
          onRemove={(id) => {
            setCompareList((prev) => {
              const updated = prev.filter((x) => x !== id);
              if (updated.length === 0) setShowCompareTable(false);
              return updated;
            });
          }}
          onClear={() => {
            setCompareList([]);
            setShowCompareTable(false);
          }}
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
          onSelectProduct={(p) => {
            if (p) setRecentlyViewedIds(addRecentlyViewed(p.id));
            setSelectedProduct(p);
          }}
          allProducts={catalog.products}
          profileId={profile?.id}
          purchaseHistoryCount={cart.purchaseHistory[selectedProduct.id] ?? 0}
        />
      )}
      </div>

      {/* MOBILE BOTTOM NAV — visible only on small screens */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-border/70 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {[
          { id: "home",     label: "Inicio",    icon: LayoutGrid,   badge: 0 },
          { id: "catalog",  label: "Catálogo",  icon: Package,      badge: 0 },
          { id: "orders",   label: "Pedidos",   icon: ClipboardList, badge: highlightedOrders + quoteCount + (pendingApprovals ?? 0) },
          { id: "invoices", label: "Finanzas",  icon: FileText,     badge: myInvoices.length },
          { id: "cuenta",   label: "Cuenta",    icon: Users,        badge: 0 },
        ].map(({ id, label, icon: Icon, badge }) => {
          const isActive =
            id === "orders"
              ? ["orders", "quotes", "approvals"].includes(activeTab)
              : id === "cuenta"
              ? ["cuenta", "projects", "support", "rma", "bulk"].includes(activeTab)
              : activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setPortalTab(id as PortalTab)}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <Icon size={19} strokeWidth={isActive ? 2.2 : 1.7} />
                {badge > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-bold text-primary-foreground">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </div>
              <span className={isActive ? "font-semibold" : ""}>{label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setPortalTab("configurator")}
          className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition ${
            activeTab === "configurator" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Cpu size={19} strokeWidth={activeTab === "configurator" ? 2.2 : 1.7} />
          <span className={activeTab === "configurator" ? "font-semibold" : ""}>Config.</span>
        </button>
        <button
          type="button"
          onClick={() => setPortalTab("pc_builder")}
          className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition ${
            activeTab === "pc_builder" ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Cpu size={19} strokeWidth={activeTab === "pc_builder" ? 2.2 : 1.7} />
          <span className={activeTab === "pc_builder" ? "font-semibold" : ""}>Armador</span>
        </button>
      </nav>

      {!isAdmin && <WhatsAppFloat />}
    </div>
  );
}
