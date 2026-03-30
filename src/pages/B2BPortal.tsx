import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { useBrands } from "@/hooks/useBrands";
import { supabase } from "@/lib/supabase";
import { useOrders, type PortalOrder } from "@/hooks/useOrders";
import { useQuotes } from "@/hooks/useQuotes";
import { Quote } from "@/models/quote";
import { QuoteList } from "@/components/QuoteList";
import { useCurrency } from "@/context/CurrencyContext";
import { OrderStatusBadge as StatusBadge } from "@/components/OrderStatusBadge";
import { toggleSetValue } from "@/lib/toggleSet";
import {
  LogOut, ShoppingCart, Search, LayoutGrid, List, Package,
  ClipboardList, CheckCircle2, XCircle, Clock, X, Plus, Minus,
  ShieldCheck, Check, AlertTriangle, AlertCircle, SlidersHorizontal,
  Star, Sun, Moon, ChevronDown, ChevronRight, FileText,
  Table2, Zap, Truck, ChevronUp, Download, Upload, Users, type LucideIcon,
} from "lucide-react";
import { getUnitPrice, getAvailableStock } from "@/lib/pricing";
import { exportCatalogCSV } from "@/lib/exportCsv";
import { exportCatalogPdf } from "@/lib/exportPdf";
import { getSavedCarts, saveCart, deleteSavedCart, type SavedCart } from "@/lib/savedCarts";
import { useNotifications } from "@/hooks/useNotifications";
import ProductCompare from "@/components/ProductCompare";
import { Link } from "react-router-dom";
import {
  addOrderProof,
  getOrderProofs,
  uploadPaymentProof,
  type PaymentProofType,
} from "@/lib/orderEnhancements";
import { fetchMyInvoices, type Invoice, type InvoiceStatus } from "@/lib/api/invoices";
import { puedeComprar } from "@/lib/api/clientDetail";
import type { Product } from "@/models/products";
import { getFavoriteProducts, toggleFavoriteProduct } from "@/lib/favoriteProducts";
import { OrdersPanel } from "@/components/b2b/OrdersPanel";
import { InvoicesPanel } from "@/components/b2b/InvoicesPanel";
import { AccountCenter } from "@/components/b2b/AccountCenter";

type CartItem = {
  product: Product;
  quantity: number;
  cost: number;
  margin: number;
  unitPrice: number;       // sin IVA
  totalPrice: number;      // sin IVA × qty
  ivaRate: number;         // 10.5 | 21
  ivaAmount: number;       // IVA total del ítem
  totalWithIVA: number;    // con IVA
};

/** Extrae el stock de Lugano desde specs del producto */
function getLugStock(p: { specs?: Record<string, string> }): number {
  return p.specs?.lug_stock ? Number(p.specs.lug_stock) : 0;
}

const HIDDEN_SPEC_PREFIXES = [
  "elit_",
  "air_",
  "supplier_",
  "preferred_supplier_",
  "sync_",
  "internal_",
  "provider_",
];

const HIDDEN_SPEC_TOKENS = [
  "cost",
  "precio_costo",
  "precio_compra",
  "markup",
  "pvp",
  "exchange",
  "cotizacion",
  "external_id",
  "uuid",
  "token",
  "source",
  "last_update",
  "stock_cd",
  "stock_total",
  "stock_deposito",
  "link",
];

function isClientVisibleSpecKey(rawKey: string): boolean {
  const key = rawKey.trim().toLowerCase();
  if (!key) return false;
  if (HIDDEN_SPEC_PREFIXES.some((prefix) => key.startsWith(prefix))) return false;
  if (HIDDEN_SPEC_TOKENS.some((token) => key.includes(token))) return false;
  return true;
}

function formatSpecLabel(rawKey: string): string {
  const withSpaces = rawKey
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function formatSpecValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((item) => String(item ?? "")).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// ── Stock badge with pill background ──────────────────────────────────────
function StockBadge({ stock, lugStock = 0 }: { stock: number; lugStock?: number }) {
  if (stock === 0 && lugStock > 0)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
        <Clock size={9} /> 2-3 días
      </span>
    );
  if (stock === 0)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
        <AlertCircle size={9} /> Sin stock
      </span>
    );
  if (stock <= 3)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
        <AlertTriangle size={9} /> Últimas {stock}u
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/15 shrink-0">
      <Check size={9} /> En stock
    </span>
  );
}

