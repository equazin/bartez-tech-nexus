import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { CLIENT_TYPE_MARGINS, ClientType } from "@/lib/supabase";
import { Product } from "@/models/products";
import { OrderProduct } from "@/models/order";
import ProductForm from "@/components/admin/ProductForm";
import ProductImport from "@/components/admin/ProductImport";
import ProductTable from "@/components/admin/ProductTable";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useCurrency } from "@/context/CurrencyContext";
import { OrderStatusBadge as StatusBadge } from "@/components/OrderStatusBadge";
import { toggleSetValue } from "@/lib/toggleSet";
import {
  CheckCircle2, XCircle, Clock, Trash2, RefreshCw, Save, Sparkles,
  Users, Package, ClipboardList, LogOut, UserPlus, X, Plus,
  DollarSign, Pencil, Check, LayoutDashboard, Sun, Moon, Phone,
  Truck, Download, Building2, Tag, BarChart2, Activity, Wifi, Bookmark, Flame,
  Layers, FileText, History, CreditCard, MessageSquare, ShoppingBag, Image, LifeBuoy, Ticket, Globe, RotateCcw, Handshake, ShieldCheck, type LucideIcon,
} from "lucide-react";
import { exportOrdersCSV, exportCatalogCSV, exportReportsCSV } from "@/lib/exportCsv";
import { exportCatalogPdf, exportRemitoPdf } from "@/lib/exportPdf";
import { useOrdersRealtime } from "@/hooks/useOrdersRealtime";
import { SupplierPriceImport } from "@/components/admin/SupplierPriceImport";
import { BulkDeleteProducts } from "@/components/admin/BulkDeleteProducts";
import { ErrorBoundary } from "@/components/admin/ErrorBoundary";
import { CreateOrderModal } from "@/components/admin/CreateOrderModal";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { logActivity } from "@/lib/api/activityLog";
import { whatsappNotifications } from "@/lib/api/whatsappNotifications";
import type { KanbanStatus, KanbanOrder } from "../components/admin/OrderKanban";
import { MarketingTab } from "@/components/admin/MarketingTab";
import { B2BInsights } from "@/components/admin/B2BInsights";

// Lazy loaded tabs
const SalesDashboard = lazy(() => import("@/components/admin/SalesDashboard").then(m => ({ default: m.SalesDashboard })));
const ClientCRM = lazy(() => import("@/components/admin/ClientCRM").then(m => ({ default: m.ClientCRM })));
const OrderKanban = lazy(() => import("@/components/admin/OrderKanban"));
const SuppliersTab = lazy(() => import("@/components/admin/SuppliersTab").then(m => ({ default: m.SuppliersTab })));
const BrandsTab = lazy(() => import("@/components/admin/BrandsTab").then(m => ({ default: m.BrandsTab })));
const PricingRulesTab = lazy(() => import("@/components/admin/PricingRulesTab").then(m => ({ default: m.PricingRulesTab })));
const ReportsTab = lazy(() => import("@/components/admin/ReportsTab").then(m => ({ default: m.ReportsTab })));
const ActivityLogTab = lazy(() => import("@/components/admin/ActivityLogTab").then(m => ({ default: m.ActivityLogTab })));
const SupplierApisSyncTab = lazy(() => import("@/components/admin/SupplierApisSyncTab").then(m => ({ default: m.SupplierApisSyncTab })));
const StockTab = lazy(() => import("@/components/admin/StockTab").then(m => ({ default: m.StockTab })));
const InvoicesTab = lazy(() => import("@/components/admin/InvoicesTab").then(m => ({ default: m.InvoicesTab })));
const StockMovementsTab = lazy(() => import("@/components/admin/StockMovementsTab").then(m => ({ default: m.StockMovementsTab })));
const CreditTab = lazy(() => import("@/components/admin/CreditTab").then(m => ({ default: m.CreditTab })));
const QuotesAdminTab = lazy(() => import("@/components/admin/QuotesAdminTab").then(m => ({ default: m.QuotesAdminTab })));
const PurchaseOrdersTab = lazy(() => import("@/components/admin/PurchaseOrdersTab").then(m => ({ default: m.PurchaseOrdersTab })));
const UsersPermissionsTab = lazy(() => import("@/components/admin/UsersPermissionsTab").then(m => ({ default: m.UsersPermissionsTab })));
const ApprovalsTab = lazy(() => import("@/components/admin/ApprovalsTab").then(m => ({ default: m.ApprovalsTab })));
const DocumentsTab = lazy(() => import("@/components/admin/DocumentsTab").then(m => ({ default: m.DocumentsTab })));
const SupportTab = lazy(() => import("@/components/admin/SupportTab").then(m => ({ default: m.SupportTab })));
const OpportunitiesTab = lazy(() => import("@/components/admin/OpportunitiesTab").then(m => ({ default: m.OpportunitiesTab })));
const PosManagementTab = lazy(() => import("@/components/admin/PosManagementTab").then(m => ({ default: m.PosManagementTab })));
const ImageManagerTab = lazy(() => import("@/components/admin/ImageManagerTab").then(m => ({ default: m.ImageManagerTab })));
const WebhooksTab = lazy(() => import("@/components/admin/WebhooksTab").then(m => ({ default: m.WebhooksTab })));
const RmaAdminTab = lazy(() => import("@/components/admin/RmaAdminTab").then(m => ({ default: m.RmaAdminTab })));
const PriceAgreementsTab = lazy(() => import("@/components/admin/PriceAgreementsTab").then(m => ({ default: m.PriceAgreementsTab })));
const SerialsTab = lazy(() => import("@/components/admin/SerialsTab").then(m => ({ default: m.SerialsTab })));
import {
  fetchProductsForContent,
  processProductContent,
  type ContentMode,
  type ContentProcessProgress,
} from "@/lib/api/contentEnricher";

interface SupabaseOrder {
  id: string;
  client_id: string;
  products: OrderProduct[];
  total: number;
  status: string;
  order_number?: string;
  numero_remito?: string;
  shipping_provider?: string;
  tracking_number?: string;
  created_at: string;
}

interface ClientProfile {
  id: string;
  company_name: string;
  contact_name: string;
  client_type: ClientType;
  default_margin: number;
  role: string;
  phone?: string;
  active?: boolean;
  email?: string;
}

function slugifyCategoryName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type CategoryItem = { id: number; name: string; parent_id: number | null };
const POS_CATEGORY_NAME = "Punto de Venta";
const POS_CATEGORY_SLUG = "pos";

const COMPONENTS_TEMPLATE: Array<{ name: string; children: string[] }> = [
  { name: "Placa de Video", children: ["AMD", "NVIDIA", "Intel ARC"] },
  { name: "Procesadores", children: ["AMD", "Intel"] },
  { name: "Memoria Ram", children: ["DDR4", "DDR5"] },
  { name: "Motherboard", children: ["AMD (AM4 / AM5)", "Intel (LGA 1700 / LGA1851)"] },
];

function normalizeCategoryKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function buildCategoryScopedSlug(
  name: string,
  parentId: number | null,
  categories: CategoryItem[]
) {
  const ownSlug = slugifyCategoryName(name);
  if (!ownSlug) return "";
  if (!parentId) return ownSlug;

  const byId = new Map(categories.map((category) => [category.id, category]));
  const parts: string[] = [ownSlug];
  let cursor: number | null = parentId;
  let guard = 0;

  while (cursor && guard < 20) {
    const parent = byId.get(cursor);
    if (!parent) break;
    parts.unshift(slugifyCategoryName(parent.name) || String(parent.id));
    cursor = parent.parent_id ?? null;
    guard += 1;
  }

  return parts.join("-");
}

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  mayorista: "Mayorista",
  reseller:  "Revendedor",
  empresa:   "Empresa",
};

function detectApiProviderLabel(name: string | null | undefined): "AIR" | "ELIT" | null {
  const normalized = String(name ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("air") || normalized.includes("intranet")) return "AIR";
  if (normalized.includes("elit") || normalized.includes("elite")) return "ELIT";
  return null;
}

function normalizePhoneForSupabase(rawPhone: string): string {
  const digits = rawPhone.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) return `549${digits.slice(2)}`;
  if (digits.length >= 10 && digits.length <= 11) return `549${digits}`;
  return digits;
}

function LegacyStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: LucideIcon; className: string }> = {
    pending:    { label: "En revisión", icon: Clock,        className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    approved:   { label: "Aprobado",    icon: CheckCircle2, className: "bg-green-500/15 text-green-400 border-green-500/30" },
    preparing:  { label: "Preparando", icon: Package,      className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
    shipped:    { label: "Enviado",     icon: Truck,        className: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" },
    delivered:  { label: "Entregado",  icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    rejected:   { label: "Rechazado",  icon: XCircle,      className: "bg-red-500/15 text-red-400 border-red-500/30" },
    dispatched: { label: "Despachado", icon: Truck,        className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  };
  const { label, icon: Icon, className } = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${className}`}>
      <Icon size={11} /> {label}
    </span>
  );
}

type Tab = "dashboard" | "products" | "imports" | "categories" | "opportunities" | "pos" | "seller_mode" | "orders" | "kanban" | "clients" | "users_permissions" | "approvals" | "documents" | "support" | "suppliers" | "brands" | "pricing" | "reports" | "activity" | "supplier_sync" | "stock" | "invoices" | "movements" | "credit" | "quotes_admin" | "purchase_orders" | "images" | "marketing" | "rma" | "price_agreements" | "webhooks" | "serials";



const Admin = () => {
  const { signOut, session, isAdmin, canManageProducts, canManageOrders } = useAuth();
  const navigate = useNavigate();
  const { exchangeRate, setExchangeRate, fetchExchangeRate, formatPrice, formatARS, formatUSD, currency, setCurrency } = useCurrency();

  const ADMIN_THEME_KEY = "admin_theme";
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    localStorage.getItem(ADMIN_THEME_KEY) === "light" ? "light" : "dark"
  );
  const isDark = theme === "dark";
  const toggleTheme = () => {
    const next = isDark ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(ADMIN_THEME_KEY, next);
  };
  const dk = (d: string, l: string) => isDark ? d : l;

  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState(String(exchangeRate.rate));
  const [fetchingRate, setFetchingRate] = useState(false);
  const [fetchRateError, setFetchRateError] = useState("");

  async function handleFetchRate() {
    setFetchingRate(true);
    setFetchRateError("");
    try {
      await fetchExchangeRate();
    } catch {
      setFetchRateError("No se pudo obtener la cotización. Intentá de nuevo.");
    } finally {
      setFetchingRate(false);
    }
  }

  const [products, setProducts] = useState<Product[]>([]);
  const [productApiSources, setProductApiSources] = useState<Record<number, Array<"AIR" | "ELIT">>>({});
  const [orders, setOrders] = useState<SupabaseOrder[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [invoiceSearchItems, setInvoiceSearchItems] = useState<Array<{
    id: string;
    invoice_number: string;
    client_id: string;
    status: string;
    subtotal: number;
    iva_total: number;
    total: number;
    currency: "USD" | "ARS";
    exchange_rate?: number | null;
    created_at: string;
    due_date?: string;
  }>>([]);
  const [quoteSearchItems, setQuoteSearchItems] = useState<Array<{
    id: number;
    client_id: string;
    status: string;
    total: number;
  }>>([]);
  const [paymentSearchItems, setPaymentSearchItems] = useState<Array<{
    id: string;
    client_id: string;
    descripcion?: string;
    reference_id?: string;
    monto: number;
    tipo: string;
  }>>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [brands, setBrandsState] = useState<{ id: string; name: string }[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatParent, setNewCatParent] = useState("");
  const [savingCat, setSavingCat] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [categorySuccess, setCategorySuccess] = useState("");
  const [dragCategoryId, setDragCategoryId] = useState<number | null>(null);
  const [dropParentPreview, setDropParentPreview] = useState<number | "root" | null>(null);
  const [movingCategoryId, setMovingCategoryId] = useState<number | null>(null);
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<number>>(new Set());
  const [editingClients, setEditingClients] = useState<Record<string, Partial<ClientProfile>>>({});
  const [savingClient, setSavingClient] = useState<string | null>(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [confirmZeroStock, setConfirmZeroStock] = useState(false);
  const [deletingZeroStock, setDeletingZeroStock] = useState(false);
  const [newClient, setNewClient] = useState({ email: "", password: "", phone: "", company_name: "", contact_name: "", client_type: "reseller" as ClientType, default_margin: 20, role: "client" as "client" | "cliente" | "admin" | "vendedor" });
  const [creatingClient, setCreatingClient] = useState(false);
  const [createError, setCreateError] = useState("");

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    const pwd = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setNewClient((p) => ({ ...p, password: pwd }));
  }

  function downloadSampleCSV() {
    const header = "name,sku,cost_price,category,stock,stock_min,description,image,supplier_id,supplier_multiplier,featured,active,tags,external_id";
    const rows = [
      'Laptop Dell Latitude 5540,LAT5540,850000,Equipamiento,10,3,Laptop empresarial Intel i5 13va gen,https://example.com/img.jpg,,1,false,true,"laptop,dell,i5",',
      'Switch TP-Link 24 Puertos,TL-SG1024,45000,Redes,5,2,Switch no administrable Gigabit 24 puertos,,,,false,true,"switch,gigabit,tp-link",',
      'UPS 1500VA APC,SMC1500I,120000,Infraestructura,3,1,UPS línea interactiva 1500VA/900W,,,,true,true,"ups,apc,rack",SMC1500I-AR',
    ];
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "productos_ejemplo.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const [selectedOrder, setSelectedOrder] = useState<SupabaseOrder | null>(null);
  const [remitoInput, setRemitoInput] = useState("");
  const [dispatchingOrder, setDispatchingOrder] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingClients, setLoadingClients] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [productFilterCategory, setProductFilterCategory] = useState("all");
  const [productFilterBrand, setProductFilterBrand] = useState("all");
  const [productFilterStatus, setProductFilterStatus] = useState("all");
  const [productFilterSupplier, setProductFilterSupplier] = useState("all");
  const [productFilterFeatured, setProductFilterFeatured] = useState("all");
  const productFormRef = useRef<HTMLDivElement | null>(null);

  // Logistics state
  const [shippingProvider, setShippingProvider] = useState("");
  const [trackingNumber,   setTrackingNumber]   = useState("");
  const [notifyByEmail,    setNotifyByEmail]    = useState(true);
  const [savingLogistics,  setSavingLogistics]  = useState(false);

  // Realtime orders for kanban
  const { orders: rtOrders, updateStatus: rtUpdateStatus, updateLogistics: rtUpdateLogistics } = useOrdersRealtime();

  // Order tab filters + pagination
  const [filterOrderStatus, setFilterOrderStatus] = useState("all");
  const [filterOrderClient, setFilterOrderClient] = useState("all");
  const [ordersPage,        setOrdersPage]        = useState(1);
  const ORDERS_PER_PAGE = 25;

  const [contentMode, setContentMode] = useState<ContentMode>("both");
  const [contentRunning, setContentRunning] = useState(false);
  const [contentProgress, setContentProgress] = useState<ContentProcessProgress | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);

  // Single-product AI generator
  const [showSingleGen, setShowSingleGen] = useState(false);
  const [singleGenSearch, setSingleGenSearch] = useState("");
  const [singleGenResults, setSingleGenResults] = useState<{ id: number; name: string; sku: string; brand_name: string | null }[]>([]);
  const [singleGenSelected, setSingleGenSelected] = useState<{ id: number; name: string; sku: string; brand_name: string | null } | null>(null);
  const [singleGenMode, setSingleGenMode] = useState<ContentMode>("both");
  const [singleGenRunning, setSingleGenRunning] = useState(false);
  const [singleGenResult, setSingleGenResult] = useState<{ description_short?: string; description_full?: string; specs?: Record<string, string> } | null>(null);
  const [singleGenError, setSingleGenError] = useState<string | null>(null);

  async function deleteZeroStockProducts() {
    setDeletingZeroStock(true);
    await supabase.from("products").delete().eq("stock", 0);
    setConfirmZeroStock(false);
    setDeletingZeroStock(false);
    fetchProducts();
  }

  async function fetchProducts() {
    setLoadingProducts(true);
    const PAGE = 1000;
    const all: Product[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name")
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      all.push(...(data as Product[]));
      if (data.length < PAGE) break;
      from += PAGE;
    }
    if (all.length > 0) setProducts(all);
    else setProducts([]);
    await fetchProductApiSources();
    setLoadingProducts(false);
  }



  async function fetchProductApiSources() {
    const [{ data: links, error: linksError }, { data: suppliers, error: suppliersError }] = await Promise.all([
      supabase.from("product_suppliers").select("product_id, supplier_id, active"),
      supabase.from("suppliers").select("id, name"),
    ]);

    if (linksError || suppliersError || !links || !suppliers) {
      setProductApiSources({});
      return;
    }

    const providerBySupplierId = new Map<string, "AIR" | "ELIT">();
    for (const supplier of suppliers as Array<{ id: string; name: string | null }>) {
      const provider = detectApiProviderLabel(supplier.name);
      if (!provider) continue;
      providerBySupplierId.set(String(supplier.id), provider);
    }

    const grouped = new Map<number, Set<"AIR" | "ELIT">>();
    for (const link of links as Array<{ product_id: number; supplier_id: string | null; active?: boolean | null }>) {
      const supplierId = String(link.supplier_id ?? "");
      const provider = providerBySupplierId.get(supplierId) ?? detectApiProviderLabel(supplierId);
      if (!provider) continue;
      const productId = Number(link.product_id);
      if (!Number.isFinite(productId)) continue;
      const current = grouped.get(productId) ?? new Set<"AIR" | "ELIT">();
      current.add(provider);
      grouped.set(productId, current);
    }

    const next: Record<number, Array<"AIR" | "ELIT">> = {};
    for (const [productId, providers] of grouped.entries()) {
      next[productId] = Array.from(providers).sort();
    }
    setProductApiSources(next);
  }



  async function handleRunContentCompletion() {
    if (contentRunning) return;
    setContentRunning(true);
    setContentError(null);
    setContentProgress(null);
    try {
      const candidates = await fetchProductsForContent(contentMode);
      if (candidates.length === 0) {
        setContentProgress({
          done: 0,
          total: 0,
          summary: { total: 0, generated: 0, review_required: 0, skipped: 0 },
        });
        return;
      }
      const controller = new AbortController();
      const summary = await processProductContent(
        candidates,
        contentMode,
        (p) => setContentProgress(p),
        controller.signal
      );
      setContentProgress({ done: candidates.length, total: candidates.length, summary });
      await fetchProducts();
    } catch (error) {
      setContentError(error instanceof Error ? error.message : String(error));
    } finally {
      setContentRunning(false);
    }
  }

  async function searchProductsForSingleGen(q: string) {
    if (q.trim().length < 2) { setSingleGenResults([]); return; }
    const { data } = await supabase
      .from("products")
      .select("id, name, sku, brand_name")
      .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
      .eq("active", true)
      .limit(8);
    setSingleGenResults((data ?? []) as { id: number; name: string; sku: string; brand_name: string | null }[]);
  }

  async function handleSingleProductGenerate() {
    if (!singleGenSelected) return;
    setSingleGenRunning(true);
    setSingleGenError(null);
    setSingleGenResult(null);
    try {
      const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
      const res = await fetch(`${base}/api/content-enricher`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: [{ id: singleGenSelected.id, name: singleGenSelected.name, brand: singleGenSelected.brand_name, sku: singleGenSelected.sku }],
          mode: singleGenMode,
          preview: true,
        }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
      const data = await res.json() as { ok: boolean; previews?: { id: number; description_short?: string; description_full?: string; specs?: Record<string, string> }[] };
      if (data.previews?.[0]) setSingleGenResult(data.previews[0]);
      else throw new Error("Sin respuesta del generador");
    } catch (e) {
      setSingleGenError(e instanceof Error ? e.message : String(e));
    }
    setSingleGenRunning(false);
  }

  async function applySingleGenResult() {
    if (!singleGenSelected || !singleGenResult) return;
    const update: Record<string, unknown> = {};
    if (singleGenResult.description_short) update.description_short = singleGenResult.description_short;
    if (singleGenResult.description_full)  update.description_full  = singleGenResult.description_full;
    if (singleGenResult.specs)             update.specs             = singleGenResult.specs;
    await supabase.from("products").update(update).eq("id", singleGenSelected.id);
    setProducts(prev => prev.map(p => p.id === singleGenSelected.id ? { ...p, ...update } : p));
    setSingleGenResult(null);
    setSingleGenSelected(null);
    setSingleGenSearch("");
    setSingleGenResults([]);
    setShowSingleGen(false);
  }

  async function fetchOrders() {
    setLoadingOrders(true);
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (data) setOrders(data as SupabaseOrder[]);
    setLoadingOrders(false);
  }

  async function fetchClients() {
    setLoadingClients(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, company_name, contact_name, client_type, default_margin, role, phone, active, email")
      .order("company_name");
    if (data) setClients(data as ClientProfile[]);
    setLoadingClients(false);
  }

  async function fetchCategories() {
    await supabase
      .from("categories")
      .upsert(
        { name: POS_CATEGORY_NAME, slug: POS_CATEGORY_SLUG, active: true, parent_id: null },
        { onConflict: "slug", ignoreDuplicates: false }
      );
    const { data } = await supabase.from("categories").select("*").order("parent_id", { ascending: true }).order("name");
    if (data) setCategories(data as CategoryItem[]);
  }

  async function fetchBrandsState() {
    const { data } = await supabase.from("brands").select("id, name").eq("active", true).order("name");
    if (data) setBrandsState(data as { id: string; name: string }[]);
  }

  async function fetchInvoiceSearchItems() {
    const { data } = await supabase
      .from("invoices")
      .select("id, invoice_number, client_id, status, subtotal, iva_total, total, currency, exchange_rate, created_at, due_date")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) {
      setInvoiceSearchItems(data as Array<{
        id: string;
        invoice_number: string;
        client_id: string;
        status: string;
        subtotal: number;
        iva_total: number;
        total: number;
        currency: "USD" | "ARS";
        exchange_rate?: number | null;
        created_at: string;
        due_date?: string;
      }>);
    }
  }

  async function fetchQuoteSearchItems() {
    const { data } = await supabase
      .from("quotes")
      .select("id, client_id, status, total")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) {
      setQuoteSearchItems(data as Array<{
        id: number;
        client_id: string;
        status: string;
        total: number;
      }>);
    }
  }

  async function fetchPaymentSearchItems() {
    const { data } = await supabase
      .from("account_movements")
      .select("id, client_id, descripcion, reference_id, monto, tipo")
      .eq("tipo", "pago")
      .order("fecha", { ascending: false })
      .limit(100);
    if (data) {
      setPaymentSearchItems(data as Array<{
        id: string;
        client_id: string;
        descripcion?: string;
        reference_id?: string;
        monto: number;
        tipo: string;
      }>);
    }
  }

  useEffect(() => {
    fetchProducts();
    fetchOrders();
    fetchClients();
    fetchCategories();
    fetchBrandsState();
    fetchInvoiceSearchItems();
    fetchQuoteSearchItems();
    fetchPaymentSearchItems();
  }, []);

  useEffect(() => {
    if (selectedOrder) {
      setShippingProvider(selectedOrder.shipping_provider || "");
      setTrackingNumber(selectedOrder.tracking_number || "");
    }
  }, [selectedOrder]);

  async function handleSaveLogistics() {
    if (!selectedOrder) return;
    setSavingLogistics(true);
    try {
      await rtUpdateLogistics(selectedOrder.id, shippingProvider, trackingNumber);
      
      if (notifyByEmail) {
        const client = clients.find(c => c.id === selectedOrder.client_id);
        if (client?.email) {
          await fetch("/api/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "order_shipped",
              orderId: selectedOrder.id,
              orderNumber: selectedOrder.order_number || `#${String(selectedOrder.id).slice(-8)}`,
              clientId: selectedOrder.client_id,
              clientEmail: client.email,
              clientName: client.company_name || client.contact_name,
              products: selectedOrder.products,
              total: selectedOrder.total,
              shippingProvider,
              trackingNumber,
            }),
          });
        }
      }

      // Update local state if needed (realtime might handle it, but for safety:)
      setSelectedOrder(prev => prev ? { ...prev, shipping_provider: shippingProvider, tracking_number: trackingNumber } : null);
    } catch (err) {
       console.error("Error saving logistics:", err);
    } finally {
      setSavingLogistics(false);
    }
  }

  useEffect(() => {
    const validIds = new Set(categories.map((category) => category.id));
    setCollapsedCategoryIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [categories]);

  const categoryChildrenByParent = categories.reduce<Map<number | null, CategoryItem[]>>((acc, category) => {
    const key = category.parent_id ?? null;
    const list = acc.get(key) ?? [];
    list.push(category);
    acc.set(key, list);
    return acc;
  }, new Map<number | null, CategoryItem[]>());

  for (const list of categoryChildrenByParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  const categoryParentOptions: Array<{ id: number; label: string; depth: number }> = [];
  const walkCategoryOptions = (parentId: number | null, depth: number) => {
    const nodes = categoryChildrenByParent.get(parentId) ?? [];
    nodes.forEach((node) => {
      categoryParentOptions.push({
        id: node.id,
        depth,
        label: `${"  ".repeat(depth)}${depth > 0 ? "↳ " : ""}${node.name}`,
      });
      walkCategoryOptions(node.id, depth + 1);
    });
  };
  walkCategoryOptions(null, 0);

  const rootCategoryNodes = categoryChildrenByParent.get(null) ?? [];
  const rootCategoryWithChildrenIds = rootCategoryNodes
    .filter((node) => (categoryChildrenByParent.get(node.id)?.length ?? 0) > 0)
    .map((node) => node.id);
  const showLegacyCategoryBlock = false;
  const collapsedRootCount = rootCategoryWithChildrenIds.filter((id) => collapsedCategoryIds.has(id)).length;

  function toggleCategoryCollapsed(id: number) {
    setCollapsedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function collapseRootCategories() {
    setCollapsedCategoryIds((prev) => {
      const next = new Set(prev);
      rootCategoryWithChildrenIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function expandRootCategories() {
    setCollapsedCategoryIds((prev) => {
      const next = new Set(prev);
      rootCategoryWithChildrenIds.forEach((id) => next.delete(id));
      return next;
    });
  }

  function findCategoryByNameAndParent(
    list: CategoryItem[],
    name: string,
    parentId: number | null
  ): CategoryItem | null {
    const target = normalizeCategoryKey(name);
    return list.find((category) =>
      category.parent_id === parentId &&
      normalizeCategoryKey(category.name) === target
    ) ?? null;
  }

  async function ensureCategoryNode(
    list: CategoryItem[],
    name: string,
    parentId: number | null
  ): Promise<{ node: CategoryItem; created: boolean }> {
    const existing = findCategoryByNameAndParent(list, name, parentId);
    if (existing) {
      return { node: existing, created: false };
    }

    const slug = buildCategoryScopedSlug(name, parentId, list);
    if (!slug) {
      throw new Error(`Nombre de categoria invalido: ${name}`);
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: name.trim(),
        slug,
        active: true,
        parent_id: parentId,
      })
      .select("id, name, parent_id")
      .single();

    if (error || !data) {
      throw new Error(error?.message || `No se pudo crear la categoria ${name}`);
    }

    const createdNode = data as CategoryItem;
    list.push(createdNode);
    return { node: createdNode, created: true };
  }

  async function addCategory() {
    const trimmedName = newCatName.trim();
    if (!trimmedName) return;

    const parentId = newCatParent ? Number(newCatParent) : null;
    const slug = buildCategoryScopedSlug(trimmedName, parentId, categories);
    if (!slug) {
      setCategoryError("Ingresá un nombre de categoría válido.");
      setCategorySuccess("");
      return;
    }

    setSavingCat(true);
    setCategoryError("");
    setCategorySuccess("");

    const { error } = await supabase
      .from("categories")
      .insert({
        name: trimmedName,
        slug,
        active: true,
        parent_id: parentId,
      });

    if (error) {
      const duplicateError = error.code === "23505";
      setCategoryError(
        duplicateError
          ? "Ya existe una categoría con ese nombre o slug."
          : `No se pudo crear la categoría: ${error.message}`
      );
      setSavingCat(false);
      return;
    }

    setNewCatName("");
    setNewCatParent("");
    setCategorySuccess("Categoría creada correctamente.");
    setSavingCat(false);
    fetchCategories();
  }

  async function addComponentsTemplate() {
    setSavingCat(true);
    setCategoryError("");
    setCategorySuccess("");

    try {
      const working = [...categories];
      let createdCount = 0;

      const rootResult = await ensureCategoryNode(working, "Componentes", null);
      if (rootResult.created) createdCount += 1;
      const rootId = rootResult.node.id;

      for (const branch of COMPONENTS_TEMPLATE) {
        const branchResult = await ensureCategoryNode(working, branch.name, rootId);
        if (branchResult.created) createdCount += 1;
        const branchId = branchResult.node.id;

        for (const childName of branch.children) {
          const leafResult = await ensureCategoryNode(working, childName, branchId);
          if (leafResult.created) createdCount += 1;
        }
      }

      await fetchCategories();
      setCategorySuccess(
        createdCount > 0
          ? `Plantilla Componentes aplicada (${createdCount} categorias nuevas).`
          : "La plantilla Componentes ya estaba cargada."
      );
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingCat(false);
    }
  }

  async function deleteCategory(id: number) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    await supabase.from("categories").delete().eq("id", id);
    fetchCategories();
  }

  function collectDescendantIds(categoryId: number): Set<number> {
    const out = new Set<number>();
    const stack = [categoryId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      const children = categoryChildrenByParent.get(current) ?? [];
      for (const child of children) {
        if (!out.has(child.id)) {
          out.add(child.id);
          stack.push(child.id);
        }
      }
    }
    return out;
  }

  function canDropCategory(dragId: number, targetParentId: number | null): boolean {
    if (dragId === targetParentId) return false;
    if (targetParentId === null) return true;
    const descendants = collectDescendantIds(dragId);
    return !descendants.has(targetParentId);
  }

  async function moveCategory(dragId: number, targetParentId: number | null) {
    if (!canDropCategory(dragId, targetParentId)) {
      setCategoryError("Movimiento no valido: no podes mover una categoria dentro de si misma.");
      setCategorySuccess("");
      return;
    }

    const current = categories.find((category) => category.id === dragId);
    if (!current) return;
    if ((current.parent_id ?? null) === targetParentId) return;

    setMovingCategoryId(dragId);
    setCategoryError("");
    setCategorySuccess("");

    const { error } = await supabase
      .from("categories")
      .update({ parent_id: targetParentId })
      .eq("id", dragId);

    setMovingCategoryId(null);
    setDropParentPreview(null);
    setDragCategoryId(null);

    if (error) {
      setCategoryError(`No se pudo mover la categoria: ${error.message}`);
      return;
    }

    setCategorySuccess("Categoria movida correctamente.");
    await fetchCategories();
  }

  function renderCategoryNode(node: CategoryItem, depth = 0): JSX.Element {
    const children = categoryChildrenByParent.get(node.id) ?? [];
    const hasChildren = children.length > 0;
    const isCollapsed = collapsedCategoryIds.has(node.id);
    const isDragging = dragCategoryId === node.id;
    const isDropTarget = dropParentPreview === node.id && dragCategoryId !== null;
    const canDropHere = dragCategoryId !== null && canDropCategory(dragCategoryId, node.id);
    const isMoving = movingCategoryId === node.id;
    return (
      <div
        key={node.id}
        draggable
        onDragStart={(event) => {
          event.stopPropagation();
          setDragCategoryId(node.id);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", String(node.id));
        }}
        onDragEnd={(event) => {
          event.stopPropagation();
          setDragCategoryId(null);
          setDropParentPreview(null);
        }}
        onDragOver={(event) => {
          event.stopPropagation();
          if (!canDropHere) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDropParentPreview(node.id);
        }}
        onDragLeave={(event) => {
          event.stopPropagation();
          if (dropParentPreview === node.id) {
            setDropParentPreview(null);
          }
        }}
        onDrop={(event) => {
          event.stopPropagation();
          event.preventDefault();
          const incoming = Number(event.dataTransfer.getData("text/plain") || dragCategoryId);
          if (!Number.isFinite(incoming) || !canDropCategory(incoming, node.id)) return;
          void moveCategory(incoming, node.id);
        }}
        className={`border rounded-lg p-3 transition ${
          isDropTarget
            ? "border-[#2D9F6A] ring-1 ring-[#2D9F6A]/40"
            : dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-[#f5f5f5] border-[#e5e5e5]")
        } ${isDragging ? "opacity-50" : ""}`}
        style={{ marginLeft: `${depth * 14}px` }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                draggable={false}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleCategoryCollapsed(node.id);
                }}
                className={`h-5 w-5 rounded border text-[11px] font-bold leading-none grid place-items-center transition ${
                  dk(
                    "border-[#2a2a2a] text-gray-300 hover:bg-[#1a1a1a]",
                    "border-[#d4d4d4] text-[#525252] hover:bg-[#f0f0f0]"
                  )
                }`}
                title={isCollapsed ? "Expandir subcategorias" : "Comprimir subcategorias"}
              >
                {isCollapsed ? "+" : "-"}
              </button>
            ) : (
              <span className="h-5 w-5" />
            )}
            <span className={`text-sm font-semibold cursor-grab active:cursor-grabbing truncate ${dk("text-white", "text-[#171717]")}`}>
            {depth > 0 ? `↳ ${node.name}` : node.name}
            </span>
          </div>
          <button
            onClick={() => deleteCategory(node.id)}
            className="text-gray-500 hover:text-red-400 transition"
            title="Eliminar categoria"
          >
            <Trash2 size={12} />
          </button>
        </div>
        {isDropTarget && (
          <p className={`mt-1 text-[11px] ${dk("text-[#9edfbf]", "text-[#1f7a53]")}`}>
            Solta aca para convertirla en subcategoria de {node.name}.
          </p>
        )}
        {isMoving && (
          <p className={`mt-1 text-[11px] ${dk("text-blue-300", "text-blue-600")}`}>
            Moviendo...
          </p>
        )}
        {hasChildren && isCollapsed && (
          <p className={`mt-1 text-[11px] ${dk("text-gray-500", "text-[#737373]")}`}>
            {children.length} subcategoria{children.length !== 1 ? "s" : ""} comprimida{children.length !== 1 ? "s" : ""}.
          </p>
        )}
        {hasChildren && !isCollapsed && (
          <div className="mt-2 space-y-2">
            {children.map((child) => renderCategoryNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  const pendingOrders = orders.filter((o) => o.status === "pending").length;

// -- Crear cliente --
// Uses a server-side API endpoint (service role key) so the admin's session
// is never replaced by the newly created user's session.
async function handleCreateClient() {
  try {
    setCreateError("");

    const email = newClient.email.trim().toLowerCase();
    const password = newClient.password;
    const phone = normalizePhoneForSupabase(newClient.phone.trim());

    if (!email || !password) {
      setCreateError("Email y contraseña son obligatorios.");
      return;
    }

    if (phone && phone.replace(/\D/g, "").length < 10) {
      setCreateError("Si se ingresa un celular, debe incluir código de área y número (ej: 3411234567).");
      return;
    }

    setCreatingClient(true);

    // Get current admin session token to authenticate the request
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setCreateError("Sesión expirada. Volvé a iniciar sesión.");
      return;
    }

    const response = await fetch("/api/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        email,
        password,
        company_name: newClient.company_name,
        contact_name: newClient.contact_name,
        client_type: newClient.client_type,
        default_margin: Number(newClient.default_margin) || 20,
        role: newClient.role || "client",
        phone,
      }),
    });

    const result = await response.json() as { ok: boolean; error?: string };

    if (!response.ok || !result.ok) {
      const msg = result.error ?? "Error al crear el usuario.";
      if (response.status === 409) {
        setCreateError("El email ya está registrado.");
      } else {
        setCreateError(msg);
      }
      return;
    }

    // Reset UI
    setShowNewClient(false);
    setNewClient({
      email: "",
      password: "",
      phone: "",
      company_name: "",
      contact_name: "",
      client_type: "reseller",
      default_margin: 20,
      role: "client",
    });

    fetchClients();

  } catch (err: unknown) {
    console.error("Error inesperado:", err);
    setCreateError("Error inesperado al crear el cliente.");
  } finally {
    setCreatingClient(false);
  }
}
  // -- Clientes --
  function startEdit(client: ClientProfile) {
    setEditingClients((prev) => ({
      ...prev,
      [client.id]: { client_type: client.client_type, default_margin: client.default_margin },
    }));
  }

  function updateEdit<K extends keyof ClientProfile>(id: string, field: K, value: ClientProfile[K]) {
    setEditingClients((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function applyTypeMargin(id: string, type: ClientType) {
    setEditingClients((prev) => ({
      ...prev,
      [id]: { ...prev[id], client_type: type, default_margin: CLIENT_TYPE_MARGINS[type] },
    }));
  }

  async function saveClient(id: string) {
    const edits = editingClients[id];
    if (!edits) return;
    setSavingClient(id);
    const { error } = await supabase.from("profiles").update(edits).eq("id", id);
    setSavingClient(null);
    if (!error) {
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...edits } : c)));
      setEditingClients((prev) => { const { [id]: _, ...rest } = prev; return rest; });
    }
  }

  async function saveClientFields(id: string, changes: { client_type?: ClientType; default_margin?: number }) {
    await supabase.from("profiles").update(changes).eq("id", id);
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)));
  }

  // -- Productos --
  async function deleteProduct(id: number) {
    if (!confirm("¿Eliminar este producto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  async function toggleActive(product: Product) {
    const { error } = await supabase
      .from("products")
      .update({ active: !product.active })
      .eq("id", product.id);
    if (!error) fetchProducts();
  }

  // -- Órdenes --
  async function updateOrderStatus(
    orderId: string,
    status: "approved" | "rejected",
    opts?: { note?: string; approverLabel?: string; ruleReasons?: string[]; requiresException?: boolean }
  ) {
    const previous = orders.find((order) => String(order.id) === String(orderId));
    const { error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (!error) {
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder((o) => o ? { ...o, status } : o);
      logActivity({
        user_id: userId,
        action: "order_status_change",
        entity_type: "order",
        entity_id: orderId,
        metadata: {
          previous_status: previous?.status,
          status,
          approver: opts?.approverLabel ?? session?.user.email ?? "admin",
          note: opts?.note ?? null,
          approval_reasons: opts?.ruleReasons ?? [],
          requires_exception: opts?.requiresException ?? false,
        },
      });
    }
  }

  async function sendOrderStatusEmail(orderId: string, status: "order_shipped" | "order_delivered") {
    const order = orders.find((o) => String(o.id) === String(orderId));
    if (!order) return;
    const client = clients.find((c) => c.id === order.client_id);
    if (!client?.email) return;
    try {
      await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: status,
          orderId: order.id,
          orderNumber: order.order_number || `#${String(order.id).slice(-8)}`,
          clientId: order.client_id,
          clientEmail: client.email,
          clientName: client.company_name || client.contact_name,
          products: order.products,
          total: order.total,
        }),
      });
    } catch { /* non-blocking */ }
  }

  async function dispatchOrder(orderId: string, numeroRemito: string) {
    if (!numeroRemito.trim()) return;
    setDispatchingOrder(true);
    const { error } = await supabase
      .from("orders")
      .update({ status: "dispatched", numero_remito: numeroRemito.trim(), updated_at: new Date().toISOString() })
      .eq("id", orderId);
    setDispatchingOrder(false);
    if (!error) {
      const updated = { status: "dispatched", numero_remito: numeroRemito.trim() };
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, ...updated } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder((o) => o ? { ...o, ...updated } : o);
      setRemitoInput("");
      sendOrderStatusEmail(orderId, "order_shipped");
    }
  }

  async function updateOrderStatusKanban(orderId: string, newStatus: KanbanStatus) {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", orderId);
    if (!error) {
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder((o) => o ? { ...o, status: newStatus } : o);
      logActivity({ user_id: userId, action: "order_status_change", entity_type: "order", entity_id: orderId, metadata: { status: newStatus } });
      if (newStatus === "shipped" || newStatus === "dispatched") sendOrderStatusEmail(orderId, "order_shipped");
      if (newStatus === "delivered") sendOrderStatusEmail(orderId, "order_delivered");
    }
  }

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  const userId = session?.user?.id;
  const categoryNames = categories.map((c) => c.name);

  // Kanban uses realtime hook; wrap to also log activity
  async function handleKanbanStatus(orderId: string, newStatus: KanbanStatus) {
    await rtUpdateStatus(orderId, newStatus);
    logActivity({ user_id: userId, action: "order_status_change", entity_type: "order", entity_id: orderId, metadata: { status: newStatus } });
    if (newStatus === "shipped" || newStatus === "dispatched") {
      const order = rtOrders.find((o) => o.id === orderId);
      // client_name holds the raw client_id value (see useOrdersRealtime rowToKanban mapper)
      const client = order ? clients.find((c) => c.id === order.client_name) : undefined;
      if (order && client) {
        void whatsappNotifications.notifyOrderShipped(order, client);
      }
    }
  }

  const lowStockCount = products.filter((p) => p.stock <= 3 && p.active !== false).length;
  const groupedPendingSuggestions = []; // Cleaned up logic results in empty group



  // -- Sidebar groups ----------------------------------------------------------
  type SidebarGroup = {
    id: string;
    label: string;
    icon: LucideIcon;
    items: { id: Tab; label: string; icon: LucideIcon; badge?: number; adminOnly?: boolean; manageProducts?: boolean; manageOrders?: boolean }[];
  };

  const sidebarGroups: SidebarGroup[] = [
    {
      id: "top", label: "", icon: LayoutDashboard,
      items: [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      ],
    },
    {
      id: "catalogo", label: "Catálogo", icon: Package,
      items: [
        { id: "products",      label: "Productos",     icon: Package,    badge: products.length, manageProducts: true },
        { id: "imports",       label: "Importaciones", icon: Download,   manageProducts: true },
        { id: "categories",    label: "Categorías",    icon: Tag,        manageProducts: true },
        { id: "images",        label: "Imágenes",      icon: Image,      manageProducts: true },
        { id: "opportunities", label: "Oportunidades", icon: Flame,      manageProducts: true },
        { id: "pos",           label: "POS",           icon: Truck,      manageProducts: true },
        { id: "seller_mode",   label: "Modo Vendedor", icon: DollarSign, manageProducts: true },
      ],
    },
    {
      id: "pedidos", label: "Pedidos", icon: ClipboardList,
      items: [
        { id: "orders",       label: "Pedidos",      icon: ClipboardList, badge: pendingOrders || undefined, manageOrders: true },
        { id: "kanban",       label: "Kanban",       icon: Layers,        manageOrders: true },
        { id: "approvals",    label: "Aprobaciones", icon: CheckCircle2,  manageOrders: true },
        { id: "quotes_admin", label: "Cotizaciones", icon: MessageSquare, adminOnly: true },
      ],
    },
    {
      id: "clientes", label: "Clientes", icon: Users,
      items: [
        { id: "clients",           label: "Clientes", icon: Users,      badge: clients.length, adminOnly: true },
        { id: "users_permissions", label: "Accesos",  icon: UserPlus,   adminOnly: true },
        { id: "credit",            label: "Crédito",  icon: CreditCard, adminOnly: true },
      ],
    },
    {
      id: "finanzas", label: "Finanzas", icon: FileText,
      items: [
        { id: "invoices",  label: "Facturas",   icon: FileText,  adminOnly: true },
        { id: "documents", label: "Documentos", icon: FileText,  adminOnly: true },
        { id: "reports",   label: "Reportes",   icon: BarChart2, adminOnly: true, badge: lowStockCount || undefined },
      ],
    },
    {
      id: "sistema", label: "Sistema", icon: Activity,
      items: [
        { id: "suppliers",       label: "Proveedores",    icon: Building2,    adminOnly: true },
        { id: "brands",          label: "Marcas",         icon: Bookmark,     adminOnly: true },
        { id: "pricing",         label: "Precios",        icon: Tag,          adminOnly: true },
        { id: "supplier_sync",   label: "Sync",           icon: Wifi,         adminOnly: true },

        { id: "stock",           label: "Stock",          icon: Layers,       adminOnly: true },
        { id: "serials",         label: "Números Serie",  icon: ShieldCheck,  adminOnly: true },
        { id: "movements",       label: "Movimientos",    icon: History,      adminOnly: true },
        { id: "purchase_orders",  label: "Órdenes Compra",   icon: ShoppingBag,  adminOnly: true },
        { id: "rma",              label: "Devoluciones",     icon: RotateCcw,    adminOnly: true },
        { id: "price_agreements", label: "Acuerdos Precio",  icon: Handshake,    adminOnly: true },
        { id: "support",          label: "Soporte",          icon: LifeBuoy,     adminOnly: true },
        { id: "marketing",       label: "Marketing",      icon: Ticket,       adminOnly: true },
        { id: "webhooks",        label: "Webhooks",       icon: Globe,        adminOnly: true },
        { id: "activity",        label: "Actividad",      icon: Activity,     adminOnly: true },
      ],
    },
  ];

  const SIDEBAR_COLLAPSE_KEY = "admin_sidebar_collapsed";
  const SIDEBAR_GROUPS_KEY   = "admin_sidebar_groups";

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
    localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === "true"
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_GROUPS_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch { return new Set<string>(); }
  });
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  function toggleSidebar() {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem(SIDEBAR_COLLAPSE_KEY, String(next));
  }

  function toggleGroup(gid: string) {
    setCollapsedGroups((prev) => {
      const next = toggleSetValue(prev, gid);
      localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function canSeeItem(item: SidebarGroup["items"][number]) {
    if (item.adminOnly) return isAdmin;
    if (item.manageProducts) return canManageProducts;
    if (item.manageOrders) return canManageOrders;
    return true;
  }

  async function handleExportAdminCatalogPdf() {
    await exportCatalogPdf(products, formatPrice, currency);
  }

  async function handleExportRemitoPdf() {
    if (!selectedOrder) return;
    const client = clients.find((c) => c.id === selectedOrder.client_id);
    const clientName = client ? (client.company_name || client.contact_name || client.id) : "";
    await exportRemitoPdf(selectedOrder, clientName, formatPrice);
  }

  function SidebarContent({ mobile = false }: { mobile?: boolean }) {
    return (
      <nav className="flex flex-col h-full overflow-y-auto py-3 gap-0.5">
        {sidebarGroups.map((group) => {
          const visibleItems = group.items.filter(canSeeItem);
          if (visibleItems.length === 0) return null;
          const isGroupCollapsed = collapsedGroups.has(group.id);
          const GIcon = group.icon;
          const hasActiveBadge = visibleItems.some((i) => i.badge && i.badge > 0);

          return (
            <div key={group.id} className="px-2">
              {/* Group header — hidden for headerless groups (label === "") */}
              {(!sidebarCollapsed || mobile) && group.label !== "" && (
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition mb-0.5 ${dk("text-[#444] hover:text-[#666]","text-[#c4c4c4] hover:text-[#a3a3a3]")}`}
                >
                  <div className="flex items-center gap-1.5">
                    <GIcon size={11} />
                    {group.label}
                    {hasActiveBadge && <span className="h-1.5 w-1.5 rounded-full bg-[#2D9F6A]" />}
                  </div>
                  <span className={`transition-transform ${isGroupCollapsed ? "" : "rotate-180"}`}>
                    ▾
                  </span>
                </button>
              )}

              {/* Group items */}
              {(!isGroupCollapsed || sidebarCollapsed) && (
                <div className={`space-y-0.5 ${sidebarCollapsed && !mobile ? "mb-2" : "mb-1"}`}>
                  {visibleItems.map(({ id, label, icon: Icon, badge }) => {
                    const active = activeTab === id;
                    return (
                      <button
                        key={id}
                        onClick={() => { setActiveTab(id); if (mobile) setMobileSidebarOpen(false); }}
                        title={sidebarCollapsed && !mobile ? label : undefined}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition ${
                          active
                            ? dk("bg-[#1a2e22] text-[#2D9F6A] font-semibold","bg-[#f0faf5] text-[#1a7a50] font-semibold")
                            : dk("text-[#737373] hover:text-white hover:bg-[#181818]","text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5]")
                        }`}
                      >
                        <Icon size={14} className={active ? "text-[#2D9F6A]" : ""} />
                        {(!sidebarCollapsed || mobile) && (
                          <>
                            <span className="flex-1 text-left truncate">{label}</span>
                            {badge !== undefined && badge > 0 && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                id === "orders"
                                  ? "bg-[#2D9F6A] text-white"
                                  : dk("bg-[#222] text-[#525252]","bg-[#e8e8e8] text-[#737373]")
                              }`}>
                                {badge}
                              </span>
                            )}
                          </>
                        )}
                        {sidebarCollapsed && !mobile && badge !== undefined && badge > 0 && (
                          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#2D9F6A]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {(!sidebarCollapsed || mobile) && group.label !== "" && (
                <div className={`h-px mx-2 my-1 ${dk("bg-[#1f1f1f]","bg-[#f0f0f0]")}`} />
              )}
            </div>
          );
        })}
      </nav>
    );
  }

  return (
    <div className={`flex min-h-screen flex-col ${dk("bg-[#0a0a0a]", "bg-[#f0f0f0]")}`}>

      {/* TOPBAR */}
      <header className={`flex items-center gap-2 px-3 md:px-4 py-2.5 border-b z-30 relative ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-white border-[#e5e5e5]")}`}>
        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileSidebarOpen((o) => !o)}
          className={`md:hidden p-2 rounded-lg transition ${dk("text-[#525252] hover:text-white hover:bg-[#1c1c1c]","text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]")}`}
        >
          <LayoutDashboard size={16} />
        </button>

        <div className="flex items-center gap-2">
          <img src="/icon.png" alt="Bartez" className="h-7 w-7 object-contain" />
          <div className="hidden sm:block">
            <span className={`font-bold text-sm leading-none ${dk("text-white", "text-[#171717]")}`}>Panel Admin</span>
            <span className="block text-[10px] text-[#2D9F6A] leading-none mt-0.5">Bartez Tecnología</span>
          </div>
        </div>

        {/* Active tab breadcrumb */}
        <span className={`text-xs font-semibold hidden md:block ml-2 ${dk("text-[#525252]","text-[#a3a3a3]")}`}>
          / {sidebarGroups.flatMap((g) => g.items).find((i) => i.id === activeTab)?.label ?? ""}
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Quick-access: Marketing */}
          <button
            onClick={() => setActiveTab("marketing")}
            title="Marketing B2B"
            className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition ${
              activeTab === "marketing"
                ? "bg-[#2D9F6A]/15 border-[#2D9F6A]/40 text-[#2D9F6A]"
                : dk("border-[#1f1f1f] text-[#525252] hover:text-white hover:bg-[#1c1c1c]", "border-[#e5e5e5] text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]")
            }`}
          >
            <Ticket size={12} /> <span className="hidden lg:inline font-semibold">Marketing</span>
          </button>

          <div className={`hidden sm:flex items-center rounded-lg border p-0.5 ${dk("border-[#1f1f1f] bg-[#111]", "border-[#e5e5e5] bg-[#f8f8f8]")}`}>
            {(["USD", "ARS"] as const).map((option) => {
              const active = currency === option;
              return (
                <button
                  key={option}
                  onClick={() => setCurrency(option)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition ${
                    active
                      ? "bg-[#2D9F6A] text-white"
                      : dk("text-[#737373] hover:text-white hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] hover:bg-white")
                  }`}
                  title={`Ver importes principales en ${option}`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <AdminSearch
            isDark={isDark}
            products={products}
            clients={clients}
            orders={orders}
            invoices={invoiceSearchItems}
            quotes={quoteSearchItems}
            payments={paymentSearchItems}
            onNavigate={(tab) => setActiveTab(tab as Tab)}
          />
          <button
            onClick={() => {
              fetchProducts();
              fetchOrders();
              fetchClients();
              fetchInvoiceSearchItems();
              fetchQuoteSearchItems();
              fetchPaymentSearchItems();
            }}
            className={`flex items-center gap-1.5 text-xs transition px-2.5 py-1.5 rounded-lg ${dk("text-[#737373] hover:text-white hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]")}`}
          >
            <RefreshCw size={12} /> <span className="hidden sm:inline">Actualizar</span>
          </button>
          <NotificationBell isDark={isDark} />
          <button
            onClick={toggleTheme}
            className={`p-1.5 rounded-lg transition ${dk("text-[#525252] hover:text-white hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]")}`}
            title={isDark ? "Tema claro" : "Tema oscuro"}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-1.5 text-xs transition px-2.5 py-1.5 rounded-lg ${dk("text-[#737373] hover:text-white hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] hover:bg-[#e8e8e8]")}`}
          >
            <LogOut size={12} /> <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* BODY: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Mobile overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-20 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* SIDEBAR */}
        <aside className={`
          hidden md:flex flex-col shrink-0 border-r overflow-hidden transition-all duration-200
          ${sidebarCollapsed ? "w-[52px]" : "w-[200px]"}
          ${dk("bg-[#0d0d0d] border-[#1a1a1a]","bg-white border-[#e5e5e5]")}
        `}>
          <SidebarContent />
          {/* Collapse toggle */}
          <button
            onClick={toggleSidebar}
            className={`flex items-center justify-center py-3 border-t text-xs transition ${dk("border-[#1a1a1a] text-[#444] hover:text-white hover:bg-[#141414]","border-[#e5e5e5] text-[#c4c4c4] hover:text-[#171717] hover:bg-[#f5f5f5]")}`}
            title={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {sidebarCollapsed ? "→" : "←"}
          </button>
        </aside>

        {/* Mobile drawer */}
        <aside className={`
          fixed left-0 top-0 h-full w-[220px] z-30 md:hidden flex flex-col border-r transition-transform duration-200
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          ${dk("bg-[#0d0d0d] border-[#1a1a1a]","bg-white border-[#e5e5e5]")}
        `}>
          <div className={`flex items-center gap-2 px-4 py-3 border-b ${dk("border-[#1a1a1a]","border-[#e5e5e5]")}`}>
            <img src="/icon.png" alt="Bartez" className="h-7 w-7 object-contain" />
            <div>
              <span className={`font-bold text-sm leading-none ${dk("text-white","text-[#171717]")}`}>Admin</span>
              <span className="block text-[10px] text-[#2D9F6A]">Bartez</span>
            </div>
          </div>
          <SidebarContent mobile />
        </aside>

      <main className="flex-1 p-4 md:p-5 overflow-y-auto min-w-0">
      <ErrorBoundary section={activeTab}>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-[400px]">
             <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2D9F6A] border-t-transparent" />
          </div>
        }>

        {/* -- DASHBOARD -- */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <B2BInsights 
              clients={clients.map(c => ({
                ...c,
                total_orders: orders.filter(o => o.client_id === c.id).length,
                last_order_date: orders.filter(o => o.client_id === c.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at
              }))} 
              orders={orders} 
              isDark={isDark} 
              onNavigate={(tab) => setActiveTab(tab as Tab)} 
            />
            <SalesDashboard orders={orders} clients={clients} isDark={isDark} onRefreshOrders={fetchOrders} />
          </div>
        )}

        {/* -- PRODUCTOS -- */}
        {activeTab === "products" && (
          <div className="space-y-4 w-full max-w-none">
            {/* Header: stats + actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4 flex-wrap">
                <span className={`text-xs ${dk("text-gray-400", "text-[#737373]")}`}>
                  📦 <strong className={dk("text-white", "text-[#171717]")}>{products.length}</strong> productos
                </span>
                {lowStockCount > 0 && (
                  <span className="text-xs font-semibold text-amber-400">
                    ⚠️ {lowStockCount} bajo stock
                  </span>
                )}
                <span className={`text-xs ${dk("text-gray-400", "text-[#737373]")}`}>
                  🔥 <strong className={dk("text-white", "text-[#171717]")}>{products.filter((p) => p.featured).length}</strong> destacados
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setActiveTab("imports")}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#2D9F6A] hover:bg-[#25835A] text-white font-semibold transition"
                >
                  <Plus size={12} /> Agregar / Importar
                </button>
                {products.length > 0 && (
                  <>
                    <button
                      onClick={() => exportCatalogCSV(products)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${dk("text-[#737373] hover:text-white border-[#262626] hover:border-[#333] bg-[#111] hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] border-[#e5e5e5] hover:border-[#d4d4d4] bg-white hover:bg-[#f5f5f5]")}`}
                    >
                      <Download size={11} /> CSV
                    </button>
                    <button
                      onClick={() => { void handleExportAdminCatalogPdf(); }}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${dk("text-[#737373] hover:text-white border-[#262626] hover:border-[#333] bg-[#111] hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] border-[#e5e5e5] hover:border-[#d4d4d4] bg-white hover:bg-[#f5f5f5]")}`}
                    >
                      <Download size={11} /> PDF
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Product table */}
            {loadingProducts ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={`h-10 ${dk("bg-[#111]", "bg-[#e8e8e8]")} rounded-lg animate-pulse`} />
                ))}
              </div>
            ) : (
              <ProductTable
                isDark={isDark}
                products={products}
                categories={categories}
                brands={brands}
                apiSourcesByProductId={productApiSources}
                onRefresh={fetchProducts}
              />
            )}
          </div>
        )}

        {/* -- IMÁGENES -- */}
        {activeTab === "images" && (
          <ImageManagerTab
            isDark={isDark}
            products={products}
            onRefreshProducts={fetchProducts}
          />
        )}

        {/* -- MARKETING -- */}
        {activeTab === "marketing" && (
          <MarketingTab isDark={isDark} />
        )}

        {/* -- IMPORTACIONES -- */}
        {activeTab === "imports" && (
          <div className="space-y-6 w-full max-w-none">

            {/* Cotización del dólar */}
            <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl px-5 py-4 flex flex-wrap items-center gap-4`}>
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-8 w-8 rounded-lg bg-[#2D9F6A]/10 border border-[#2D9F6A]/20 flex items-center justify-center">
                  <DollarSign size={14} className="text-[#2D9F6A]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Cotización USD</p>
                  <p className="text-[10px] text-gray-500">
                    {exchangeRate.source === "api" ? "API" : "Manual"} ·{" "}
                    {new Date(exchangeRate.updatedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>

              {editingRate ? (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">1 USD =</span>
                  <input
                    type="number"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    className={`w-28 border border-[#2D9F6A]/40 rounded-lg px-2 py-1 text-sm font-mono outline-none focus:border-[#2D9F6A] ${dk("bg-[#0d0d0d] text-white", "bg-white text-[#171717]")}`}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const r = Number(rateInput);
                        if (r > 0) { setExchangeRate({ rate: r, source: "manual", updatedAt: new Date().toISOString() }); }
                        setEditingRate(false);
                      }
                      if (e.key === "Escape") setEditingRate(false);
                    }}
                  />
                  <span className="text-gray-500 text-sm">ARS</span>
                  <button
                    onClick={() => {
                      const r = Number(rateInput);
                      if (r > 0) { setExchangeRate({ rate: r, source: "manual", updatedAt: new Date().toISOString() }); }
                      setEditingRate(false);
                    }}
                    className="h-7 w-7 bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center justify-center transition"
                  >
                    <Check size={13} />
                  </button>
                  <button onClick={() => setEditingRate(false)}
                    className={`h-7 w-7 rounded-lg flex items-center justify-center transition ${dk("bg-[#2a2a2a] hover:bg-[#333] text-gray-400", "bg-[#e8e8e8] hover:bg-[#d4d4d4] text-gray-600")}`}>
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`text-2xl font-extrabold tabular-nums ${dk("text-white", "text-[#171717]")}`}>
                      {exchangeRate.rate.toLocaleString("es-AR")}
                    </span>
                    <span className="text-sm text-gray-500">ARS / USD</span>
                  </div>
                  <button
                    onClick={() => { setRateInput(String(exchangeRate.rate)); setEditingRate(true); }}
                    className={`flex items-center gap-1.5 text-xs transition px-2.5 py-1.5 rounded-lg border ${dk("text-[#737373] hover:text-white border-[#262626] hover:border-[#333] bg-[#0d0d0d] hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] border-[#e5e5e5] hover:border-[#d4d4d4] bg-white hover:bg-[#f5f5f5]")}`}
                  >
                    <Pencil size={11} /> Editar
                  </button>
                </div>
              )}

              <div className="ml-auto flex items-center gap-2.5">
                {fetchRateError && (
                  <span className="text-[11px] text-red-400">{fetchRateError}</span>
                )}
                <button
                  onClick={handleFetchRate}
                  disabled={fetchingRate}
                  className={`flex items-center gap-1.5 text-xs disabled:opacity-50 transition px-2.5 py-1.5 rounded-lg border border-transparent ${dk("text-[#737373] hover:text-white hover:bg-[#1c1c1c] hover:border-[#262626]", "text-[#737373] hover:text-[#171717] hover:bg-[#f5f5f5] hover:border-[#e5e5e5]")}`}
                >
                  <RefreshCw size={11} className={fetchingRate ? "animate-spin" : ""} />
                  {fetchingRate ? "Actualizando..." : "Cotización oficial"}
                </button>
                <div
                  className={`h-2 w-2 rounded-full ${exchangeRate.source === "api" ? "bg-green-400" : "bg-amber-400"}`}
                  title={exchangeRate.source === "api" ? "Cotización via API" : "Cotización manual"}
                />
              </div>
            </div>

            <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl p-5 space-y-4`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Contenido automático</h2>
                  <p className={`text-xs mt-0.5 ${dk("text-gray-500", "text-[#737373]")}`}>
                    Genera descripción resumida, descripción completa y especificaciones técnicas según nombre, marca y SKU.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSingleGen(v => !v)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition font-semibold ${dk("border-[#2a2a2a] text-[#a3a3a3] hover:text-white hover:border-[#2D9F6A]", "border-[#e5e5e5] text-[#525252] hover:border-[#2D9F6A] hover:text-[#2D9F6A]")}`}
                  >
                    <Sparkles size={12} /> Generar para un producto
                  </button>
                  <button
                    onClick={() => { void handleRunContentCompletion(); }}
                    disabled={contentRunning}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#2D9F6A] hover:bg-[#25835A] text-white font-semibold transition disabled:opacity-50"
                  >
                    <CheckCircle2 size={12} />
                    {contentRunning ? "Procesando..." : "Completar descripciones automáticamente"}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs ${dk("text-gray-400", "text-[#525252]")}`}>Modo:</span>
                <select
                  value={contentMode}
                  onChange={(e) => setContentMode(e.target.value as ContentMode)}
                  className={`border rounded-lg px-2.5 py-1.5 text-xs outline-none ${dk("bg-[#141414] border-[#2a2a2a] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`}
                >
                  <option value="both">Ambos (descripciones + specs)</option>
                  <option value="only_descriptions">Solo sin descripción</option>
                  <option value="only_specs">Solo sin specs</option>
                </select>
              </div>
              {contentProgress && (
                <div className={`rounded-lg px-4 py-3 text-xs flex flex-wrap items-center gap-3 ${dk("bg-[#0b0b0b] border border-[#1f1f1f] text-gray-200", "bg-[#f9fafb] border border-[#e5e7eb] text-[#374151]")}`}>
                  <span className="font-semibold">Progreso:</span>
                  <span>{contentProgress.done} / {contentProgress.total}</span>
                  <span>Generados: <strong className="text-emerald-400">{contentProgress.summary.generated}</strong></span>
                  <span>Revisión: <strong className="text-amber-400">{contentProgress.summary.review_required}</strong></span>
                </div>
              )}
              {contentError && (
                <div className={`rounded-lg px-4 py-3 text-xs ${dk("bg-red-500/10 text-red-400 border border-red-500/30", "bg-red-50 text-red-700 border border-red-200")}`}>
                  {contentError}
                </div>
              )}

              {/* ── Single product AI generator ── */}
              {showSingleGen && (
                <div className={`rounded-xl border p-4 space-y-3 ${dk("border-[#2a2a2a] bg-[#0a0a0a]", "border-[#e5e5e5] bg-[#fafafa]")}`}>
                  <p className={`text-xs font-bold flex items-center gap-2 ${dk("text-white", "text-[#171717]")}`}>
                    <Sparkles size={13} className="text-[#2D9F6A]" /> Generar descripción con IA para un producto
                  </p>

                  {/* Search */}
                  <div className="relative">
                    <input
                      value={singleGenSearch}
                      onChange={e => { setSingleGenSearch(e.target.value); setSingleGenSelected(null); setSingleGenResult(null); void searchProductsForSingleGen(e.target.value); }}
                      placeholder="Buscar por nombre o SKU..."
                      className={`w-full text-xs px-3 py-2 rounded-lg border outline-none ${dk("bg-[#0d0d0d] border-[#2a2a2a] text-white placeholder:text-[#525252]", "bg-white border-[#e5e5e5] text-[#171717]")}`}
                    />
                    {singleGenResults.length > 0 && !singleGenSelected && (
                      <div className={`absolute z-10 w-full mt-1 rounded-lg border shadow-lg overflow-hidden ${dk("bg-[#111] border-[#2a2a2a]", "bg-white border-[#e5e5e5]")}`}>
                        {singleGenResults.map(p => (
                          <button key={p.id} onClick={() => { setSingleGenSelected(p); setSingleGenSearch(p.name); setSingleGenResults([]); }}
                            className={`w-full text-left px-3 py-2 text-xs border-b last:border-b-0 transition ${dk("border-[#1a1a1a] hover:bg-[#1a1a1a] text-[#d4d4d4]", "border-[#f0f0f0] hover:bg-[#f5f5f5] text-[#171717]")}`}>
                            <span className="font-semibold">{p.name}</span>
                            <span className="text-[#737373] ml-2">{p.sku}{p.brand_name ? ` · ${p.brand_name}` : ""}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {singleGenSelected && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border ${dk("border-[#2D9F6A]/30 bg-[#2D9F6A]/5 text-[#2D9F6A]", "border-[#2D9F6A]/30 bg-[#2D9F6A]/5 text-[#2D9F6A]")}`}>
                        <CheckCircle2 size={11} /> {singleGenSelected.name}
                      </div>
                      <select value={singleGenMode} onChange={e => setSingleGenMode(e.target.value as ContentMode)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border outline-none ${dk("bg-[#141414] border-[#2a2a2a] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`}>
                        <option value="both">Descripciones + specs</option>
                        <option value="only_descriptions">Solo descripción</option>
                        <option value="only_specs">Solo specs</option>
                      </select>
                      <button onClick={() => { void handleSingleProductGenerate(); }} disabled={singleGenRunning}
                        className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg bg-[#2D9F6A] text-white hover:bg-[#25885a] disabled:opacity-50 transition font-semibold">
                        {singleGenRunning ? <><RefreshCw size={11} className="animate-spin" /> Generando...</> : <><Sparkles size={11} /> Generar</>}
                      </button>
                    </div>
                  )}

                  {singleGenError && (
                    <p className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded px-3 py-2">{singleGenError}</p>
                  )}

                  {/* Preview */}
                  {singleGenResult && (
                    <div className={`rounded-lg border p-3 space-y-3 ${dk("border-[#2a2a2a] bg-[#111]", "border-[#e5e5e5] bg-white")}`}>
                      <p className={`text-xs font-bold ${dk("text-white", "text-[#171717]")}`}>Vista previa generada</p>
                      {singleGenResult.description_short && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-[#525252] mb-1">Descripción corta</p>
                          <p className={`text-xs ${dk("text-[#d4d4d4]", "text-[#525252]")}`}>{singleGenResult.description_short}</p>
                        </div>
                      )}
                      {singleGenResult.description_full && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-[#525252] mb-1">Descripción completa</p>
                          <p className={`text-xs ${dk("text-[#d4d4d4]", "text-[#525252]")} line-clamp-4`}>{singleGenResult.description_full}</p>
                        </div>
                      )}
                      {singleGenResult.specs && Object.keys(singleGenResult.specs).length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-[#525252] mb-1">Specs ({Object.keys(singleGenResult.specs).length} campos)</p>
                          <div className="grid grid-cols-2 gap-1">
                            {Object.entries(singleGenResult.specs).slice(0, 6).map(([k, v]) => (
                              <span key={k} className={`text-[10px] px-2 py-0.5 rounded ${dk("bg-[#1a1a1a] text-[#a3a3a3]", "bg-[#f0f0f0] text-[#525252]")}`}>
                                <span className="font-semibold">{k}:</span> {String(v)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => { void applySingleGenResult(); }}
                          className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg bg-[#2D9F6A] text-white hover:bg-[#25885a] transition font-semibold">
                          <CheckCircle2 size={11} /> Aplicar al producto
                        </button>
                        <button onClick={() => setSingleGenResult(null)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition ${dk("border-[#2a2a2a] text-[#737373]", "border-[#e5e5e5] text-[#525252]")}`}>
                          Descartar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid xl:grid-cols-2 gap-6 items-start">
              {/* Agregar producto manual */}
              <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl p-5`}>
                <h2 className={`text-sm font-bold mb-4 ${dk("text-white", "text-[#171717]")}`}>Agregar producto manual</h2>
                <ProductForm isDark={isDark} brands={brands} onAdd={(p) => setProducts((prev) => [p, ...prev])} />
              </div>

              {/* Importar CSV */}
              <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl p-5`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>Importar CSV</h2>
                  <button onClick={downloadSampleCSV}
                    className="text-xs text-gray-400 hover:text-[#2D9F6A] transition flex items-center gap-1">
                    Descargar CSV de ejemplo
                  </button>
                </div>
                <ProductImport isDark={isDark} onImport={(r) => { setImportResult(r); fetchProducts(); }} />
                {importResult && (
                  <div className="mt-3 text-sm">
                    <span className="text-green-400 font-semibold">Importados: {importResult.imported}</span>
                    {importResult.errors.length > 0 && (
                      <ul className="text-red-400 mt-1 space-y-0.5 text-xs">
                        {importResult.errors.map((e, i) => <li key={i}>- {e}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Herramientas de mantenimiento */}
            <div className="grid xl:grid-cols-3 gap-6">
              <div><SupplierPriceImport isDark={isDark} /></div>
              <div><BulkDeleteProducts isDark={isDark} onDone={fetchProducts} /></div>
              {(() => {
                const zeroCount = products.filter((p) => (p.stock ?? 0) === 0).length;
                return (
                  <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl p-5 space-y-3`}>
                    <div>
                      <h3 className={`font-bold text-sm ${dk("text-white", "text-[#171717]")}`}>Eliminar sin stock</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {zeroCount === 0
                          ? "No hay productos con stock 0."
                          : <><span className="text-red-400 font-semibold">{zeroCount} producto{zeroCount !== 1 ? "s" : ""}</span> con stock = 0</>
                        }
                      </p>
                    </div>
                    {zeroCount > 0 && (
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-red-400">
                          <input
                            type="checkbox"
                            checked={confirmZeroStock}
                            onChange={(e) => setConfirmZeroStock(e.target.checked)}
                            className="accent-red-500"
                          />
                          Confirmo eliminar {zeroCount} producto{zeroCount !== 1 ? "s" : ""} permanentemente.
                        </label>
                        <button
                          onClick={deleteZeroStockProducts}
                          disabled={!confirmZeroStock || deletingZeroStock}
                          className="flex items-center gap-1.5 text-xs bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg transition"
                        >
                          <Trash2 size={12} />
                          {deletingZeroStock ? "Eliminando…" : `Eliminar ${zeroCount} sin stock`}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}



        {/* -- CATEGORÍAS -- */}
        {activeTab === "categories" && (
          <div className="space-y-6 w-full max-w-none">
            <div className={`${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")} border rounded-xl p-5`}>
              <h2 className={`text-sm font-bold mb-4 ${dk("text-white", "text-[#171717]")}`}>Categorías y Subcategorías</h2>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={collapseRootCategories}
                  disabled={rootCategoryWithChildrenIds.length === 0}
                  className={`text-xs font-semibold px-3 py-2 rounded-lg border transition disabled:opacity-40 ${
                    dk("bg-[#111] border-[#2a2a2a] text-gray-300 hover:bg-[#1b1b1b]", "bg-white border-[#d4d4d4] text-[#171717] hover:bg-[#f5f5f5]")
                  }`}
                >
                  Comprimir padres
                </button>
                <button
                  type="button"
                  onClick={expandRootCategories}
                  disabled={rootCategoryWithChildrenIds.length === 0}
                  className={`text-xs font-semibold px-3 py-2 rounded-lg border transition disabled:opacity-40 ${
                    dk("bg-[#111] border-[#2a2a2a] text-gray-300 hover:bg-[#1b1b1b]", "bg-white border-[#d4d4d4] text-[#171717] hover:bg-[#f5f5f5]")
                  }`}
                >
                  Expandir padres
                </button>
                <span className={`text-xs ${dk("text-gray-500", "text-[#737373]")}`}>
                  {collapsedRootCount}/{rootCategoryWithChildrenIds.length} padres comprimidos
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                <input
                  value={newCatName} onChange={(e) => { setNewCatName(e.target.value); if (categoryError) setCategoryError(""); if (categorySuccess) setCategorySuccess(""); }}
                  placeholder="Nombre de categoría"
                  className={`flex-1 min-w-[220px] border rounded-lg px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040] placeholder:text-[#404040]", "bg-[#f9f9f9] border-[#d4d4d4] text-[#171717] focus:border-[#2D9F6A] placeholder:text-gray-400")}`}
                />
                <select value={newCatParent} onChange={(e) => { setNewCatParent(e.target.value); if (categoryError) setCategoryError(""); if (categorySuccess) setCategorySuccess(""); }}
                  className={`min-w-[240px] border rounded-lg px-3 py-2 text-sm outline-none ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040]", "bg-[#f9f9f9] border-[#d4d4d4] text-[#171717] focus:border-[#2D9F6A]")}`}>
                  <option value="">Categoría raíz</option>
                  {categoryParentOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <button onClick={addCategory} disabled={savingCat || !newCatName.trim()}
                  className="bg-[#2D9F6A] hover:bg-[#25835A] text-white text-sm font-bold px-4 rounded-lg transition disabled:opacity-40">
                  + Agregar
                </button>
                <button
                  onClick={addComponentsTemplate}
                  disabled={savingCat}
                  className={`text-sm font-semibold px-4 py-2 rounded-lg border transition disabled:opacity-40 ${
                    dk("bg-[#111] border-[#2a2a2a] text-gray-300 hover:bg-[#1b1b1b]", "bg-white border-[#d4d4d4] text-[#171717] hover:bg-[#f5f5f5]")
                  }`}
                >
                  Cargar plantilla Componentes
                </button>
              </div>
              {categoryError && (
                <p className="mb-4 text-sm text-red-400">{categoryError}</p>
              )}
              {categorySuccess && (
                <p className="mb-4 text-sm text-green-500">{categorySuccess}</p>
              )}
              <div
                onDragOver={(event) => {
                  if (dragCategoryId === null) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropParentPreview("root");
                }}
                onDragLeave={() => {
                  if (dropParentPreview === "root") {
                    setDropParentPreview(null);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const incoming = Number(event.dataTransfer.getData("text/plain") || dragCategoryId);
                  if (!Number.isFinite(incoming) || !canDropCategory(incoming, null)) return;
                  void moveCategory(incoming, null);
                }}
                className={`mb-3 border rounded-lg px-3 py-2 text-xs transition ${
                  dropParentPreview === "root"
                    ? "border-[#2D9F6A] bg-[#2D9F6A]/10 text-[#2D9F6A]"
                    : dk("border-[#262626] text-gray-500", "border-[#d4d4d4] text-[#737373]")
                }`}
              >
                Solta aca para mover la categoria al nivel raiz.
              </div>
              <div className="space-y-2">
                {rootCategoryNodes.map((node) => renderCategoryNode(node))}
                {showLegacyCategoryBlock && categories.filter((c) => c.parent_id === null).map((parent) => (
                  <div key={parent.id} className={`${dk("bg-[#0d0d0d] border-[#1f1f1f]", "bg-[#f5f5f5] border-[#e5e5e5]")} border rounded-lg px-3 py-2 min-w-[140px]`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-sm font-semibold ${dk("text-white", "text-[#171717]")}`}>{parent.name}</span>
                      <button onClick={() => deleteCategory(parent.id)} className="text-gray-500 hover:text-red-400 transition"><Trash2 size={12} /></button>
                    </div>
                    {categories.filter((c) => c.parent_id === parent.id).map((sub) => (
                      <div key={sub.id} className={`flex items-center justify-between text-xs text-[#737373] pl-2 border-l mt-1 ${dk("border-[#262626]", "border-[#d4d4d4]")}`}>
                        <span>↳ {sub.name}</span>
                        <button onClick={() => deleteCategory(sub.id)} className="text-gray-500 hover:text-red-400 transition ml-2"><Trash2 size={11} /></button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "opportunities" && (
          <OpportunitiesTab
            products={products}
            categories={categories}
            brands={brands}
            onRefreshProducts={fetchProducts}
            isDark={isDark}
            canEdit={canManageProducts}
          />
        )}

        {activeTab === "pos" && (
          <PosManagementTab
            products={products}
            categories={categories}
            brands={brands}
            onRefreshProducts={fetchProducts}
            isDark={isDark}
            canEdit={canManageProducts}
          />
        )}

        {/* -- MODO VENDEDOR -- */}
        {activeTab === "seller_mode" && (
          <div className="space-y-6">
            <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 border ${dk("bg-zinc-800/60 border-zinc-700/50", "bg-white border-zinc-200")}`}>
              <DollarSign size={20} className={dk("text-emerald-400", "text-emerald-600")} />
              <div>
                <h2 className={`font-semibold text-sm ${dk("text-white", "text-zinc-900")}`}>Modo Vendedor</h2>
                <p className={`text-xs mt-0.5 ${dk("text-zinc-400", "text-zinc-500")}`}>
                  Creación rápida de cotizaciones y pedidos — próximamente.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* -- PEDIDOS -- */}
        {activeTab === "orders" && (
          <div className="grid lg:grid-cols-2 gap-5 max-w-5xl">
            <div className="space-y-3">
              {/* Export + Currency notice */}
              <div className="flex items-center gap-2">
                <div className={`flex-1 flex items-start gap-2.5 rounded-xl px-4 py-3 border text-xs ${dk("bg-blue-500/8 border-blue-500/20 text-blue-300", "bg-blue-50 border-blue-200 text-blue-700")}`}>
                  <DollarSign size={13} className="mt-0.5 shrink-0" />
                  <span>
                    Los importes se muestran en <strong>USD</strong> (moneda base del portal).
                    1 USD = <strong>{exchangeRate.rate.toLocaleString("es-AR")} ARS</strong>
                  </span>
                </div>
                <button
                  onClick={() => setShowCreateOrder(true)}
                  className="flex items-center gap-1.5 text-xs shrink-0 px-3 py-2 rounded-lg bg-[#2D9F6A] hover:bg-[#25835A] text-white font-semibold transition"
                >
                  <UserPlus size={12} /> Nuevo pedido
                </button>
                {orders.length > 0 && (
                  <button
                    onClick={() => exportOrdersCSV(orders)}
                    title="Exportar pedidos a CSV"
                    className={`flex items-center gap-1.5 text-xs shrink-0 px-3 py-2 rounded-lg border transition ${dk("text-[#737373] hover:text-white border-[#262626] hover:border-[#333] bg-[#111] hover:bg-[#1c1c1c]", "text-[#737373] hover:text-[#171717] border-[#e5e5e5] hover:border-[#d4d4d4] bg-white hover:bg-[#f5f5f5]")}`}
                  >
                    <Download size={12} /> CSV
                  </button>
                )}
              </div>

              {/* Filtros de pedidos */}
              <div className="flex gap-2 flex-wrap">
                <select
                  value={filterOrderStatus}
                  onChange={(e) => { setFilterOrderStatus(e.target.value); setOrdersPage(1); }}
                  className={`border rounded-lg px-2 py-1.5 text-xs outline-none flex-1 min-w-[120px] ${dk("bg-[#111] border-[#2a2a2a] text-gray-300", "bg-white border-[#d4d4d4] text-[#525252]")}`}
                >
                  <option value="all">Todos los estados</option>
                  <option value="pending">En revisión</option>
                  <option value="approved">Aprobado</option>
                  <option value="preparing">Preparando</option>
                  <option value="shipped">Enviado</option>
                  <option value="dispatched">Despachado</option>
                  <option value="delivered">Entregado</option>
                  <option value="rejected">Rechazado</option>
                </select>
                <select
                  value={filterOrderClient}
                  onChange={(e) => { setFilterOrderClient(e.target.value); setOrdersPage(1); }}
                  className={`border rounded-lg px-2 py-1.5 text-xs outline-none flex-1 min-w-[140px] ${dk("bg-[#111] border-[#2a2a2a] text-gray-300", "bg-white border-[#d4d4d4] text-[#525252]")}`}
                >
                  <option value="all">Todos los clientes</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.company_name || c.contact_name}</option>
                  ))}
                </select>
                {(filterOrderStatus !== "all" || filterOrderClient !== "all") && (
                  <button
                    onClick={() => { setFilterOrderStatus("all"); setFilterOrderClient("all"); }}
                    className="text-xs text-gray-500 hover:text-red-400 transition px-2"
                  >
                    × Limpiar
                  </button>
                )}
              </div>

              {loadingOrders ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`h-20 rounded-xl animate-pulse ${dk("bg-[#111]", "bg-white")}`} />)}
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-20 text-gray-500 text-sm">No hay pedidos todavía.</div>
              ) : (() => {
                const allFiltered = orders.filter((o) => {
                  if (filterOrderStatus !== "all" && o.status !== filterOrderStatus) return false;
                  if (filterOrderClient !== "all" && o.client_id !== filterOrderClient) return false;
                  return true;
                });
                const totalPages = Math.ceil(allFiltered.length / ORDERS_PER_PAGE);
                const visibleOrders = allFiltered.slice((ordersPage - 1) * ORDERS_PER_PAGE, ordersPage * ORDERS_PER_PAGE);
                return allFiltered.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 text-sm">Sin resultados para los filtros seleccionados.</div>
                ) : (
                <div className="space-y-2">
                  {visibleOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`border rounded-xl p-4 cursor-pointer transition ${
                        selectedOrder?.id === order.id
                          ? dk("border-[#333] bg-[#141414]", "border-[#2D9F6A]/30 bg-[#f0faf5]")
                          : dk("border-[#1f1f1f] bg-[#111] hover:border-[#2e2e2e] hover:bg-[#141414]", "border-[#e5e5e5] bg-white hover:border-[#d4d4d4] hover:bg-[#f9f9f9]")
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-mono font-bold ${dk("text-gray-300", "text-[#525252]")}`}>
                          {order.order_number ?? `#${String(order.id).slice(-8)}`}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                      <p className={`text-xs ${dk("text-gray-600", "text-[#a3a3a3]")}`}>
                        {new Date(order.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <span className={`text-xs ${dk("text-gray-500", "text-[#a3a3a3]")}`}>{order.products?.length} items</span>
                        <div className="text-right">
                          <span className={`font-bold text-sm ${dk("text-white", "text-[#171717]")}`}>
                            USD {order.total.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                          </span>
                          <span className={`block text-[10px] font-mono ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>
                            ≈ {(order.total * exchangeRate.rate).toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <span className={`text-xs ${dk("text-[#525252]","text-[#a3a3a3]")}`}>
                        {allFiltered.length} pedidos · pág. {ordersPage} de {totalPages}
                      </span>
                      <div className="flex gap-1">
                        <button
                          disabled={ordersPage === 1}
                          onClick={() => setOrdersPage((p) => p - 1)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition disabled:opacity-30 ${dk("border-[#2a2a2a] text-[#737373] hover:text-white hover:bg-[#1c1c1c]","border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")}`}
                        >
                          ← Ant.
                        </button>
                        <button
                          disabled={ordersPage === totalPages}
                          onClick={() => setOrdersPage((p) => p + 1)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition disabled:opacity-30 ${dk("border-[#2a2a2a] text-[#737373] hover:text-white hover:bg-[#1c1c1c]","border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")}`}
                        >
                          Sig. →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            </div>

            {selectedOrder && (
              <div className={`border rounded-xl p-6 ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className={`font-bold font-mono ${dk("text-white", "text-[#171717]")}`}>
                    {selectedOrder.order_number ?? `#${String(selectedOrder.id).slice(-8)}`}
                  </h3>
                  <StatusBadge status={selectedOrder.status} />
                </div>
                {selectedOrder.numero_remito && (
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`flex items-center gap-1.5 text-xs ${dk("text-blue-400", "text-blue-600")}`}>
                      <Truck size={11} />
                      Remito: <span className="font-mono font-bold">{selectedOrder.numero_remito}</span>
                    </div>
                    <button
                      onClick={() => {
                        void handleExportRemitoPdf();
                      }}
                      className="flex items-center gap-1 text-[10px] text-[#2D9F6A] hover:underline font-medium"
                    >
                      <Download size={11} /> Descargar PDF
                    </button>
                  </div>
                )}

                <p className={`text-xs mb-4 ${dk("text-gray-500", "text-[#737373]")}`}>
                  {new Date(selectedOrder.created_at).toLocaleDateString("es-AR", { dateStyle: "full" })}
                </p>

                <table className="w-full text-sm mb-4">
                  <thead>
                    <tr className={`border-b ${dk("border-[#333]", "border-[#e5e5e5]")}`}>
                      <th className={`pb-2 text-left text-xs font-medium ${dk("text-gray-500", "text-[#a3a3a3]")}`}>Producto</th>
                      <th className={`pb-2 text-center text-xs font-medium ${dk("text-gray-500", "text-[#a3a3a3]")}`}>Cant.</th>
                      <th className={`pb-2 text-right text-xs font-medium ${dk("text-gray-500", "text-[#a3a3a3]")}`}>USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.products?.map((p, i) => (
                      <tr key={i} className={`border-b ${dk("border-[#2a2a2a]", "border-[#f0f0f0]")}`}>
                        <td className={`py-2 ${dk("text-gray-300", "text-[#525252]")}`}>{p.name}</td>
                        <td className={`py-2 text-center ${dk("text-gray-500", "text-[#a3a3a3]")}`}>{p.quantity}</td>
                        <td className={`py-2 text-right font-semibold ${dk("text-white", "text-[#171717]")}`}>
                          {p.total_price?.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className={`mb-5 pt-3 border-t ${dk("border-[#333]", "border-[#e5e5e5]")}`}>
                  <div className="flex justify-between font-bold text-base">
                    <span className={dk("text-gray-400", "text-[#737373]")}>Total</span>
                    <div className="text-right">
                      <span className="text-[#2D9F6A]">USD {selectedOrder.total.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
                      <p className={`text-[11px] font-normal font-mono mt-0.5 ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>
                        ≈ {(selectedOrder.total * exchangeRate.rate).toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
                        <span className={`ml-1.5 ${dk("text-[#3a3a3a]", "text-[#c4c4c4]")}`}>@ {exchangeRate.rate.toLocaleString("es-AR")} ARS/USD</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`mb-5 p-4 rounded-xl border ${dk("bg-[#0d0d0d] border-[#1a1a1a]", "bg-[#f9f9f9] border-[#e5e5e5]")}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Truck size={14} className="text-[#2D9F6A]" />
                    <h4 className={`text-xs font-bold uppercase tracking-widest ${dk("text-gray-300", "text-[#171717]")}`}>Logística y Envío</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1 ml-1">Transporte</label>
                      <select 
                        value={shippingProvider}
                        onChange={(e) => setShippingProvider(e.target.value)}
                        className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${dk("bg-[#111] border-[#2a2a2a] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`}
                      >
                        <option value="">Seleccionar...</option>
                        <option value="Andreani">Andreani</option>
                        <option value="OCA">OCA</option>
                        <option value="OCASA">OCASA</option>
                        <option value="Logística Bartez">Logística Bartez</option>
                        <option value="Retiro en sucursal">Retiro en sucursal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1 ml-1">Guía / Tracking</label>
                      <input 
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="Nro de seguimiento"
                        className={`w-full rounded-lg border px-3 py-2 text-xs outline-none ${dk("bg-[#111] border-[#2a2a2a] text-white", "bg-white border-[#d4d4d4] text-[#171717]")}`}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-4 px-1">
                    <input 
                      type="checkbox"
                      id="notify-email"
                      checked={notifyByEmail}
                      onChange={(e) => setNotifyByEmail(e.target.checked)}
                      className="rounded border-gray-300 text-[#2D9F6A] focus:ring-[#2D9F6A]"
                    />
                    <label htmlFor="notify-email" className={`text-[10px] font-bold uppercase tracking-wider cursor-pointer ${dk("text-gray-400", "text-gray-600")}`}>
                      Notificar al cliente por email
                    </label>
                  </div>

                  <button 
                    onClick={handleSaveLogistics}
                    disabled={savingLogistics}
                    className="w-full bg-[#2D9F6A] hover:bg-[#25835A] disabled:opacity-50 text-white rounded-lg py-2 text-[11px] font-bold uppercase tracking-widest transition shadow-lg shadow-[#2D9F6A]/10"
                  >
                    {savingLogistics ? "Guardando..." : "Actualizar Información de Envío"}
                  </button>
                </div>

                {selectedOrder.status === "pending" && (() => {
                  const phone = clients.find((c) => c.id === selectedOrder.client_id)?.phone ?? "";
                  const waMsg = encodeURIComponent(
                    `Hola! Te escribimos de Bartez Tecnología sobre tu pedido #${String(selectedOrder.id).slice(-8).toUpperCase()}. ¿Podemos coordinar la confirmación?`
                  );
                  const waUrl = phone ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${waMsg}` : null;
                  return (
                    <div className="space-y-2">
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-2 bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 rounded-lg py-2 text-sm font-semibold hover:bg-[#25D366]/25 transition"
                        >
                          <Phone size={15} /> Contactar por WhatsApp
                        </a>
                      )}
                      <div className="flex gap-3">
                        <button
                          onClick={() => updateOrderStatus(selectedOrder.id, "approved")}
                          className="flex-1 flex items-center justify-center gap-2 bg-green-500/15 text-green-400 border border-green-500/30 rounded-lg py-2 text-sm font-semibold hover:bg-green-500/25 transition"
                        >
                          <CheckCircle2 size={15} /> Aprobar
                        </button>
                        <button
                          onClick={() => updateOrderStatus(selectedOrder.id, "rejected")}
                          className="flex-1 flex items-center justify-center gap-2 bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg py-2 text-sm font-semibold hover:bg-red-500/25 transition"
                        >
                          <XCircle size={15} /> Rechazar
                        </button>
                      </div>
                      {!waUrl && (
                        <p className={`text-[11px] text-center ${dk("text-[#525252]", "text-[#a3a3a3]")}`}>
                          Sin celular registrado para este cliente — no se puede enviar WhatsApp
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* -- Despacho — available when approved -- */}
                {selectedOrder.status === "approved" && (
                  <div className={`mt-4 pt-4 border-t ${dk("border-[#1f1f1f]", "border-[#e5e5e5]")} space-y-2`}>
                    <p className={`text-xs font-semibold ${dk("text-gray-400", "text-[#737373]")} uppercase tracking-wide`}>Despacho</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Número de remito"
                        value={remitoInput}
                        onChange={(e) => setRemitoInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") dispatchOrder(selectedOrder.id, remitoInput); }}
                        className={`flex-1 border rounded-lg px-3 py-2 text-sm font-mono outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#2D9F6A]/50 placeholder:text-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#2D9F6A]/50 placeholder:text-gray-400")}`}
                      />
                      <button
                        onClick={() => dispatchOrder(selectedOrder.id, remitoInput)}
                        disabled={!remitoInput.trim() || dispatchingOrder}
                        className="flex items-center gap-1.5 bg-blue-600/80 hover:bg-blue-600 text-white text-sm font-semibold px-4 rounded-lg transition disabled:opacity-40 disabled:pointer-events-none"
                      >
                        <Truck size={14} /> {dispatchingOrder ? "..." : "Despachar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* -- KANBAN -- */}
        {activeTab === "kanban" && (() => {
          const clientMap: Record<string, string> = {};
          clients.forEach((c) => { clientMap[c.id] = c.company_name || c.contact_name; });
          const kanbanOrders: KanbanOrder[] = rtOrders.map((o) => ({
            ...o,
            client_name: clientMap[o.client_name ?? ""] ?? o.client_name?.slice(0, 8),
          }));
          return (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-sm font-bold ${dk("text-white", "text-[#171717]")}`}>
                  Kanban de pedidos
                </h2>
                <span className={`text-xs ${dk("text-gray-500", "text-[#737373]")}`}>
                  {rtOrders.length} pedidos · arrastrá para cambiar estado
                </span>
              </div>
              <OrderKanban
                orders={kanbanOrders}
                onStatusChange={handleKanbanStatus}
                formatPrice={formatPrice}
                isDark={isDark}
              />
            </div>
          );
        })()}

        {/* -- CLIENTES -- */}
        {activeTab === "clients" && (
          <>
          <ClientCRM
            clients={clients}
            orders={orders}
            loading={loadingClients}
            isDark={isDark}
            onSave={saveClientFields}
            onNewClient={() => { setShowNewClient(true); setCreateError(""); }}
            onRefreshClients={fetchClients}
          />

            {/* Modal nuevo cliente */}
            {showNewClient && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                <div className={`border rounded-2xl w-full max-w-md shadow-2xl shadow-black/60 ${dk("bg-[#111] border-[#1f1f1f]", "bg-white border-[#e5e5e5]")}`}>
                  <div className={`flex items-center justify-between px-6 py-4 border-b ${dk("border-[#1a1a1a]", "border-[#e5e5e5]")}`}>
                    <h3 className={`font-bold ${dk("text-white", "text-[#171717]")}`}>Nuevo Cliente</h3>
                    <button onClick={() => setShowNewClient(false)} className={`transition ${dk("text-gray-500 hover:text-white", "text-[#a3a3a3] hover:text-[#171717]")}`}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="px-6 py-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Email *</label>
                        <input type="email" value={newClient.email}
                          onChange={(e) => setNewClient((p) => ({ ...p, email: e.target.value }))}
                          className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4]")}`}
                          placeholder="cliente@empresa.com" />
                      </div>
                      <div className="col-span-2">
                        <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Contraseña *</label>
                        <div className="flex gap-2">
                          <input type="text" value={newClient.password}
                            onChange={(e) => setNewClient((p) => ({ ...p, password: e.target.value }))}
                            className={`flex-1 border rounded-lg px-3 py-2 text-sm font-mono outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040] placeholder:text-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4] placeholder:text-[#c4c4c4]")}`}
                            placeholder="Mínimo 6 caracteres" />
                          <button type="button" onClick={generatePassword}
                            className={`shrink-0 text-[#2D9F6A] text-xs font-bold px-3 rounded-lg border transition ${dk("bg-[#2a2a2a] hover:bg-[#333] border-[#333]", "bg-[#f0f0f0] hover:bg-[#e8e8e8] border-[#e5e5e5]")}`}>
                            Generar
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Empresa</label>
                        <input type="text" value={newClient.company_name}
                          onChange={(e) => setNewClient((p) => ({ ...p, company_name: e.target.value }))}
                          className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4]")}`}
                          placeholder="Distribuidora XYZ" />
                      </div>
                      <div>
                        <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Contacto</label>
                        <input type="text" value={newClient.contact_name}
                          onChange={(e) => setNewClient((p) => ({ ...p, contact_name: e.target.value }))}
                          className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4]")}`}
                          placeholder="Juan Pérez" />
                      </div>
                      <div className="col-span-2">
                        <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>
                          Celular <span className="font-normal opacity-60">(cód. de área + número, ej: 3411234567 · 1145678901)</span>
                        </label>
                        <input
                          type="tel"
                          value={newClient.phone}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "");
                            setNewClient((p) => ({ ...p, phone: value }));
                          }}
                          placeholder="3411234567"
                          className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4]")}`}
                        />
                      </div>

                      <div>
                        <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Tipo</label>
                        <select value={newClient.client_type}
                          onChange={(e) => {
                            const t = e.target.value as ClientType;
                            setNewClient((p) => ({ ...p, client_type: t, default_margin: CLIENT_TYPE_MARGINS[t] }));
                          }}
                          className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4]")}`}>
                          <option value="reseller">Revendedor</option>
                          <option value="mayorista">Mayorista</option>
                          <option value="empresa">Empresa</option>
                        </select>
                      </div>
                      <div>
                        <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Margen %</label>
                        <input type="number" min="0" max="100" value={newClient.default_margin}
                          onChange={(e) => setNewClient((p) => ({ ...p, default_margin: Number(e.target.value) }))}
                          className={`w-full border rounded-lg px-3 py-2 text-sm text-center outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4]")}`} />
                      </div>
                      <div className="col-span-2">
                        <label className={`text-xs mb-1 block ${dk("text-gray-400", "text-[#737373]")}`}>Rol</label>
                        <select value={newClient.role}
                          onChange={(e) => setNewClient((p) => ({ ...p, role: e.target.value as "client" | "cliente" | "admin" | "vendedor" }))}
                          className={`w-full border rounded-lg px-3 py-2 text-sm outline-none transition ${dk("bg-[#0d0d0d] border-[#262626] text-white focus:border-[#404040]", "bg-[#f5f5f5] border-[#e5e5e5] text-[#171717] focus:border-[#d4d4d4]")}`}>
                          <option value="client">Cliente</option>
                          <option value="cliente">Cliente (ES)</option>
                          <option value="vendedor">Vendedor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                    </div>

                    {createError && (
                      <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{createError}</p>
                    )}

                    <button
                      onClick={handleCreateClient}
                      disabled={creatingClient}
                      className="w-full bg-[#2D9F6A] hover:bg-[#25835A] text-white font-bold py-2.5 rounded-lg text-sm transition disabled:opacity-50"
                    >
                      {creatingClient ? "Creando..." : "Crear Cliente"}
                    </button>
                  </div>
                </div>
              </div>
            )}


          </>
        )}

        {/* -- PROVEEDORES -- */}
        {activeTab === "users_permissions" && (
          <UsersPermissionsTab
            isDark={isDark}
            clients={clients}
            onRefresh={fetchClients}
          />
        )}

        {activeTab === "approvals" && (
          <ApprovalsTab
            isDark={isDark}
            orders={orders}
            clients={clients}
            approverLabel={session?.user.email ?? "Admin"}
            onApproveOrder={(orderId, payload) => updateOrderStatus(orderId, "approved", payload)}
            onRejectOrder={(orderId, payload) => updateOrderStatus(orderId, "rejected", payload)}
            onOpenTab={(tab) => setActiveTab(tab as Tab)}
          />
        )}

        {activeTab === "suppliers" && (
          <SuppliersTab isDark={isDark} />
        )}

        {/* -- MARCAS -- */}
        {activeTab === "brands" && (
          <BrandsTab isDark={isDark} />
        )}

        {/* -- STOCK -- */}
        {activeTab === "stock" && (
          <StockTab isDark={isDark} />
        )}

        {/* -- MOVIMIENTOS -- */}
        {activeTab === "movements" && (
          <StockMovementsTab isDark={isDark} />
        )}

        {/* -- FACTURAS -- */}
        {activeTab === "invoices" && (
          <InvoicesTab isDark={isDark} />
        )}

        {activeTab === "documents" && (
          <DocumentsTab
            isDark={isDark}
            orders={orders}
            clients={clients}
            onOpenTab={(tab) => setActiveTab(tab as Tab)}
          />
        )}

        {/* -- CRÉDITO -- */}
        {activeTab === "credit" && (
          <CreditTab isDark={isDark} />
        )}

        {/* -- COTIZACIONES ADMIN -- */}
        {activeTab === "quotes_admin" && (
          <QuotesAdminTab isDark={isDark} />
        )}

        {/* -- ÓRDENES DE COMPRA -- */}
        {activeTab === "purchase_orders" && (
          <PurchaseOrdersTab isDark={isDark} />
        )}

        {/* -- MOTOR DE PRECIOS -- */}
        {activeTab === "pricing" && (
          <PricingRulesTab isDark={isDark} categories={categoryNames} />
        )}

        {/* -- REPORTES -- */}
        {activeTab === "reports" && (
          <div className="space-y-4 max-w-5xl">
            {/* Export ventas CSV */}
            <div className="flex justify-end">
              <button
                onClick={() => exportReportsCSV(orders, clients)}
                className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition ${dk("border-[#2a2a2a] text-gray-400 hover:text-white hover:bg-[#1c1c1c]","border-[#e5e5e5] text-[#737373] hover:bg-[#f5f5f5]")}`}
              >
                <Download size={12} /> Exportar ventas CSV
              </button>
            </div>
            <ReportsTab
              products={products}
              orders={orders}
              clients={clients}
              invoices={invoiceSearchItems}
              formatPrice={formatPrice}
              isDark={isDark}
            />
          </div>
        )}

        {/* -- ACTIVIDAD -- */}
        {activeTab === "activity" && (
          <ActivityLogTab isDark={isDark} />
        )}

        {activeTab === "support" && (
          <SupportTab
            isDark={isDark}
            clients={clients}
          />
        )}

        {activeTab === "webhooks" && (
          <WebhooksTab isDark={isDark} />
        )}

        {activeTab === "rma" && (
          <RmaAdminTab isDark={isDark} />
        )}

        {activeTab === "serials" && <SerialsTab isDark={isDark} />}

        {activeTab === "price_agreements" && (
          <PriceAgreementsTab isDark={isDark} clients={clients} />
        )}

        {/* -- SYNC PROVEEDORES -- */}
        {activeTab === "supplier_sync" && (
          <SupplierApisSyncTab isDark={isDark} userId={userId} onSyncDone={fetchProducts} />
        )}
        </Suspense>
      </ErrorBoundary>
      </main>
      </div>{/* end body flex */}

      {/* -- Create order modal -- */}
      {showCreateOrder && (
        <CreateOrderModal
          clients={clients}
          products={products}
          isDark={isDark}
          onClose={() => setShowCreateOrder(false)}
          onCreated={fetchOrders}
        />
      )}
    </div>
  );
};

export default Admin;