// ── Order status badge ─────────────────────────────────────────────────────
function LegacyStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: LucideIcon }> = {
    pending:    { label: "En revisión",  className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",   icon: Clock },
    approved:   { label: "Aprobado",     className: "bg-green-500/15 text-green-400 border-green-500/30",     icon: CheckCircle2 },
    preparing:  { label: "Preparando",   className: "bg-orange-500/15 text-orange-400 border-orange-500/30",  icon: Package },
    shipped:    { label: "Enviado",      className: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",  icon: Truck },
    delivered:  { label: "Entregado",    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
    rejected:   { label: "Rechazado",   className: "bg-red-500/15 text-red-400 border-red-500/30",            icon: XCircle },
    dispatched: { label: "Despachado",  className: "bg-blue-500/15 text-blue-400 border-blue-500/30",        icon: Truck },
  };
  const { label, className, icon: Icon } = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${className}`}>
      <Icon size={11} /> {label}
    </span>
  );
}

// ── Skeleton row ───────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 bg-[#111] border border-[#1a1a1a] rounded-xl px-4 py-3 animate-pulse">
      <div className="h-14 w-14 rounded-xl bg-[#1c1c1c] shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-[#1c1c1c] rounded w-2/3" />
        <div className="h-2.5 bg-[#171717] rounded w-1/3" />
      </div>
      <div className="h-5 w-16 bg-[#171717] rounded-full" />
      <div className="h-6 w-20 bg-[#1c1c1c] rounded" />
      <div className="h-8 w-20 bg-[#1c1c1c] rounded-lg" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4 animate-pulse">
      <div className="h-32 w-full bg-[#1c1c1c] rounded-lg mb-3" />
      <div className="h-3.5 bg-[#1c1c1c] rounded w-3/4 mb-2" />
      <div className="h-2.5 bg-[#171717] rounded w-1/2 mb-3" />
      <div className="h-6 bg-[#1c1c1c] rounded w-1/3 mb-3" />
      <div className="h-8 bg-[#1c1c1c] rounded-lg" />
    </div>
  );
}

type ViewMode = "grid" | "list" | "table";
type CatalogContext = "default" | "oportunidades" | "pos";
type ViewModeByContext = Record<CatalogContext, ViewMode>;
type ThemeMode = "dark" | "light";

const VIEW_MODE_BY_CONTEXT_KEY = "b2b_view_mode_by_context";
const THEME_KEY = "theme";
const DEFAULT_VIEW_MODE_BY_CONTEXT: ViewModeByContext = {
  default: "list",
  oportunidades: "grid",
  pos: "grid",
};

function loadViewModeByContext(): ViewModeByContext {
  try {
    const raw = localStorage.getItem(VIEW_MODE_BY_CONTEXT_KEY);
    if (!raw) return DEFAULT_VIEW_MODE_BY_CONTEXT;
    const parsed = JSON.parse(raw) as Partial<ViewModeByContext>;
    const valid = (v: unknown): v is ViewMode => v === "grid" || v === "list" || v === "table";
    return {
      default: valid(parsed.default) ? parsed.default : DEFAULT_VIEW_MODE_BY_CONTEXT.default,
      oportunidades: valid(parsed.oportunidades) ? parsed.oportunidades : DEFAULT_VIEW_MODE_BY_CONTEXT.oportunidades,
      pos: valid(parsed.pos) ? parsed.pos : DEFAULT_VIEW_MODE_BY_CONTEXT.pos,
    };
  } catch {
    return DEFAULT_VIEW_MODE_BY_CONTEXT;
  }
}

function normalizePortalText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasWord(value: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`, "i").test(value);
}

function getProductFeaturedPriority(product: Product): number {
  const raw = product.specs?.featured_priority;
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function getInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // ignore localStorage read errors
  }
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function isPosCategoryValue(value: unknown): boolean {
  const categoryNorm = normalizePortalText(value);
  if (categoryNorm.includes("punto de venta")) return true;
  if (hasWord(categoryNorm, "pos")) return true;
  return false;
}

export default function B2BPortal() {
  type PortalTab = "catalog" | "orders" | "quotes" | "invoices" | "cuenta";

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, user, isAdmin, signOut } = useAuth();
  const { products, loading: productsLoading } = useProducts();
  const { brands } = useBrands();
  const { orders, addOrder, updateOrder } = useOrders();
  const { quotes, addQuote, updateStatus: updateQuoteStatus, deleteQuote } = useQuotes(profile?.id || "guest");
  const { currency, setCurrency, formatPrice, formatUSD, formatARS, exchangeRate } = useCurrency();

  const defaultMargin = profile?.default_margin ?? 20;
  const clientName = profile?.company_name ?? profile?.contact_name ?? "Cliente";
  const cartKey = `b2b_cart_${profile?.id || "guest"}`;

  const [cart, setCart] = useState<Record<number, number>>(() => {
    try { return JSON.parse(localStorage.getItem(cartKey) || "{}"); }
    catch { return {}; }
  });
  const [productMargins, setProductMargins] = useState<Record<number, number>>({});
  const [globalMargin, setGlobalMargin] = useState(defaultMargin);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all"); // "all" or brand uuid
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [catalogContext, setCatalogContext] = useState<CatalogContext>("default");
  const [viewModeByContext, setViewModeByContext] = useState<ViewModeByContext>(() => loadViewModeByContext());
  const [viewMode, setViewMode] = useState<ViewMode>(() => loadViewModeByContext().default);
  const [activeTab, setActiveTab] = useState<PortalTab>("catalog");
  const [myInvoices, setMyInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const loadMyInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try {
      const data = await fetchMyInvoices();
      setMyInvoices(data);
    } catch {
      // non-blocking
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "invoices" || activeTab === "cuenta") loadMyInvoices();
  }, [activeTab, loadMyInvoices]);

  // Quick Order
  const [quickSku, setQuickSku] = useState("");
  const [quickError, setQuickError] = useState("");
  // Expandable order rows
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  // Product compare (up to 3)
  const [compareList, setCompareList] = useState<number[]>([]);
  // Saved carts
  const [savedCarts, setSavedCarts] = useState<SavedCart[]>(() =>
    getSavedCarts(profile?.id || "guest")
  );
  const [favoriteProductIds, setFavoriteProductIds] = useState<number[]>(() =>
    getFavoriteProducts(profile?.id || "guest")
  );
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess]   = useState(false);
  const [creditError,  setCreditError]    = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [orderProofs, setOrderProofs] = useState<Record<string, ReturnType<typeof getOrderProofs>>>({});
  const [proofForm, setProofForm] = useState<Record<string, {
    type: PaymentProofType;
    amount: string;
    date: string;
    file: File | null;
    uploading: boolean;
    error: string;
  }>>({});

  // ─── DB CATEGORIES (hierarchy) ────────────────────────────────────────
  type DbCat = { id: number; name: string; parent_id: number | null; slug?: string | null };
  const [dbCats, setDbCats] = useState<DbCat[]>([]);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.from("categories").select("*").order("name").then(({ data }) => {
      if (data) setDbCats(data as DbCat[]);
    });
  }, []);

  const posCategoryNames = useMemo(() => {
    if (dbCats.length === 0) return new Set<string>();

    const byId = new Map(dbCats.map((cat) => [cat.id, cat]));
    const posRoots = dbCats.filter((cat) => {
      const nameNorm = normalizePortalText(cat.name);
      const slugNorm = normalizePortalText(cat.slug);
      return slugNorm === "pos" || nameNorm.includes("punto de venta") || hasWord(nameNorm, "pos");
    });

    const out = new Set<string>();
    for (const root of posRoots) {
      const stack = [root.id];
      while (stack.length > 0) {
        const currentId = stack.pop()!;
        const current = byId.get(currentId);
        if (!current) continue;
        out.add(normalizePortalText(current.name));
        for (const child of dbCats) {
          if (child.parent_id === currentId) stack.push(child.id);
        }
      }
    }
    return out;
  }, [dbCats]);

  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [themeFlash, setThemeFlash] = useState(false);
  const [themeSwitchReady, setThemeSwitchReady] = useState(false);
  const showLegacyPortalSections = window.location.hash === "#legacy-portal";
  const isDark = theme === "dark";
  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    setThemeFlash(true);
  };
  // dk(darkClass, lightClass) — inline theme token helper
  const dk = (d: string, l: string) => isDark ? d : l;

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (!themeFlash) return;
    const timer = window.setTimeout(() => setThemeFlash(false), 260);
    return () => window.clearTimeout(timer);
  }, [themeFlash]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setThemeSwitchReady(true));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    setViewMode(viewModeByContext[catalogContext]);
  }, [catalogContext, viewModeByContext]);

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_BY_CONTEXT_KEY, JSON.stringify(viewModeByContext));
  }, [viewModeByContext]);

  useEffect(() => {
    const categoryParam = searchParams.get("category");
    if (isPosCategoryValue(categoryParam)) {
      setCatalogContext("pos");
      return;
    }
    const contextParam = normalizePortalText(searchParams.get("context"));
    if (contextParam === "oportunidades") {
      setCatalogContext("oportunidades");
    } else if (contextParam === "default") {
      setCatalogContext("default");
    }
  }, [searchParams]);

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode);
    setViewModeByContext((prev) => ({ ...prev, [catalogContext]: mode }));
  }

  useEffect(() => {
    localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, cartKey]);

  useEffect(() => {
    if (profile?.default_margin) setGlobalMargin(profile.default_margin);
  }, [profile?.default_margin]);

  useEffect(() => {
    const userId = profile?.id || "guest";
    setSavedCarts(getSavedCarts(userId));
    setFavoriteProductIds(getFavoriteProducts(userId));
  }, [profile?.id]);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  // ── Build category tree from DB ─────────────────────────────────────────
  // parentTree: [{parent, children: string[]}] for parents with products
  // leafOnly: category names that have no parent in DB (standalone)
  const categoryTree = useMemo(() => {
    const byId = new Map(dbCats.map((cat) => [cat.id, cat]));
    const byName = new Map(dbCats.map((cat) => [cat.name, cat]));
    const rootNodes = dbCats
      .filter((cat) => cat.parent_id === null)
      .sort((a, b) => a.name.localeCompare(b.name, "es"));

    const childrenByRoot = new Map<string, Set<string>>();
    const hasOwnProductsAtRoot = new Set<string>();
    rootNodes.forEach((root) => childrenByRoot.set(root.name, new Set()));

    const standalone = new Set<string>();
    const resolveRootName = (cat: DbCat): string | null => {
      let current: DbCat | undefined = cat;
      let guard = 0;
      while (current && current.parent_id !== null && guard < 20) {
        current = byId.get(current.parent_id);
        guard += 1;
      }
      return current?.name ?? null;
    };

    products.forEach((product) => {
      const categoryName = product.category?.trim();
      if (!categoryName) return;

      const dbMatch = byName.get(categoryName);
      if (!dbMatch) {
        standalone.add(categoryName);
        return;
      }

      const rootName = resolveRootName(dbMatch);
      if (!rootName) {
        standalone.add(categoryName);
        return;
      }

      if (dbMatch.name === rootName) {
        hasOwnProductsAtRoot.add(rootName);
      } else {
        childrenByRoot.get(rootName)?.add(dbMatch.name);
      }
    });

    const parents = rootNodes
      .map((root) => {
        const children = Array.from(childrenByRoot.get(root.name) ?? []).sort((a, b) => a.localeCompare(b, "es"));
        if (!hasOwnProductsAtRoot.has(root.name) && children.length === 0) return null;
        return { name: root.name, children };
      })
      .filter((item): item is { name: string; children: string[] } => item !== null);

    const leaves = Array.from(standalone).sort((a, b) => a.localeCompare(b, "es"));
    return { parents, leaves };
  }, [dbCats, products]);

  // ── Count per category ───────────────────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products.length };
    products.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
    // Parent count = hijos + productos directos en la categoria padre
    categoryTree.parents.forEach(({ name, children }) => {
      const childrenTotal = children.reduce((sum, child) => sum + (counts[child] || 0), 0);
      counts[name] = (counts[name] || 0) + childrenTotal;
    });
    return counts;
  }, [products, categoryTree]);

  // ── Children lookup for filtering ───────────────────────────────────────
  const parentChildrenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    categoryTree.parents.forEach(({ name, children }) => {
      map[name] = [name, ...children];
    });
    return map;
  }, [categoryTree]);

  // ── Brand counts (from full product list, not filtered) ──────────────────
  const brandCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach((p) => {
      const bid = p.brand_id;
      if (bid) counts[bid] = (counts[bid] ?? 0) + 1;
    });
    return counts;
  }, [products]);

  // Brands that actually have products in catalog
  const activeBrandsWithProducts = useMemo(
    () => brands.filter((b) => (brandCounts[b.id] ?? 0) > 0),
    [brands, brandCounts]
  );

  const hasActiveFilters = categoryFilter !== "all" || brandFilter !== "all" || minPrice !== "" || maxPrice !== "";

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase();
    return products.filter((p) => {
      const min = Number(minPrice);
      const max = Number(maxPrice);
      if (term && !p.name.toLowerCase().includes(term) && !p.sku?.toLowerCase().includes(term)) return false;
      if (categoryFilter !== "all") {
        const children = parentChildrenMap[categoryFilter];
        if (children?.length) {
          if (!children.includes(p.category)) return false;
        } else {
          if (p.category !== categoryFilter) return false;
        }
      }
      if (brandFilter !== "all" && p.brand_id !== brandFilter) return false;
      if (!isNaN(min) && min > 0 && p.cost_price < min) return false;
      if (!isNaN(max) && max > 0 && p.cost_price > max) return false;
      return true;
    });
  }, [products, search, categoryFilter, brandFilter, minPrice, maxPrice, parentChildrenMap]);

  const favoriteProducts = useMemo(
    () => products.filter((product) => favoriteProductIds.includes(product.id)),
    [favoriteProductIds, products]
  );

  const cartItems: CartItem[] = useMemo(() => {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const product = products.find((p) => p.id === Number(id));
        if (!product) return null;
        const margin = productMargins[Number(id)] ?? globalMargin;
        // Precio base según volumen (price tiers)
        const cost = getUnitPrice(product, qty);
        const unitPrice = cost * (1 + margin / 100);
        const totalPrice = unitPrice * qty;
        const ivaRate = product.iva_rate ?? 21;
        const ivaAmount = totalPrice * (ivaRate / 100);
        return { product, quantity: qty, cost, margin, unitPrice, totalPrice, ivaRate, ivaAmount, totalWithIVA: totalPrice + ivaAmount };
      })
      .filter((i): i is CartItem => i !== null);
  }, [cart, products, productMargins, globalMargin]);

  const cartSubtotal = useMemo(() => cartItems.reduce((s, i) => s + i.totalPrice, 0), [cartItems]);
  const cartIVATotal = useMemo(() => cartItems.reduce((s, i) => s + i.ivaAmount, 0), [cartItems]);
  const cartTotal = useMemo(() => cartSubtotal + cartIVATotal, [cartSubtotal, cartIVATotal]);
  const cartCount = useMemo(() => Object.values(cart).reduce((s, q) => s + q, 0), [cart]);

  // Credit used = total of all pending/approved/preparing orders
  const creditUsed = useMemo(() =>
    orders
      .filter((o) => ["pending", "approved", "preparing"].includes(o.status))
      .reduce((s, o) => s + o.total, 0),
  [orders]);

  // Purchase history: product_id → total units bought
  const purchaseHistory = useMemo(() => {
    const map: Record<number, number> = {};
    for (const order of orders) {
      for (const p of order.products) {
        map[p.product_id] = (map[p.product_id] ?? 0) + p.quantity;
      }
    }
    return map;
  }, [orders]);

  const latestPurchaseUnitPrice = useMemo(() => {
    const map: Record<number, number> = {};
    const sorted = [...orders].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    for (const order of sorted) {
      for (const p of order.products) {
        if (map[p.product_id] == null && p.unit_price != null) {
          map[p.product_id] = p.unit_price;
        }
      }
    }
    return map;
  }, [orders]);

  const isPosProduct = useCallback((product: Product) => {
    const categoryNorm = normalizePortalText(product.category);
    if (!categoryNorm) return false;
    if (posCategoryNames.size > 0) return posCategoryNames.has(categoryNorm);
    return isPosCategoryValue(product.category);
  }, [posCategoryNames]);

  const displayProducts = useMemo(() => {
    const urgencyScore = (product: Product) => {
      const available = getAvailableStock(product);
      const lowStockLimit = Math.max(product.stock_min ?? 0, 3);
      if (available <= 0) return 3;
      if (available <= lowStockLimit) return 2;
      return 0;
    };

    const contextBase = catalogContext === "pos"
      ? filteredProducts.filter((product) => isPosProduct(product))
      : [...filteredProducts];

    if (catalogContext === "oportunidades") {
      // Load active, non-expired opportunities from admin localStorage
      const now = new Date();
      let opportunityIds: Set<number> | null = null;
      try {
        const raw = localStorage.getItem("admin_opportunities_v1");
        if (raw) {
          const items = JSON.parse(raw) as Array<{ product_id: number; active?: boolean; expires_at?: string }>;
          if (Array.isArray(items) && items.length > 0) {
            opportunityIds = new Set(
              items
                .filter((item) =>
                  item.active !== false &&
                  (!item.expires_at || new Date(item.expires_at) > now)
                )
                .map((item) => Number(item.product_id))
            );
          }
        }
      } catch { /* ignore */ }

      // Filter: only products explicitly in opportunities list, or featured products as fallback
      const opBase = opportunityIds && opportunityIds.size > 0
        ? contextBase.filter((p) => opportunityIds!.has(p.id))
        : contextBase.filter((p) => p.featured || getProductFeaturedPriority(p) > 0);

      return opBase.sort((a, b) => {
        const featuredPriorityDiff = getProductFeaturedPriority(b) - getProductFeaturedPriority(a);
        if (featuredPriorityDiff !== 0) return featuredPriorityDiff;

        const featuredDiff = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
        if (featuredDiff !== 0) return featuredDiff;

        const marginDiff = (productMargins[b.id] ?? globalMargin) - (productMargins[a.id] ?? globalMargin);
        if (marginDiff !== 0) return marginDiff;

        const urgencyDiff = urgencyScore(b) - urgencyScore(a);
        if (urgencyDiff !== 0) return urgencyDiff;

        return a.name.localeCompare(b.name, "es");
      });
    }

    if (catalogContext === "pos") {
      const relevanceScore = (product: Product) => {
        const bag = normalizePortalText([
          product.category,
          product.name,
          product.description,
          product.sku,
          (product.tags ?? []).join(" "),
        ].join(" "));

        const categoryNorm = normalizePortalText(product.category);
        let score = 0;
        if (categoryNorm.includes("punto de venta")) score += 8;
        if (hasWord(categoryNorm, "pos")) score += 6;

        const weightedKeywords: Array<[string, number]> = [
          ["terminal", 5],
          ["monitor tactil", 5],
          ["touch", 4],
          ["barcode", 4],
          ["scanner", 4],
          ["lector", 4],
          ["impresora termica", 5],
          ["thermal", 4],
          ["ticket", 3],
          ["cajon", 3],
          ["pos", 3],
        ];

        for (const [keyword, weight] of weightedKeywords) {
          if (bag.includes(keyword)) score += weight;
        }
        return score;
      };

      const comboScore = (product: Product) => {
        const bag = normalizePortalText([product.name, product.description, (product.tags ?? []).join(" ")].join(" "));
        return /(kit|combo|bundle|pack)/.test(bag) ? 1 : 0;
      };

      return contextBase.sort((a, b) => {
        const comboDiff = comboScore(b) - comboScore(a);
        if (comboDiff !== 0) return comboDiff;

        const relevanceDiff = relevanceScore(b) - relevanceScore(a);
        if (relevanceDiff !== 0) return relevanceDiff;

        const salesDiff = (purchaseHistory[b.id] ?? 0) - (purchaseHistory[a.id] ?? 0);
        if (salesDiff !== 0) return salesDiff;

        const featuredPriorityDiff = getProductFeaturedPriority(b) - getProductFeaturedPriority(a);
        if (featuredPriorityDiff !== 0) return featuredPriorityDiff;

        return a.name.localeCompare(b.name, "es");
      });
    }

    return contextBase;
  }, [catalogContext, filteredProducts, globalMargin, isPosProduct, productMargins, purchaseHistory]);

  // In-app notifications (order status, price, stock changes)
  useNotifications(profile?.id, orders, products);

  // ── Saved carts helpers ────────────────────────────────────────────────
  function handleSaveNamedCart(name: string) {
    const uid = profile?.id || "guest";
    const rawItems: Record<number, number> = {};
    const rawMargins: Record<number, number> = {};
    cartItems.forEach((i) => {
      rawItems[i.product.id] = i.quantity;
      rawMargins[i.product.id] = i.margin;
    });
    const saved = saveCart(uid, name, rawItems, rawMargins);
    setSavedCarts(getSavedCarts(uid));
    return saved;
  }

  function handleLoadSavedCart(sc: SavedCart) {
    setCart(sc.items);
    setProductMargins(sc.margins);
    navigate("/cart");
  }

  function handleDeleteSavedCart(cartId: string) {
    const uid = profile?.id || "guest";
    deleteSavedCart(uid, cartId);
    setSavedCarts(getSavedCarts(uid));
  }

  function handleToggleFavorite(productId: number) {
    const userId = profile?.id || "guest";
    setFavoriteProductIds(toggleFavoriteProduct(userId, productId));
  }

  // ── Compare helpers ────────────────────────────────────────────────────
  function toggleCompare(productId: number) {
    setCompareList((prev) => {
      if (prev.includes(productId)) return prev.filter((id) => id !== productId);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, productId];
    });
  }

  // Add to cart — verifica stock disponible y mínimo de compra
  function handleAddToCart(product: Product) {
    const available = getAvailableStock(product);
    const inCart = cart[product.id] || 0;
    if (inCart >= available) return; // sin stock suficiente
    const minQty = product.min_order_qty ?? 1;
    // First add jumps to min_order_qty if below it
    const newQty = inCart === 0 && minQty > 1 ? minQty : inCart + 1;
    const safeQty = Math.min(newQty, available);
    setCart((prev) => ({ ...prev, [product.id]: safeQty }));
    setAddedIds((prev) => new Set(prev).add(product.id));
    setTimeout(() => {
      setAddedIds((prev) => { const s = new Set(prev); s.delete(product.id); return s; });
    }, 900);
  }

  // Quick Order por SKU
  function handleQuickOrder() {
    const parts = quickSku.trim().split(/\s+/);
    const sku = parts[0];
    const qty = parts[1] ? parseInt(parts[1], 10) : 1;
    if (!sku) return;
    const product = products.find((p) => p.sku?.toLowerCase() === sku.toLowerCase());
    if (!product) {
      setQuickError(`SKU "${sku}" no encontrado`);
      setTimeout(() => setQuickError(""), 2500);
      return;
    }
    const available = getAvailableStock(product);
    const inCart = cart[product.id] || 0;
    const toAdd = Math.min(qty, available - inCart);
    if (toAdd <= 0) {
      setQuickError(`Sin stock disponible para ${sku}`);
      setTimeout(() => setQuickError(""), 2500);
      return;
    }
    setCart((prev) => ({ ...prev, [product.id]: (prev[product.id] || 0) + toAdd }));
    setQuickSku("");
    setQuickError("");
  }

  const onRemoveFromCart = (product: Product) =>
    setCart((prev) => {
      const qty = prev[product.id] || 0;
      if (qty <= 1) { const { [product.id]: _, ...rest } = prev; return rest; }
      return { ...prev, [product.id]: qty - 1 };
    });

  const onMarginChange = (productId: number, margin: number) =>
    setProductMargins((prev) => ({ ...prev, [productId]: margin }));

  const handleConfirmOrder = async () => {
    if (!cartItems.length) return;
    setCreditError("");

    // ── Validar crédito y estado de cuenta ────────────────────────────────
    if (profile?.id) {
      try {
        const check = await puedeComprar(profile.id);
        if (!check.puede) {
          const msgs: Record<string, string> = {
            cuenta_bloqueada: "Tu cuenta está bloqueada. Contactá a tu ejecutivo de cuenta.",
            cuenta_inactiva:  "Tu cuenta está inactiva. Contactá a tu ejecutivo de cuenta.",
            credito_agotado:  "No tenés crédito disponible para realizar este pedido. Revisá tu cuenta corriente.",
          };
          setCreditError(msgs[check.razon ?? ""] ?? "No podés realizar pedidos en este momento.");
          return;
        }
      } catch { /* si el RPC falla, no bloqueamos el pedido */ }
    }

    // Validar stock y mínimo antes de confirmar
    for (const item of cartItems) {
      if (item.quantity > getAvailableStock(item.product)) {
        alert(`Stock insuficiente para "${item.product.name}". Ajustá la cantidad.`);
        return;
      }
      const minQty = item.product.min_order_qty ?? 1;
      if (item.quantity < minQty) {
        alert(`"${item.product.name}" requiere un mínimo de ${minQty} unidades.`);
        return;
      }
    }
    setOrderSubmitting(true);
    const orderProducts = cartItems.map((item) => ({
      product_id: item.product.id,
      name: item.product.name,
      sku: item.product.sku || "",
      quantity: item.quantity,
      cost_price: item.cost,
      unit_price: Number(item.unitPrice.toFixed(2)),
      total_price: Number(item.totalPrice.toFixed(2)),
      margin: item.margin,
    }));
    const { error } = await addOrder({
      products: orderProducts,
      total: Number(cartTotal.toFixed(2)),
      status: "pending",
      created_at: new Date().toISOString(),
    });
    if (!error) {
      // Actualizar stock_reserved en Supabase (silencioso si falla)
      try {
        await Promise.all(
          cartItems.map((item) =>
            supabase
              .from("products")
              .update({ stock_reserved: (item.product.stock_reserved ?? 0) + item.quantity })
              .eq("id", item.product.id)
          )
        );
      } catch { /* silencioso */ }
    }
    setOrderSubmitting(false);
    if (!error) {
      setOrderSuccess(true);
      setCart({});
      setActiveTab("orders");
      setTimeout(() => setOrderSuccess(false), 5000);
    }
  };

  function handleSaveQuote() {
    if (!cartItems.length) return;
    addQuote({
      client_id: profile?.id || "guest",
      client_name: clientName,
      items: cartItems.map((item) => ({
        product_id: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        cost: item.cost,
        margin: item.margin,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        ivaRate: item.ivaRate,
        ivaAmount: item.ivaAmount,
        totalWithIVA: item.totalWithIVA,
      })),
      subtotal: cartSubtotal,
      ivaTotal: cartIVATotal,
      total: cartTotal,
      currency,
      status: "draft",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setActiveTab("quotes");
  }

  function handleLoadQuote(quote: Quote) {
    const newCart: Record<number, number> = {};
    const newMargins: Record<number, number> = {};
    quote.items.forEach((item) => {
      newCart[item.product_id] = item.quantity;
      newMargins[item.product_id] = item.margin;
    });
    setCart(newCart);
    setProductMargins(newMargins);
    navigate("/cart");
    setActiveTab("catalog");
  }

  function handleRepeatOrder(order: PortalOrder) {
    const newCart: Record<number, number> = {};
    for (const p of order.products) {
      const product = products.find((prod) => prod.id === p.product_id);
      if (!product) continue;
      const available = getAvailableStock(product);
      const qty = Math.min(p.quantity, available);
      if (qty > 0) newCart[p.product_id] = qty;
    }
    setCart(newCart);
    navigate("/cart");
    setActiveTab("catalog");
  }

  async function handleUpdateOrderProofs(orderId: string | number, proofs: unknown[]) {
    await updateOrder(orderId, { payment_proofs: proofs });
  }

  useEffect(() => {
    const map: Record<string, ReturnType<typeof getOrderProofs>> = {};
    orders.forEach((order) => {
      map[String(order.id)] = getOrderProofs(String(order.id));
    });
    setOrderProofs(map);
  }, [orders]);

  async function handleUploadProof(orderId: string) {
    const form = proofForm[orderId];
    if (!form || !form.file || !profile?.id) return;

    setProofForm((prev) => ({
      ...prev,
      [orderId]: { ...form, uploading: true, error: "" },
    }));

    try {
      const { filePath, publicUrl } = await uploadPaymentProof(profile.id, orderId, form.file);
      const proof = {
        orderId,
        type: form.type,
        amount: Number(form.amount) || 0,
        date: form.date || new Date().toISOString().slice(0, 10),
        filePath,
        publicUrl,
        uploadedAt: new Date().toISOString(),
      };
      addOrderProof(orderId, proof);
      const current = getOrderProofs(orderId);
      setOrderProofs((prev) => ({ ...prev, [orderId]: current }));
      await updateOrder(orderId, { payment_proofs: current as unknown[] });

      setProofForm((prev) => ({
        ...prev,
        [orderId]: { ...prev[orderId], file: null, amount: "", uploading: false },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo subir el comprobante";
      setProofForm((prev) => ({
        ...prev,
        [orderId]: { ...prev[orderId], uploading: false, error: message },
      }));
    }
  }

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  function clearFilters() {
    setCategoryFilter("all");
    setBrandFilter("all");
    setMinPrice("");
    setMaxPrice("");
    setSearch("");
  }

  async function handleExportCatalogPDF() {
    await exportCatalogPdf(displayProducts, formatPrice, currency);
  }

  // ─── PRODUCT MODAL ────────────────────────────────────────────────────
  const productModal = selectedProduct && (() => {
    const p = selectedProduct;
    const margin = productMargins[p.id] ?? globalMargin;
    const inCart = cart[p.id] || 0;
    const finalPrice = getUnitPrice(p, Math.max(inCart, 1)) * (1 + margin / 100);  // sin IVA, precio según volumen
    const ivaRate = p.iva_rate ?? 21;
    const ivaAmt = finalPrice * (ivaRate / 100);
    const finalWithIVA = finalPrice + ivaAmt;
    const availableStock = getAvailableStock(p);
    const outOfStock = availableStock === 0;
    const publicSpecs = p.specs
      ? Object.entries(p.specs)
          .filter(([key]) => isClientVisibleSpecKey(key))
          .map(([key, value]) => ({
            key,
            label: formatSpecLabel(key),
            value: formatSpecValue(value),
          }))
          .filter((entry) => entry.value.trim().length > 0)
      : [];

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        onClick={() => setSelectedProduct(null)}
      >
        <div
          className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-2xl w-full max-w-lg shadow-2xl shadow-black/30 flex flex-col max-h-[90vh]`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — fixed */}
          <div className={`flex items-center justify-between px-5 py-3.5 border-b ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")} shrink-0`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs ${dk("text-gray-500 bg-[#242424]", "text-[#737373] bg-[#f0f0f0]")} px-2 py-0.5 rounded-full font-medium`}>{p.category}</span>
              {p.featured && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                  <Star size={9} fill="currentColor" /> Destacado
                </span>
              )}
            </div>
            <button onClick={() => setSelectedProduct(null)}
              className={`${dk("text-gray-600 hover:text-white hover:bg-[#2a2a2a]", "text-[#a3a3a3] hover:text-[#171717] hover:bg-[#f0f0f0]")} transition p-1 rounded-lg shrink-0`}>
              <X size={16} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1">
            {/* Image */}
            <div className={`${dk("bg-[#0a0a0a]", "bg-[#f9f9f9]")} flex items-center justify-center h-52 px-8 shrink-0`}>
              <img src={p.image} alt={p.name} className="max-h-40 max-w-full object-contain drop-shadow-xl" />
            </div>

            {/* Info */}
            <div className="px-5 pt-4 pb-2">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h2 className={`text-base font-extrabold ${dk("text-white", "text-[#171717]")} leading-tight`}>{p.name}</h2>
                <StockBadge stock={p.stock} lugStock={getLugStock(p)} />
              </div>

              <div className="flex items-center gap-3 mb-4">
                {p.sku && <span className={`text-[11px] font-mono ${dk("text-[#525252] bg-[#171717] border-[#222]", "text-[#737373] bg-[#f0f0f0] border-[#e5e5e5]")} border px-2 py-0.5 rounded`}>SKU: {p.sku}</span>}
                {availableStock > 0 && (
                  <span className="text-[11px] text-gray-600">{availableStock} disponibles</span>
                )}
                {p.stock_min > 0 && (
                  <span className="text-[11px] text-gray-700">mín. {p.stock_min}</span>
                )}
              </div>

              {/* Price breakdown */}
              <div className={`${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-[#f9f9f9] border-[#e5e5e5]")} border rounded-xl px-4 py-3 mb-4`}>
                <div className="flex items-start justify-between gap-3">
                  {/* Price rows */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] ${dk("text-[#737373]", "text-[#a3a3a3]")}`}>Precio unitario</span>
                      <span className="text-base font-extrabold text-[#2D9F6A] tabular-nums">{formatPrice(finalPrice)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] ${dk("text-[#737373]", "text-[#a3a3a3]")}`}>IVA ({ivaRate}%)</span>
                      <span className={`text-sm font-semibold tabular-nums ${dk("text-[#a3a3a3]", "text-[#737373]")}`}>+ {formatPrice(ivaAmt)}</span>
                    </div>
                    <div className={`flex items-center justify-between pt-1.5 border-t ${dk("border-[#222]", "border-[#e5e5e5]")}`}>
                      <span className={`text-[11px] font-semibold ${dk("text-white", "text-[#171717]")}`}>Precio final</span>
                      <span className={`text-base font-extrabold tabular-nums ${dk("text-white", "text-[#171717]")}`}>{formatPrice(finalWithIVA)}</span>
                    </div>
                    <div className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")} font-mono`}>
                      {currency === "USD" ? formatARS(finalWithIVA) : formatUSD(finalWithIVA)}
                    </div>
                  </div>
                  {/* Currency toggle */}
                  <div className="text-right shrink-0">
                    <div className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")} mb-1`}>Moneda</div>
                    <div className={`flex items-center ${dk("bg-[#171717] border-[#262626]", "bg-[#f0f0f0] border-[#e5e5e5]")} border rounded-lg p-0.5 gap-0.5`}>
                      {(["USD", "ARS"] as const).map((c) => (
                        <button key={c} onClick={() => setCurrency(c)}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${currency === c ? "bg-[#2D9F6A] text-white" : dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#737373] hover:text-[#171717]")}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Price tiers table */}
              {p.price_tiers && p.price_tiers.length > 0 && (
                <div className="mb-4">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Precio por volumen</p>
                  <div className={`rounded-xl border ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")} overflow-hidden`}>
                    <div className={`grid grid-cols-3 text-[10px] font-bold uppercase tracking-wide ${dk("bg-[#0d0d0d] text-[#525252]", "bg-[#f5f5f5] text-[#a3a3a3]")} px-3 py-1.5`}>
                      <span>Cantidad</span>
                      <span className="text-center">Precio unit.</span>
                      <span className="text-right">Ahorro</span>
                    </div>
                    {p.price_tiers.map((tier, i) => {
                      const saving = ((p.cost_price - tier.price) / p.cost_price * 100);
                      const isActive = inCart >= tier.min && (tier.max === null || inCart <= tier.max);
                      return (
                        <div key={i} className={`grid grid-cols-3 text-xs px-3 py-2 ${
                          isActive
                            ? dk("bg-[#2D9F6A]/10 text-[#2D9F6A]", "bg-[#2D9F6A]/8 text-[#1a7a50]")
                            : i % 2 === 0
                              ? dk("bg-[#0d0d0d] text-gray-400", "bg-[#f9f9f9] text-[#525252]")
                              : dk("bg-[#0a0a0a] text-gray-400", "bg-white text-[#525252]")
                        }`}>
                          <span className="font-medium">
                            {tier.min}{tier.max ? `–${tier.max}` : "+"} u.
                            {isActive && <span className="ml-1 text-[9px] font-bold uppercase">◀ actual</span>}
                          </span>
                          <span className={`text-center font-bold tabular-nums ${isActive ? "" : ""}`}>
                            {formatPrice(tier.price)}
                          </span>
                          <span className="text-right text-[10px]">
                            {saving > 0 ? <span className="text-green-400 font-semibold">-{saving.toFixed(0)}%</span> : "—"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Description */}
              {p.description && (
                <div className="mb-4">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Descripción</p>
                  <p className={`text-sm ${dk("text-gray-400", "text-[#525252]")} leading-relaxed whitespace-pre-line`}>{p.description}</p>
                </div>
              )}

              {/* Specs */}
              {publicSpecs.length > 0 && (
                <div className="mb-4">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Especificaciones</p>
                  <div className={`rounded-xl border ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")} overflow-hidden`}>
                    {publicSpecs.map((spec, i) => (
                      <div key={spec.key} className={`flex text-xs ${i % 2 === 0 ? dk("bg-[#0d0d0d]", "bg-[#f9f9f9]") : dk("bg-[#0a0a0a]", "bg-white")}`}>
                        <span className={`${dk("text-gray-500", "text-[#737373]")} px-3 py-2 w-2/5 shrink-0 font-medium`}>{spec.label}</span>
                        <span className={`${dk("text-gray-300", "text-[#525252]")} px-3 py-2 flex-1`}>{spec.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {p.tags && p.tags.length > 0 && (
                <div className="mb-4">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {p.tags.map((t: string) => (
                      <span key={t} className={`text-[11px] px-2 py-0.5 rounded-full ${dk("bg-[#1c1c1c] text-[#a3a3a3] border-[#262626]", "bg-[#f0f0f0] text-[#525252] border-[#e5e5e5]")} border font-medium`}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer — cart controls, fixed */}
          <div className={`px-5 py-4 border-t ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")} shrink-0`}>
            {outOfStock ? (
              <div className={`w-full ${dk("bg-[#1c1c1c] text-[#525252] border-[#222]", "bg-[#f5f5f5] text-[#737373] border-[#e5e5e5]")} font-medium h-11 rounded-xl text-sm flex items-center justify-center border`}>
                Sin stock disponible
              </div>
            ) : inCart > 0 ? (
              <div className="flex items-center gap-3">
                <button onClick={() => onRemoveFromCart(p)}
                  className={`h-11 w-11 ${dk("bg-[#1c1c1c] hover:bg-[#252525] text-white border-[#262626]", "bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#171717] border-[#e5e5e5]")} rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center border`}>
                  <Minus size={16} />
                </button>
                <span className={`flex-1 text-center ${dk("text-white", "text-[#171717]")} font-extrabold text-xl`}>{inCart}</span>
                <button onClick={() => handleAddToCart(p)}
                  className="h-11 w-11 bg-[#2D9F6A] hover:bg-[#25835A] text-white rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center">
                  <Plus size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => handleAddToCart(p)}
                className="w-full bg-[#2D9F6A] hover:bg-[#25835A] text-white font-bold h-11 rounded-xl text-sm transition-all active:scale-[0.98]"
              >
                Agregar al carrito
              </button>
            )}
          </div>
        </div>
      </div>
    );
  })();

  // ─── RENDER ───────────────────────────────────────────────────────────
  return (
    <div className={`flex min-h-screen ${dk("bg-[#0a0a0a]", "bg-[#f5f5f5]")} flex-col`}>

      {/* TOPBAR */}
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

        {/* Quick Order — SKU + qty */}
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
          {/* Vista + Moneda + Tema — agrupados */}
          <div className={`hidden md:flex items-center ${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-[#f0f0f0] border-[#e5e5e5]")} border rounded-lg p-1 gap-0.5`}>
            <button onClick={() => handleViewModeChange("grid")} title="Grilla"
              className={`p-1.5 rounded transition ${viewMode === "grid" ? dk("bg-[#262626] text-white", "bg-white text-[#171717] shadow-sm") : dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#737373] hover:text-[#171717]")}`}>
              <LayoutGrid size={13} />
            </button>
            <button onClick={() => handleViewModeChange("list")} title="Lista"
              className={`p-1.5 rounded transition ${viewMode === "list" ? dk("bg-[#262626] text-white", "bg-white text-[#171717] shadow-sm") : dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#737373] hover:text-[#171717]")}`}>
              <List size={13} />
            </button>
            <button onClick={() => handleViewModeChange("table")} title="Lista de precios (alta densidad)"
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

          <button
            type="button"
            onClick={toggleTheme}
            role="switch"
            aria-checked={isDark}
            aria-label="Cambiar modo claro u oscuro"
            title={isDark ? "Modo oscuro" : "Modo claro"}
            className={`group relative h-7 w-[84px] shrink-0 overflow-hidden rounded-full border transition-all duration-300 ease-in-out hover:shadow-md active:scale-[0.97] ${
              isDark ? "bg-neutral-800 border-neutral-700" : "bg-neutral-200 border-neutral-300"
            } ${
              themeFlash
                ? isDark
                  ? "shadow-[0_0_0_3px_rgba(45,159,106,0.22),0_6px_18px_rgba(16,185,129,0.2)]"
                  : "shadow-[0_0_0_3px_rgba(59,130,246,0.2),0_6px_18px_rgba(59,130,246,0.18)]"
                : ""
            } ${themeSwitchReady ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-0.5 scale-95"}`}
          >
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2">
              <Moon
                size={12}
                className={`transition-all duration-300 ease-in-out ${
                  isDark ? "text-white scale-100 opacity-100" : "text-neutral-500 scale-90 opacity-45"
                }`}
              />
            </span>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
              <Sun
                size={12}
                className={`transition-all duration-300 ease-in-out ${
                  isDark ? "text-neutral-500 scale-90 opacity-45" : "text-amber-500 scale-100 opacity-100"
                }`}
              />
            </span>
            <span
              className={`pointer-events-none absolute left-[1px] top-[1px] h-6 w-6 rounded-full bg-white shadow-md transition-[transform,box-shadow] duration-300 [transition-timing-function:cubic-bezier(0.22,1.28,0.36,1)] ${
                isDark ? "translate-x-[2px]" : "translate-x-[54px]"
              } ${
                themeFlash ? "scale-[1.06] shadow-lg" : "scale-100"
              } group-hover:shadow-lg`}
            />
            <span
              className={`pointer-events-none absolute inset-0 rounded-full transition-opacity duration-300 ${
                themeFlash
                  ? isDark
                    ? "opacity-100 bg-[radial-gradient(circle_at_25%_50%,rgba(34,197,94,0.18),transparent_55%)]"
                    : "opacity-100 bg-[radial-gradient(circle_at_75%_50%,rgba(59,130,246,0.18),transparent_55%)]"
                  : "opacity-0"
              }`}
            />
          </button>

          {/* Exportar catálogo */}
          {activeTab === "catalog" && (
            <div className={`hidden md:flex items-center ${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-[#f0f0f0] border-[#e5e5e5]")} border rounded-lg p-1 gap-0.5`}>
              <button
                onClick={() => exportCatalogCSV(displayProducts)}
                title="Exportar CSV"
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition ${dk("text-[#525252] hover:text-[#a3a3a3] hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] hover:bg-white")}`}
              >
                <Download size={11} /> CSV
              </button>
              <button
                onClick={() => { void handleExportCatalogPDF(); }}
                title="Exportar PDF"
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition ${dk("text-[#525252] hover:text-[#a3a3a3] hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] hover:bg-white")}`}
              >
                <Download size={11} /> PDF
              </button>
            </div>
          )}

          {/* Carrito */}
          <button
            onClick={() => navigate("/cart")}
            className="relative flex items-center gap-2 bg-[#2D9F6A] hover:bg-[#25835A] active:scale-95 text-white rounded-xl px-3 py-2 text-sm font-semibold transition-all"
          >
            <ShoppingCart size={15} />
            <span className="hidden md:inline">Carrito</span>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-white text-[#2D9F6A] text-[10px] font-black flex items-center justify-center shadow">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </button>

          {/* Admin */}
          {isAdmin && (
            <Link to="/admin"
              className="flex items-center gap-1.5 text-xs text-[#2D9F6A] hover:text-white transition px-2.5 py-2 rounded-lg hover:bg-[#1e1e1e]">
              <ShieldCheck size={14} />
              <span className="hidden md:inline">Admin</span>
            </Link>
          )}

          {/* Logout */}
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-300 transition px-2 py-2 rounded-lg hover:bg-[#1e1e1e]">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* TABS */}
      <div className={`flex border-b ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")} px-4 md:px-6`}>
        {[
          { id: "catalog",  label: "Catálogo", icon: Package },
          { id: "orders",   label: `Mis Pedidos${orders.length ? ` (${orders.length})` : ""}`, icon: ClipboardList },
          { id: "quotes",   label: `Cotizaciones${quotes.length ? ` (${quotes.length})` : ""}`, icon: FileText },
          { id: "invoices", label: `Facturas${myInvoices.length ? ` (${myInvoices.length})` : ""}`, icon: FileText },
          { id: "cuenta",   label: "Mi Cuenta", icon: Users },
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

      {/* BANNER ADMIN */}
      {isAdmin && (
        <div className={`flex items-center justify-between ${dk("bg-[#111] border-[#1a1a1a]", "bg-[#f9f9f9] border-[#e5e5e5]")} border-b px-4 md:px-6 py-2`}>
          <div className="flex items-center gap-2 text-[#737373] text-xs font-medium">
            <ShieldCheck size={13} />
            Vista de administrador
          </div>
          <Link to="/admin"
            className={`flex items-center gap-1.5 ${dk("bg-[#1c1c1c] hover:bg-[#262626] text-[#a3a3a3] hover:text-white border-[#262626] hover:border-[#333]", "bg-white hover:bg-[#f5f5f5] text-[#525252] hover:text-[#171717] border-[#e5e5e5] hover:border-[#d4d4d4]")} text-xs font-medium px-3 py-1.5 rounded-lg border transition`}>
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
            // credit_limit is stored in ARS — do NOT pass through formatPrice (which converts USD→ARS)
            const fmtArsRaw = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
            const creditAvail = Math.max(0, profile.credit_limit! - creditUsed);
            const pct = Math.min(100, (creditUsed / profile.credit_limit!) * 100);
            const danger = pct >= 80;
            return (
              <div className="flex items-center gap-2 ml-auto">
                <span className={`text-[11px] ${dk("text-gray-500", "text-[#737373]")}`}>
                  Crédito: <span className={`font-semibold ${danger ? "text-red-400" : "text-[#2D9F6A]"}`}>{fmtArsRaw(creditAvail)}</span>
                  <span className={`${dk("text-gray-700", "text-[#c4c4c4]")} ml-1`}>/ {fmtArsRaw(profile.credit_limit!)}</span>
                </span>
                <div className={`w-24 h-1.5 rounded-full ${dk("bg-[#1c1c1c]", "bg-[#e5e5e5]")} overflow-hidden`}>
                  <div
                    className={`h-full rounded-full transition-all ${danger ? "bg-red-500" : "bg-[#2D9F6A]"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {creditError && (
        <div className="mx-4 mt-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3 text-sm font-medium flex items-center gap-2">
          <AlertTriangle size={15} />
          {creditError}
        </div>
      )}

      {orderSuccess && (
        <div className={`mx-4 mt-3 ${dk("bg-green-900/20 border-green-500/30 text-green-400", "bg-green-50 border-green-200 text-green-700")} border rounded-xl p-3 text-sm font-medium flex items-center gap-2`}>
          <CheckCircle2 size={15} />
          Pedido confirmado. Lo estamos revisando y te contactaremos pronto.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* SIDEBAR */}
        {activeTab === "catalog" && (
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
              <div className="flex flex-col gap-0.5 max-h-[54vh] overflow-y-auto overflow-x-hidden overscroll-contain pr-1">

                {/* "Todas" */}
                {(() => {
                  const isActive = categoryFilter === "all";
                  return (
                    <button
                      onClick={() => setCategoryFilter("all")}
                      className={`flex items-center justify-between text-left text-sm px-2.5 py-1.5 rounded-lg transition group border-l-2 ${
                        isActive
                          ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]`
                          : `${dk("text-[#737373] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`
                      }`}
                    >
                      <span>Todas</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${
                        isActive ? dk("bg-[#262626] text-white", "bg-[#2D9F6A]/20 text-[#1a7a50]")
                          : dk("bg-[#1a1a1a] text-[#525252] group-hover:bg-[#222]", "bg-[#f0f0f0] text-[#737373] group-hover:bg-[#e8e8e8]")
                      }`}>{categoryCounts["all"]}</span>
                    </button>
                  );
                })()}

                {/* Parent categories with children */}
                {categoryTree.parents.map(({ name: parent, children }) => {
                  const isParentActive  = categoryFilter === parent;
                  const canExpand       = children.length > 0;
                  const isExpanded      = canExpand && expandedParents.has(parent);
                  const parentCount     = categoryCounts[parent] || 0;

                  return (
                    <div key={parent}>
                      {/* Parent row */}
                      <div className="flex items-center gap-0">
                        {/* Expand/collapse chevron */}
                        {canExpand ? (
                          <button
                            onClick={() => setExpandedParents((prev) => toggleSetValue(prev, parent))}
                            className={`p-1 rounded transition shrink-0 ${dk("text-[#525252] hover:text-[#a3a3a3]", "text-[#a3a3a3] hover:text-[#525252]")}`}
                          >
                            {isExpanded
                              ? <ChevronDown size={11} />
                              : <ChevronRight size={11} />}
                          </button>
                        ) : (
                          <span className="w-[18px] shrink-0" />
                        )}
                        {/* Parent label (also clickable as filter) */}
                        <button
                          onClick={() => setCategoryFilter(parent)}
                          className={`flex-1 flex items-center justify-between text-left text-sm px-1.5 py-1.5 rounded-lg transition group border-l-2 ${
                            isParentActive
                              ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]`
                              : `${dk("text-[#737373] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`
                          }`}
                        >
                          <span className="min-w-0 pr-1 leading-tight break-words text-left font-medium" title={parent}>{parent}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${
                            isParentActive ? dk("bg-[#262626] text-white", "bg-[#2D9F6A]/20 text-[#1a7a50]")
                              : dk("bg-[#1a1a1a] text-[#525252] group-hover:bg-[#222]", "bg-[#f0f0f0] text-[#737373] group-hover:bg-[#e8e8e8]")
                          }`}>{parentCount}</span>
                        </button>
                      </div>

                      {/* Subcategories (indented) */}
                      {isExpanded && (
                        <div className="ml-5 flex flex-col gap-0.5 mt-0.5 mb-1">
                          {children.map((child) => {
                            const isActive = categoryFilter === child;
                            const count    = categoryCounts[child] || 0;
                            return (
                              <button
                                key={child}
                                onClick={() => {
                                  setCategoryFilter(child);
                                  setExpandedParents((prev) => {
                                    if (prev.has(parent)) return prev;
                                    const next = new Set(prev);
                                    next.add(parent);
                                    return next;
                                  });
                                }}
                                className={`flex items-center justify-between text-left text-xs px-2.5 py-1.5 rounded-lg transition group border-l-2 ${
                                  isActive
                                    ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]`
                                    : `${dk("text-[#525252] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#a3a3a3] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`
                                }`}
                              >
                                <span className="min-w-0 pr-1 leading-tight break-words text-left" title={child}>{child}</span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${
                                  isActive ? dk("bg-[#262626] text-white", "bg-[#2D9F6A]/20 text-[#1a7a50]")
                                    : dk("bg-[#1a1a1a] text-[#525252] group-hover:bg-[#222]", "bg-[#f0f0f0] text-[#737373] group-hover:bg-[#e8e8e8]")
                                }`}>{count}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Standalone leaf categories (not under any parent) */}
                {categoryTree.leaves.map((c) => {
                  const isActive = categoryFilter === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setCategoryFilter(c)}
                      className={`flex items-center justify-between text-left text-sm px-2.5 py-1.5 rounded-lg transition group border-l-2 ${
                        isActive
                          ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]`
                          : `${dk("text-[#737373] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`
                      }`}
                    >
                      <span className="min-w-0 pr-1 leading-tight break-words text-left" title={c}>{c}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${
                        isActive ? dk("bg-[#262626] text-white", "bg-[#2D9F6A]/20 text-[#1a7a50]")
                          : dk("bg-[#1a1a1a] text-[#525252] group-hover:bg-[#222]", "bg-[#f0f0f0] text-[#737373] group-hover:bg-[#e8e8e8]")
                      }`}>{categoryCounts[c] || 0}</span>
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
                  {/* "Todas" */}
                  {(() => {
                    const isActive = brandFilter === "all";
                    return (
                      <button
                        onClick={() => setBrandFilter("all")}
                        className={`flex items-center justify-between text-left text-sm px-2.5 py-1.5 rounded-lg transition group border-l-2 ${
                          isActive
                            ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]`
                            : `${dk("text-[#737373] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`
                        }`}
                      >
                        <span>Todas</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${
                          isActive ? dk("bg-[#262626] text-white", "bg-[#2D9F6A]/20 text-[#1a7a50]")
                            : dk("bg-[#1a1a1a] text-[#525252] group-hover:bg-[#222]", "bg-[#f0f0f0] text-[#737373] group-hover:bg-[#e8e8e8]")
                        }`}>{products.length}</span>
                      </button>
                    );
                  })()}
                  {activeBrandsWithProducts.map((brand) => {
                    const isActive = brandFilter === brand.id;
                    const count = brandCounts[brand.id] ?? 0;
                    return (
                      <button
                        key={brand.id}
                        onClick={() => setBrandFilter(brand.id)}
                        className={`flex items-center justify-between text-left text-sm px-2.5 py-1.5 rounded-lg transition group border-l-2 ${
                          isActive
                            ? `${dk("bg-[#171717] text-white", "bg-[#f0faf5] text-[#1a7a50]")} font-medium border-[#2D9F6A]`
                            : `${dk("text-[#737373] hover:text-[#e5e5e5] hover:bg-[#171717]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")} border-transparent`
                        }`}
                      >
                        <span className="min-w-0 pr-1 leading-tight break-words text-left" title={brand.name}>{brand.name}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${
                          isActive ? dk("bg-[#262626] text-white", "bg-[#2D9F6A]/20 text-[#1a7a50]")
                            : dk("bg-[#1a1a1a] text-[#525252] group-hover:bg-[#222]", "bg-[#f0f0f0] text-[#737373] group-hover:bg-[#e8e8e8]")
                        }`}>{count}</span>
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
                  <input type="number" placeholder="Mínimo" value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className={`w-full ${dk("bg-[#0d0d0d] border-[#222] text-white focus:border-[#404040] placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4] placeholder:text-[#c4c4c4]")} border text-xs rounded-lg pl-6 pr-2 py-1.5 outline-none transition`} />
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#737373] text-xs">$</span>
                  <input type="number" placeholder="Máximo" value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className={`w-full ${dk("bg-[#0d0d0d] border-[#222] text-white focus:border-[#404040] placeholder:text-[#404040]", "bg-white border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4] placeholder:text-[#c4c4c4]")} border text-xs rounded-lg pl-6 pr-2 py-1.5 outline-none transition`} />
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* CONTENIDO PRINCIPAL */}
        <main className={`flex-1 p-4 md:p-5 overflow-y-auto`}>

          {/* ── CATÁLOGO ── */}
          {activeTab === "catalog" && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {([
                  { id: "default", label: "Catalogo general", icon: Package },
                  { id: "oportunidades", label: "🔥 Oportunidades", icon: Zap },
                  { id: "pos", label: "🧾 Punto de Venta", icon: Truck },
                ] as const).map(({ id, label, icon: Icon }) => {
                  const isActive = catalogContext === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setCatalogContext(id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        isActive
                          ? dk("bg-[#1a2a22] border-[#2D9F6A] text-white", "bg-[#e9f6ef] border-[#2D9F6A]/50 text-[#1a7a50]")
                          : dk("bg-[#111] border-[#262626] text-[#a3a3a3] hover:text-white hover:border-[#333]", "bg-white border-[#e5e5e5] text-[#525252] hover:text-[#171717] hover:bg-[#f5f5f5]")
                      }`}
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className={`mb-3 inline-flex items-center gap-1 rounded-lg border p-1 md:hidden ${dk("bg-[#111] border-[#262626]", "bg-white border-[#e5e5e5]")}`}>
                <button onClick={() => handleViewModeChange("list")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded transition ${viewMode === "list" ? dk("bg-[#262626] text-white", "bg-[#f0f0f0] text-[#171717]") : dk("text-[#737373]", "text-[#737373]")}`}>
                  Lista
                </button>
                <button onClick={() => handleViewModeChange("grid")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded transition ${viewMode === "grid" ? dk("bg-[#262626] text-white", "bg-[#f0f0f0] text-[#171717]") : dk("text-[#737373]", "text-[#737373]")}`}>
                  Grid
                </button>
                <button onClick={() => handleViewModeChange("table")}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded transition ${viewMode === "table" ? dk("bg-[#262626] text-white", "bg-[#f0f0f0] text-[#171717]") : dk("text-[#737373]", "text-[#737373]")}`}>
                  Tabla
                </button>
              </div>
              {/* Results info */}
              {!productsLoading && displayProducts.length > 0 && (
                <div className="flex items-center justify-between mb-3">
                  <p className={`text-xs ${dk("text-gray-600", "text-[#737373]")}`}>
                    {displayProducts.length} producto{displayProducts.length !== 1 ? "s" : ""}
                    {search && <> para "<span className="text-gray-400">{search}</span>"</>}
                  </p>
                </div>
              )}

              {productsLoading ? (
                viewMode === "list" || viewMode === "table" ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
                  </div>
                ) : (
                  <div className="grid gap-4 grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
                  </div>
                )
              ) : displayProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-gray-600">
                  <Search size={36} className="mb-3 opacity-20" />
                  <p className="text-sm font-medium text-gray-500">No se encontraron productos</p>
                  {(search || hasActiveFilters) && (
                    <button onClick={clearFilters}
                      className="mt-3 text-xs text-[#2D9F6A] hover:underline">
                      Limpiar filtros
                    </button>
                  )}
                </div>
              ) : viewMode === "grid" ? (

                // ── GRID ──────────────────────────────────────────────
                <div className="grid gap-4 grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {displayProducts.map((product) => {
                    const margin = productMargins[product.id] ?? globalMargin;
                    const inCart = cart[product.id] || 0;
                    const finalPrice = getUnitPrice(product, Math.max(inCart, 1)) * (1 + margin / 100);
                    const available = getAvailableStock(product);
                    const outOfStock = available === 0;
                    const wasAdded = addedIds.has(product.id);
                    const isFavorite = favoriteProductIds.includes(product.id);
                    const lastUnit = latestPurchaseUnitPrice[product.id];
                    const deltaPct = lastUnit
                      ? ((finalPrice - lastUnit) / lastUnit) * 100
                      : 0;

                    return (
                      <div
                        key={product.id}
                        className={`${dk("bg-[#111]", "bg-white")} border rounded-xl p-4 flex flex-col transition-all duration-200 ${
                          outOfStock
                            ? dk("border-[#1a1a1a]", "border-[#e5e5e5]") + " opacity-40"
                            : dk("border-[#1f1f1f] hover:border-[#2a2a2a] hover:bg-[#141414] hover:shadow-black/30", "border-[#e5e5e5] hover:border-[#d4d4d4] hover:bg-[#fafafa] hover:shadow-black/5") + " hover:-translate-y-px hover:shadow-lg"
                        }`}
                      >
                        <div className="cursor-pointer" onClick={() => setSelectedProduct(product)}>
                          <div className="relative mb-3">
                            <div className={`h-32 w-full ${dk("bg-[#0a0a0a]", "bg-[#f9f9f9]")} rounded-lg flex items-center justify-center overflow-hidden`}>
                              <img src={product.image} alt={product.name}
                                loading="lazy"
                                decoding="async"
                                className="max-h-28 max-w-full object-contain p-2" />
                            </div>
                            {inCart > 0 && (
                              <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-[#2D9F6A] text-white text-[10px] font-black flex items-center justify-center shadow">
                                {inCart}
                              </span>
                            )}
                            {product.featured && (
                              <span className="absolute top-2 left-2 inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                                <Star size={8} fill="currentColor" />
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFavorite(product.id);
                              }}
                              className={`absolute bottom-2 right-2 h-7 w-7 rounded-full border flex items-center justify-center transition ${
                                isFavorite
                                  ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                                  : dk("bg-[#111]/80 text-gray-500 border-[#222] hover:text-yellow-400", "bg-white/80 text-gray-400 border-gray-200 hover:text-yellow-500")
                              }`}
                            >
                              <Star size={11} fill={isFavorite ? "currentColor" : "none"} />
                            </button>
                            {/* Compare toggle */}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleCompare(product.id); }}
                              className={`absolute bottom-2 left-2 text-[9px] font-bold px-1.5 py-0.5 rounded border transition ${
                                compareList.includes(product.id)
                                  ? "bg-blue-600 text-white border-blue-500"
                                  : dk("bg-[#111]/80 text-gray-500 border-[#222] hover:text-white", "bg-white/80 text-gray-400 border-gray-200 hover:text-gray-700")
                              }`}
                            >
                              {compareList.includes(product.id) ? "✓ Comp." : "Comparar"}
                            </button>
                          </div>
                          <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")} leading-tight line-clamp-2 mb-1`}>{product.name}</h3>
                          <p className={`text-[11px] ${dk("text-gray-600", "text-[#737373]")} mb-1.5`}>
                            {product.category}
                            {product.sku && <span className="font-mono ml-1 text-gray-700">· {product.sku}</span>}
                          </p>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <StockBadge stock={available} lugStock={getLugStock(product)} />
                            {isPosProduct(product) && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                <Truck size={9} /> POS
                              </span>
                            )}
                            {purchaseHistory[product.id] > 0 && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${dk("bg-[#1c1c1c] text-gray-500", "bg-[#f0f0f0] text-[#737373]")}`}>
                                Compraste {purchaseHistory[product.id]}u
                              </span>
                            )}
                          </div>
                          <div className="text-lg text-[#2D9F6A] font-extrabold leading-tight tabular-nums">
                            {formatPrice(finalPrice)}
                          </div>
                          <div className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")} mt-0.5`}>sin IVA · {product.iva_rate ?? 21}%</div>
                          {lastUnit && deltaPct > 0 && (
                            <div className="mt-1 text-[10px] font-semibold text-amber-500">
                              ↑ Este producto aumentó {deltaPct.toFixed(1)}% desde tu última compra
                            </div>
                          )}
                        </div>

                        <div className="mt-3 flex gap-1.5">
                          {inCart > 0 ? (
                            <>
                              <button onClick={() => onRemoveFromCart(product)}
                                className={`flex-1 ${dk("bg-[#1c1c1c] hover:bg-[#252525] text-white border-[#262626]", "bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#171717] border-[#e5e5e5]")} active:scale-95 rounded-lg py-1.5 text-sm font-bold transition-all border`}>−</button>
                              <span className={`flex items-center justify-center px-3 ${dk("text-white", "text-[#171717]")} font-bold text-sm`}>{inCart}</span>
                              <button onClick={() => handleAddToCart(product)}
                                className="flex-1 bg-[#2D9F6A] hover:bg-[#25835A] active:scale-95 text-white rounded-lg py-1.5 text-sm font-bold transition-all">+</button>
                            </>
                          ) : (
                            <button
                              disabled={outOfStock}
                              onClick={() => handleAddToCart(product)}
                              className={`w-full font-bold text-sm h-8 rounded-lg transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
                                wasAdded
                                  ? "bg-green-600 hover:bg-green-600 text-white"
                                  : "bg-[#2D9F6A] hover:bg-[#25835A] text-white"
                              }`}
                            >
                              {outOfStock ? "Sin stock" : wasAdded ? "✓ Añadido" : "Añadir"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

              ) : viewMode === "list" ? (

                // ── LISTA ─────────────────────────────────────────────
                <div className="flex flex-col gap-1.5">
                  {displayProducts.map((product) => {
                    const margin = productMargins[product.id] ?? globalMargin;
                    const inCart = cart[product.id] || 0;
                    const finalPrice = getUnitPrice(product, Math.max(inCart, 1)) * (1 + margin / 100);
                    const available = getAvailableStock(product);
                    const outOfStock = available === 0;
                    const wasAdded = addedIds.has(product.id);
                    const isFavorite = favoriteProductIds.includes(product.id);
                    const lastUnit = latestPurchaseUnitPrice[product.id];
                    const deltaPct = lastUnit
                      ? ((finalPrice - lastUnit) / lastUnit) * 100
                      : 0;

                    return (
                      <div
                        key={product.id}
                        className={`group flex items-center gap-3 ${dk("bg-[#111]", "bg-white")} border rounded-xl px-3 py-2.5 transition-all duration-150 ${
                          outOfStock
                            ? dk("border-[#1a1a1a]", "border-[#e5e5e5]") + " opacity-40"
                            : dk("border-[#1f1f1f] hover:border-[#252525] hover:bg-[#161616]", "border-[#e5e5e5] hover:border-[#d4d4d4] hover:bg-[#fafafa]")
                        }`}
                      >
                        {/* Clickable area */}
                        <div
                          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                          onClick={() => setSelectedProduct(product)}
                        >
                          {/* Thumbnail */}
                          <div className={`h-14 w-14 shrink-0 ${dk("bg-[#0a0a0a] border-[#1a1a1a] group-hover:border-[#222]", "bg-[#f9f9f9] border-[#e5e5e5] group-hover:border-[#d4d4d4]")} rounded-xl flex items-center justify-center overflow-hidden border transition-colors`}>
                            <img src={product.image} alt={product.name}
                              loading="lazy"
                              decoding="async"
                              className="max-h-12 max-w-12 object-contain" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className={`text-sm font-bold ${dk("text-white", "text-[#171717]")} truncate leading-tight`}>{product.name}</p>
                              {product.featured && (
                                <Star size={11} className="text-yellow-500 shrink-0" fill="currentColor" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] text-gray-600">{product.category}</span>
                              {isPosProduct(product) && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  <Truck size={9} /> POS
                                </span>
                              )}
                              {product.brand_name && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (product.brand_id) setBrandFilter(product.brand_id);
                                  }}
                                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition"
                                >
                                  {product.brand_name}
                                </button>
                              )}
                              {product.sku && (
                                <span className={`text-[10px] font-mono ${dk("text-[#525252] bg-[#171717]", "text-[#737373] bg-[#f0f0f0]")} px-1.5 py-0.5 rounded`}>{product.sku}</span>
                              )}
                            </div>
                          </div>

                          {/* Stock + history */}
                          <div className="hidden sm:flex items-center gap-1.5 shrink-0 flex-wrap">
                            <StockBadge stock={available} lugStock={getLugStock(product)} />
                            {purchaseHistory[product.id] > 0 && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${dk("bg-[#1c1c1c] text-gray-500", "bg-[#f0f0f0] text-[#737373]")}`}>
                                {purchaseHistory[product.id]}u prev.
                              </span>
                            )}
                          </div>

                          {/* Price */}
                          <div className="text-right shrink-0 hidden sm:block min-w-[100px]">
                            <div className="text-base font-extrabold text-[#2D9F6A] tabular-nums leading-tight">
                              {formatPrice(finalPrice)}
                            </div>
                            <div className={`text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")} mt-0.5`}>sin IVA · {product.iva_rate ?? 21}%</div>
                          {lastUnit && deltaPct > 0 && (
                            <div className="text-[10px] font-semibold text-amber-500">
                              ↑ +{deltaPct.toFixed(1)}% vs última compra
                            </div>
                          )}
                          </div>
                        </div>

                        {/* Cart controls */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Compare toggle */}
                          <button
                            onClick={() => toggleCompare(product.id)}
                            title="Comparar"
                            className={`hidden sm:flex h-8 w-8 items-center justify-center rounded-lg border text-[10px] font-bold transition ${
                              compareList.includes(product.id)
                                ? "bg-blue-600 text-white border-blue-500"
                                : dk("bg-[#1c1c1c] text-gray-600 border-[#262626] hover:text-white", "bg-[#f5f5f5] text-gray-400 border-[#e5e5e5] hover:text-gray-700")
                            }`}
                          >
                            ⇄
                          </button>
                          <button
                            onClick={() => handleToggleFavorite(product.id)}
                            title="Favorito"
                            className={`hidden sm:flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                              isFavorite
                                ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                                : dk("bg-[#1c1c1c] text-gray-600 border-[#262626] hover:text-yellow-400", "bg-[#f5f5f5] text-gray-400 border-[#e5e5e5] hover:text-yellow-500")
                            }`}
                          >
                            <Star size={12} fill={isFavorite ? "currentColor" : "none"} />
                          </button>
                          {inCart > 0 ? (
                            <>
                              <button onClick={() => onRemoveFromCart(product)}
                                className={`h-8 w-8 ${dk("bg-[#1c1c1c] hover:bg-[#252525] text-white border-[#262626]", "bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#171717] border-[#e5e5e5]")} active:scale-95 rounded-lg text-sm font-bold transition-all flex items-center justify-center border`}>
                                <Minus size={12} />
                              </button>
                              <span className={`w-7 text-center ${dk("text-white", "text-[#171717]")} font-bold text-sm tabular-nums`}>{inCart}</span>
                              <button onClick={() => handleAddToCart(product)}
                                className="h-8 w-8 bg-[#2D9F6A] hover:bg-[#25835A] active:scale-95 text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center">
                                <Plus size={12} />
                              </button>
                            </>
                          ) : (
                            <button
                              disabled={outOfStock}
                              onClick={() => handleAddToCart(product)}
                              className={`text-xs h-8 px-3.5 rounded-lg font-bold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap ${
                                wasAdded
                                  ? "bg-green-600/90 text-white"
                                  : "bg-[#2D9F6A] hover:bg-[#25835A] text-white"
                              }`}
                            >
                              {outOfStock ? "Sin stock" : wasAdded ? "✓ Añadido" : "Añadir"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

              ) : (

                // ── TABLA DE PRECIOS (alta densidad) ─────────────────
                <div className={`rounded-xl border overflow-hidden ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")}`}>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className={`${dk("bg-[#0d0d0d] text-[#525252]", "bg-[#f5f5f5] text-[#a3a3a3]")} text-[11px] font-bold uppercase tracking-wide`}>
                        <th className="text-left px-3 py-2.5">SKU</th>
                        <th className="text-left px-3 py-2.5">Nombre</th>
                        <th className="hidden sm:table-cell text-left px-3 py-2.5">Categoría</th>
                        <th className="text-center px-3 py-2.5">Stock</th>
                        <th className="text-right px-3 py-2.5">Precio s/IVA</th>
                        <th className="text-right px-3 py-2.5 w-32">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayProducts.map((product, idx) => {
                        const margin = productMargins[product.id] ?? globalMargin;
                        const inCart = cart[product.id] || 0;
                        const finalPrice = getUnitPrice(product, Math.max(inCart, 1)) * (1 + margin / 100);
                        const available = getAvailableStock(product);
                        const outOfStock = available === 0;
                        const wasAdded = addedIds.has(product.id);
                        const isFavorite = favoriteProductIds.includes(product.id);
                        const hasTiers = product.price_tiers && product.price_tiers.length > 1;
                        const lastUnit = latestPurchaseUnitPrice[product.id];
                        const deltaPct = lastUnit
                          ? ((finalPrice - lastUnit) / lastUnit) * 100
                          : 0;
                        return (
                          <tr
                            key={product.id}
                            className={`border-t transition ${
                              outOfStock ? "opacity-40 " : ""
                            }${idx % 2 === 0
                              ? dk("bg-[#111] border-[#1a1a1a]", "bg-white border-[#f0f0f0]")
                              : dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-[#fafafa] border-[#f0f0f0]")
                            } ${!outOfStock ? dk("hover:bg-[#161616]", "hover:bg-[#f5f5f5]") : ""}`}
                          >
                            <td className="px-3 py-2">
                              <button className="text-left" onClick={() => setSelectedProduct(product)}>
                                <span className={`text-[11px] font-mono ${dk("text-[#525252]", "text-[#737373]")}`}>
                                  {product.sku ?? "—"}
                                </span>
                              </button>
                            </td>
                            <td className="px-3 py-2 max-w-[220px]">
                              <button className="text-left w-full" onClick={() => setSelectedProduct(product)}>
                                <span className={`text-sm font-medium ${dk("text-gray-200", "text-[#171717]")} line-clamp-1`}>
                                  {product.name}
                                  {isFavorite && <Star size={10} className="inline ml-1 text-yellow-500" fill="currentColor" />}
                                </span>
                                {hasTiers && (
                                  <span className="text-[10px] text-[#2D9F6A] font-semibold">Precio por volumen</span>
                                )}
                              </button>
                            </td>
                            <td className={`hidden sm:table-cell px-3 py-2 text-xs ${dk("text-gray-600", "text-[#737373]")}`}>
                              <div className="inline-flex items-center gap-1.5">
                                <span>{product.category}</span>
                                {isPosProduct(product) && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    <Truck size={9} /> POS
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <StockBadge stock={available} lugStock={getLugStock(product)} />
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              <span className="text-sm font-bold text-[#2D9F6A]">{formatPrice(finalPrice)}</span>
                              <span className={`block text-[10px] ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>+{product.iva_rate ?? 21}% IVA</span>
                              {lastUnit && deltaPct > 0 && (
                                <span className="block text-[10px] font-semibold text-amber-500">↑ +{deltaPct.toFixed(1)}%</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {inCart > 0 ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button onClick={() => onRemoveFromCart(product)}
                                    className={`h-7 w-7 ${dk("bg-[#1c1c1c] hover:bg-[#252525] text-white border-[#262626]", "bg-[#f5f5f5] hover:bg-[#ebebeb] text-[#171717] border-[#e5e5e5]")} active:scale-95 rounded-md text-sm font-bold transition-all flex items-center justify-center border`}>
                                    <Minus size={11} />
                                  </button>
                                  <span className={`w-5 text-center ${dk("text-white", "text-[#171717]")} font-bold text-xs tabular-nums`}>{inCart}</span>
                                  <button onClick={() => handleAddToCart(product)}
                                    className="h-7 w-7 bg-[#2D9F6A] hover:bg-[#25835A] active:scale-95 text-white rounded-md text-sm font-bold transition-all flex items-center justify-center">
                                    <Plus size={11} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  disabled={outOfStock}
                                  onClick={() => handleAddToCart(product)}
                                  className={`text-xs h-7 px-3 rounded-md font-bold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${
                                    wasAdded ? "bg-green-600/90 text-white" : "bg-[#2D9F6A] hover:bg-[#25835A] text-white"
                                  }`}
                                >
                                  {outOfStock ? "Sin stock" : wasAdded ? "✓" : "+ Añadir"}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── COTIZACIONES ── */}
          {activeTab === "quotes" && (
            <QuoteList
              quotes={quotes}
              isDark={isDark}
              onLoad={handleLoadQuote}
              onUpdateStatus={updateQuoteStatus}
              onDelete={deleteQuote}
              onGoToCatalog={() => setActiveTab("catalog")}
            />
          )}

          {/* ── MI CUENTA ── */}
          {activeTab === "cuenta" && profile && (
            <AccountCenter
              profile={profile}
              sessionEmail={user?.email}
              isDark={isDark}
              orders={orders}
              quotes={quotes}
              invoices={myInvoices}
              favoriteProducts={favoriteProducts}
              savedCarts={savedCarts}
              onGoToTab={setActiveTab}
              onLoadSavedCart={handleLoadSavedCart}
              onDeleteSavedCart={handleDeleteSavedCart}
            />
          )}
          {showLegacyPortalSections && activeTab === "cuenta" && profile && (() => {
            const confirmedOrders  = orders.filter((o) => !["rejected"].includes(o.status));
            const totalSpent       = confirmedOrders.reduce((s, o) => s + o.total, 0);
            const pendingOrders    = orders.filter((o) => ["pending", "approved", "preparing"].includes(o.status));
            const pendingTotal     = pendingOrders.reduce((s, o) => s + o.total, 0);
            const paidInvoices     = myInvoices.filter((i) => i.status === "paid");
            const paidTotal        = paidInvoices.reduce((s, i) => s + i.total, 0);
            const unpaidInvoices   = myInvoices.filter((i) => ["sent", "overdue", "draft"].includes(i.status));
            const unpaidTotal      = unpaidInvoices.reduce((s, i) => s + i.total, 0);
            const overdueInvoices  = myInvoices.filter((i) => i.status === "overdue");
            const creditLimit      = profile.credit_limit ?? 0;
            const creditPct        = creditLimit > 0 ? Math.min(100, (creditUsed / creditLimit) * 100) : 0;
            const creditAvail      = Math.max(0, creditLimit - creditUsed);
            // credit_limit is stored in ARS — format directly without USD→ARS conversion
            const fmtCreditARS    = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;


            return (
              <div className="max-w-3xl space-y-4">
                {/* Header */}
                <div>
                  <h2 className={`text-base font-bold ${dk("text-white", "text-[#171717]")}`}>Mi Cuenta</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{profile.company_name || profile.contact_name}</p>
                </div>

                {/* KPI grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Total comprado", value: formatPrice(totalSpent), color: "text-[#2D9F6A]" },
                    { label: "En curso", value: formatPrice(pendingTotal), color: "text-amber-400" },
                    { label: "Facturas pagadas", value: formatPrice(paidTotal), color: "text-emerald-400" },
                    { label: "Facturas pendientes", value: formatPrice(unpaidTotal), color: unpaidTotal > 0 ? "text-red-400" : dk("text-gray-400", "text-[#737373]") },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`border rounded-xl px-4 py-3 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
                      <p className={`text-lg font-bold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Credit */}
                {creditLimit > 0 && (
                  <div className={`border rounded-xl px-5 py-4 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${dk("text-gray-400", "text-[#737373]")}`}>Crédito disponible</p>
                    <div className="flex items-end justify-between mb-2">
                      <div>
                        <span className={`text-2xl font-extrabold ${creditPct >= 80 ? "text-red-400" : "text-[#2D9F6A]"}`}>
                          {fmtCreditARS(creditAvail)}
                        </span>
                        <span className={`text-xs ml-2 ${dk("text-gray-500", "text-[#737373]")}`}>
                          disponible de {fmtCreditARS(creditLimit)}
                        </span>
                      </div>
                      <span className={`text-sm font-bold ${creditPct >= 80 ? "text-red-400" : dk("text-gray-400", "text-[#737373]")}`}>
                        {creditPct.toFixed(0)}% usado
                      </span>
                    </div>
                    <div className={`h-2 rounded-full overflow-hidden ${dk("bg-[#1c1c1c]", "bg-[#e8e8e8]")}`}>
                      <div
                        className={`h-full rounded-full transition-all ${creditPct >= 100 ? "bg-red-500" : creditPct >= 80 ? "bg-amber-400" : "bg-[#2D9F6A]"}`}
                        style={{ width: `${creditPct}%` }}
                      />
                    </div>
                    {creditUsed > 0 && (
                      <p className={`text-[11px] mt-1.5 ${dk("text-gray-500", "text-[#a3a3a3]")}`}>
                        {formatPrice(creditUsed)} comprometido en pedidos activos
                      </p>
                    )}
                  </div>
                )}

                {/* Overdue invoices alert */}
                {overdueInvoices.length > 0 && (
                  <div className="flex items-start gap-3 border border-red-500/30 bg-red-500/10 rounded-xl px-4 py-3">
                    <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-400">
                        {overdueInvoices.length} factura{overdueInvoices.length > 1 ? "s" : ""} vencida{overdueInvoices.length > 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-red-400/70 mt-0.5">
                        Total pendiente: {formatPrice(overdueInvoices.reduce((s, i) => s + i.total, 0))}. Contactá a tu ejecutivo de cuenta.
                      </p>
                    </div>
                  </div>
                )}

                {/* Recent orders */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-xs font-bold uppercase tracking-wider ${dk("text-gray-400", "text-[#737373]")}`}>Últimos pedidos</p>
                    <button onClick={() => setActiveTab("orders")} className="text-xs text-[#2D9F6A] hover:underline">Ver todos</button>
                  </div>
                  {confirmedOrders.slice(0, 5).map((o) => {
                    const lbl = o.order_number ?? `#${String(o.id).slice(-6).toUpperCase()}`;
                    return (
                      <div key={o.id} className={`flex items-center justify-between px-4 py-2.5 rounded-lg mb-1 ${dk("bg-[#111]", "bg-white border border-[#f0f0f0]")}`}>
                        <span className={`text-xs font-mono ${dk("text-gray-300", "text-[#525252]")}`}>{lbl}</span>
                        <span className="text-xs text-gray-500">{new Date(o.created_at).toLocaleDateString("es-AR")}</span>
                        <span className={`text-xs font-bold ${dk("text-white", "text-[#171717]")}`}>{formatPrice(o.total)}</span>
                      </div>
                    );
                  })}
                  {confirmedOrders.length === 0 && (
                    <p className="text-xs text-gray-500">Sin pedidos confirmados.</p>
                  )}
                </div>

                {/* Recent invoices */}
                {myInvoices.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-xs font-bold uppercase tracking-wider ${dk("text-gray-400", "text-[#737373]")}`}>Últimas facturas</p>
                      <button onClick={() => setActiveTab("invoices")} className="text-xs text-[#2D9F6A] hover:underline">Ver todas</button>
                    </div>
                    {myInvoices.slice(0, 5).map((inv) => {
                      const STATUS_CLS: Record<string, string> = {
                        paid: "text-emerald-400", sent: "text-blue-400", overdue: "text-red-400",
                        draft: "text-gray-500", cancelled: "text-gray-600",
                      };
                      return (
                        <div key={inv.id} className={`flex items-center justify-between px-4 py-2.5 rounded-lg mb-1 ${dk("bg-[#111]", "bg-white border border-[#f0f0f0]")}`}>
                          <span className={`text-xs font-mono ${dk("text-gray-300", "text-[#525252]")}`}>{inv.invoice_number}</span>
                          <span className={`text-xs font-semibold ${STATUS_CLS[inv.status] ?? "text-gray-500"}`}>
                            {{ paid: "Pagada", sent: "Enviada", overdue: "Vencida", draft: "Borrador", cancelled: "Cancelada" }[inv.status as string] ?? inv.status}
                          </span>
                          <span className={`text-xs font-bold ${dk("text-white", "text-[#171717]")}`}>
                            {new Intl.NumberFormat("es-AR", { style: "currency", currency: inv.currency, maximumFractionDigits: 0 }).format(inv.total)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── MIS FACTURAS ── */}
          {activeTab === "invoices" && (
            <InvoicesPanel
              invoices={myInvoices}
              orders={orders}
              isDark={isDark}
              loading={loadingInvoices}
              onGoToOrders={() => setActiveTab("orders")}
            />
          )}
          {showLegacyPortalSections && activeTab === "invoices" && (
            <div className="max-w-3xl">
              {loadingInvoices ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`h-16 rounded-xl animate-pulse ${dk("bg-[#111]", "bg-white")}`} />
                  ))}
                </div>
              ) : myInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-gray-600">
                  <FileText size={36} className="mb-3 opacity-20" />
                  <p className="text-sm font-medium text-gray-500">No tenés facturas todavía</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {myInvoices.map((inv: Invoice) => {
                    const STATUS_LABELS: Record<InvoiceStatus, { label: string; cls: string }> = {
                      draft:     { label: "Borrador",  cls: "text-gray-400" },
                      sent:      { label: "Enviada",   cls: "text-blue-400" },
                      paid:      { label: "Pagada",    cls: "text-emerald-400" },
                      overdue:   { label: "Vencida",   cls: "text-red-400" },
                      cancelled: { label: "Cancelada", cls: "text-gray-500" },
                    };
                    const statusInfo = STATUS_LABELS[inv.status] ?? STATUS_LABELS.draft;
                    const fmtCur = (n: number) =>
                      new Intl.NumberFormat("es-AR", { style: "currency", currency: inv.currency, maximumFractionDigits: 0 }).format(n);
                    return (
                      <div key={inv.id} className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl px-5 py-4`}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${dk("bg-[#1a1a1a]", "bg-[#f0f0f0]")}`}>
                              <FileText size={13} className="text-[#2D9F6A]" />
                            </div>
                            <div className="min-w-0">
                              <p className={`text-xs font-bold font-mono ${dk("text-gray-300", "text-[#525252]")}`}>{inv.invoice_number}</p>
                              <p className="text-[11px] text-gray-500">
                                {inv.due_date ? `Vence ${new Date(inv.due_date).toLocaleDateString("es-AR")}` : "Sin vencimiento"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <span className={`text-[11px] font-semibold ${statusInfo.cls}`}>{statusInfo.label}</span>
                            <div className="text-right">
                              <p className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>{fmtCur(inv.total)}</p>
                              {inv.paid_at && (
                                <p className="text-[11px] text-emerald-500">
                                  Pagada {new Date(inv.paid_at).toLocaleDateString("es-AR")}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── MIS PEDIDOS ── */}
          {activeTab === "orders" && (
            <OrdersPanel
              isDark={isDark}
              orders={orders}
              invoices={myInvoices}
              formatPrice={formatPrice}
              formatUSD={formatUSD}
              formatARS={formatARS}
              currency={currency}
              onRepeatOrder={handleRepeatOrder}
              onGoToCatalog={() => setActiveTab("catalog")}
              onGoToInvoices={() => setActiveTab("invoices")}
              onUpdateOrderProofs={handleUpdateOrderProofs}
            />
          )}
          {showLegacyPortalSections && activeTab === "orders" && (
            <div className="max-w-3xl">
              {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-gray-600">
                  <ClipboardList size={36} className="mb-3 opacity-20" />
                  <p className="text-sm font-medium text-gray-500">Todavía no hiciste ningún pedido</p>
                  <button onClick={() => setActiveTab("catalog")}
                    className="mt-3 text-xs text-[#2D9F6A] hover:underline">Ver catálogo</button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {orders.map((order) => {
                    const orderId = String(order.id);
                    const isExpanded = expandedOrders.has(orderId);
                    const toggleExpand = () =>
                      setExpandedOrders((prev) => toggleSetValue(prev, orderId));
                    const orderLabel = order.order_number ?? `#${orderId.slice(-6).toUpperCase()}`;
                    return (
                      <div key={order.id} className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl overflow-hidden`}>
                        {/* Order header — clickable to expand */}
                        <button
                          onClick={toggleExpand}
                          className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition ${dk("hover:bg-[#141414]", "hover:bg-[#fafafa]")}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {isExpanded
                              ? <ChevronUp size={14} className="text-gray-600 shrink-0" />
                              : <ChevronDown size={14} className="text-gray-600 shrink-0" />}
                            <div className="min-w-0">
                              <span className={`text-xs font-bold font-mono ${dk("text-gray-300", "text-[#525252]")}`}>{orderLabel}</span>
                              <p className="text-[11px] text-gray-600 mt-0.5">
                                {new Date(order.created_at).toLocaleDateString("es-AR", {
                                  day: "2-digit", month: "short", year: "numeric",
                                  hour: "2-digit", minute: "2-digit"
                                })}
                                {" · "}{order.products.length} {order.products.length === 1 ? "producto" : "productos"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            {order.status === "dispatched" && order.numero_remito && (
                              <span className={`text-[10px] font-mono ${dk("text-blue-400 bg-blue-500/10 border-blue-500/20", "text-blue-600 bg-blue-50 border-blue-200")} border px-1.5 py-0.5 rounded`}>
                                Remito: {order.numero_remito}
                              </span>
                            )}
                            <StatusBadge status={order.status} />
                            <span className="font-bold text-sm text-[#2D9F6A] tabular-nums">
                              {formatPrice(order.total)}
                            </span>
                          </div>
                        </button>
                        {/* Expandable product list */}
                        {isExpanded && (
                          <>
                            <div className={`border-t ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
                              {order.products.map((p, i) => (
                                <div key={i} className={`flex items-center justify-between px-5 py-2 text-sm border-b ${dk("border-[#1a1a1a]", "border-[#f0f0f0]")} last:border-0`}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    {p.sku && <span className={`text-[10px] font-mono shrink-0 ${dk("text-[#525252] bg-[#171717]", "text-[#737373] bg-[#f0f0f0]")} px-1.5 py-0.5 rounded`}>{p.sku}</span>}
                                    <span className={`${dk("text-gray-300", "text-[#525252]")} truncate`}>{p.name}</span>
                                    <span className={`text-[11px] shrink-0 ${dk("text-gray-600", "text-[#a3a3a3]")}`}>×{p.quantity}</span>
                                  </div>
                                  <span className="text-[#2D9F6A] font-semibold tabular-nums shrink-0 ml-4 text-xs">
                                    {formatPrice(p.total_price ?? 0)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className={`flex items-center justify-between ${dk("bg-[#0a0a0a]", "bg-[#f9f9f9]")} px-5 py-2.5`}>
                              <div className="flex items-center gap-3">
                                <span className={`text-xs ${dk("text-gray-600", "text-[#a3a3a3]")}`}>
                                  {currency === "USD" ? formatARS(order.total) : formatUSD(order.total)}
                                </span>
                                <button
                                  onClick={() => handleRepeatOrder(order)}
                                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")}`}
                                >
                                  ↺ Repetir pedido
                                </button>
                              </div>
                              <span className="text-base font-extrabold text-[#2D9F6A] tabular-nums">
                                {formatPrice(order.total)}
                              </span>
                            </div>
                            <div className={`border-t ${dk("border-[#1a1a1a] bg-[#0d0d0d]", "border-[#e5e5e5] bg-white")} px-5 py-3`}>
                              <p className={`text-[11px] font-semibold mb-2 ${dk("text-gray-400", "text-[#525252]")}`}>
                                Comprobantes de pago
                              </p>
                              <div className="grid grid-cols-1 md:grid-cols-[120px_120px_140px_1fr_auto] gap-2">
                                <select
                                  value={proofForm[orderId]?.type ?? "transferencia"}
                                  onChange={(e) =>
                                    setProofForm((prev) => ({
                                      ...prev,
                                      [orderId]: {
                                        type: e.target.value as PaymentProofType,
                                        amount: prev[orderId]?.amount ?? "",
                                        date: prev[orderId]?.date ?? new Date().toISOString().slice(0, 10),
                                        file: prev[orderId]?.file ?? null,
                                        uploading: false,
                                        error: "",
                                      },
                                    }))
                                  }
                                  className={`text-xs rounded-lg border px-2 py-1.5 ${dk("bg-[#111] border-[#262626] text-gray-300", "bg-white border-[#e5e5e5] text-[#525252]")}`}
                                >
                                  <option value="transferencia">Transferencia</option>
                                  <option value="echeq">Echeq</option>
                                </select>
                                <input
                                  type="number"
                                  placeholder="Monto"
                                  value={proofForm[orderId]?.amount ?? ""}
                                  onChange={(e) =>
                                    setProofForm((prev) => ({
                                      ...prev,
                                      [orderId]: {
                                        type: prev[orderId]?.type ?? "transferencia",
                                        amount: e.target.value,
                                        date: prev[orderId]?.date ?? new Date().toISOString().slice(0, 10),
                                        file: prev[orderId]?.file ?? null,
                                        uploading: false,
                                        error: "",
                                      },
                                    }))
                                  }
                                  className={`text-xs rounded-lg border px-2 py-1.5 ${dk("bg-[#111] border-[#262626] text-gray-300", "bg-white border-[#e5e5e5] text-[#525252]")}`}
                                />
                                <input
                                  type="date"
                                  value={proofForm[orderId]?.date ?? new Date().toISOString().slice(0, 10)}
                                  onChange={(e) =>
                                    setProofForm((prev) => ({
                                      ...prev,
                                      [orderId]: {
                                        type: prev[orderId]?.type ?? "transferencia",
                                        amount: prev[orderId]?.amount ?? "",
                                        date: e.target.value,
                                        file: prev[orderId]?.file ?? null,
                                        uploading: false,
                                        error: "",
                                      },
                                    }))
                                  }
                                  className={`text-xs rounded-lg border px-2 py-1.5 ${dk("bg-[#111] border-[#262626] text-gray-300", "bg-white border-[#e5e5e5] text-[#525252]")}`}
                                />
                                <input
                                  type="file"
                                  accept=".pdf,image/*"
                                  onChange={(e) =>
                                    setProofForm((prev) => ({
                                      ...prev,
                                      [orderId]: {
                                        type: prev[orderId]?.type ?? "transferencia",
                                        amount: prev[orderId]?.amount ?? "",
                                        date: prev[orderId]?.date ?? new Date().toISOString().slice(0, 10),
                                        file: e.target.files?.[0] ?? null,
                                        uploading: false,
                                        error: "",
                                      },
                                    }))
                                  }
                                  className={`text-xs rounded-lg border px-2 py-1.5 ${dk("bg-[#111] border-[#262626] text-gray-400", "bg-white border-[#e5e5e5] text-[#737373]")}`}
                                />
                                <button
                                  onClick={() => handleUploadProof(orderId)}
                                  disabled={proofForm[orderId]?.uploading}
                                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#2D9F6A] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                >
                                  <Upload size={12} />
                                  {proofForm[orderId]?.uploading ? "Subiendo..." : "Subir"}
                                </button>
                              </div>
                              {proofForm[orderId]?.error && (
                                <p className="mt-1 text-[11px] text-red-400">{proofForm[orderId]?.error}</p>
                              )}
                              {(orderProofs[orderId] ?? []).length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {(orderProofs[orderId] ?? []).map((proof) => (
                                    <a
                                      key={`${proof.filePath}-${proof.uploadedAt}`}
                                      href={proof.publicUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={`flex items-center justify-between rounded-lg border px-2 py-1 text-[11px] ${dk("border-[#262626] text-gray-300 hover:bg-[#111]", "border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa]")}`}
                                    >
                                      <span>{proof.type} · {new Date(proof.date).toLocaleDateString("es-AR")} · {formatPrice(proof.amount)}</span>
                                      <span className="text-[#2D9F6A] font-semibold">Ver</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* COMPARADOR PRODUCTOS */}
      {compareList.length > 0 && (
        <ProductCompare
          products={products.filter((p) => compareList.includes(p.id))}
          onRemove={(id) => setCompareList((prev) => prev.filter((x) => x !== id))}
          onClear={() => setCompareList([])}
          formatPrice={formatPrice}
          currency={currency}
        />
      )}

      {/* MODAL PRODUCTO */}
      {productModal}
    </div>
  );
}

