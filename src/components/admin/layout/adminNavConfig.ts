import {
  LayoutDashboard, Package, Download, Tag, Image, Flame, Truck, DollarSign,
  ClipboardList, Layers, CheckCircle2, MessageSquare, Users, UserPlus,
  CreditCard, Bell, FileText, BarChart2, Building2, Bookmark, Wifi,
  ShieldCheck, ShieldAlert, History, ShoppingBag, RotateCcw, Handshake, LifeBuoy,
  Ticket, Globe, Activity, Megaphone, PackagePlus, Cpu, Monitor, Wrench, type LucideIcon,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Tab =
  | "dashboard"
  | "products" | "imports" | "categories" | "images" | "opportunities" | "pos" | "bundles"
  | "orders" | "kanban" | "approvals" | "quotes_admin" | "registration_requests" | "exception_inbox"
  | "seller_mode" | "seller_management" | "seller_portfolio" | "seller_targets" | "seller_activity"
  | "clients" | "users_permissions" | "credit" | "business_alerts" | "documents" | "support"
  | "invoices" | "reports"
  | "suppliers" | "brands" | "pricing" | "dolar" | "envios" | "pagos" | "transferencia" | "arrepentimientos" | "textos_legales" | "supplier_sync" | "stock" | "serials"
  | "movements" | "purchase_orders" | "rma" | "price_agreements" | "marketing" | "webhooks" | "activity" | "admin_management"
  | "pc_armadas" | "servicios_tienda" | "portada" | "secciones_inicio";

export type ModuleId = "top" | "catalogo" | "armador" | "pedidos" | "vendedores" | "clientes" | "finanzas" | "marketing" | "inventario" | "configuracion" | "sistema" | "legal";

export interface NavItem {
  id: Tab;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  manageProducts?: boolean;
  manageOrders?: boolean;
}

export interface NavModule {
  id: ModuleId;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

// ── Static nav config ─────────────────────────────────────────────────────────

const NAV_MODULES_COMPLETOS: NavModule[] = [
  {
    id: "top",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    id: "catalogo",
    label: "Catálogo",
    icon: Package,
    items: [
      { id: "products",      label: "Productos",     icon: Package,    manageProducts: true },
      { id: "imports",       label: "Importaciones", icon: Download,   manageProducts: true },
      { id: "categories",    label: "Categorías",    icon: Tag,        manageProducts: true },
      { id: "images",        label: "Imágenes",      icon: Image,      manageProducts: true },
      { id: "opportunities", label: "Oportunidades", icon: Flame,      manageProducts: true },
      { id: "pos",           label: "POS",           icon: Truck,      manageProducts: true },
    ],
  },
  {
    id: "armador",
    label: "Armá tu PC",
    icon: Cpu,
    items: [
      { id: "pc_armadas",       label: "PC armadas", icon: Monitor, adminOnly: true },
      { id: "servicios_tienda", label: "Servicios",  icon: Wrench,  adminOnly: true },
    ],
  },
  {
    id: "pedidos",
    label: "Ventas",
    icon: ClipboardList,
    items: [
      { id: "quotes_admin", label: "Cotizaciones", icon: MessageSquare, adminOnly: true },
      { id: "orders",       label: "Pedidos",      icon: ClipboardList, manageOrders: true },
      { id: "kanban",       label: "Kanban",       icon: Layers,        manageOrders: true },
      { id: "pagos",        label: "Pagos",        icon: CreditCard,    manageOrders: true },
      { id: "approvals",    label: "Aprobaciones", icon: CheckCircle2,  manageOrders: true },
    ],
  },
  {
    id: "vendedores",
    label: "Vendedores",
    icon: DollarSign,
    items: [
      { id: "seller_management", label: "Gestion",      icon: UserPlus,   adminOnly: true },
      { id: "seller_mode",      label: "Vendedor 360", icon: DollarSign, adminOnly: true },
      { id: "seller_portfolio", label: "Cartera",      icon: Users,      adminOnly: true },
      { id: "seller_targets",   label: "Objetivos",    icon: BarChart2,  adminOnly: true },
      { id: "seller_activity",  label: "Seguimiento",  icon: Activity,   adminOnly: true },
    ],
  },
  {
    id: "clientes",
    label: "Clientes 360",
    icon: Users,
    items: [
      { id: "clients",                label: "Ficha 360",     icon: Users,      adminOnly: true },
      { id: "exception_inbox",        label: "Excepciones",   icon: ShieldAlert, adminOnly: true },
      { id: "registration_requests",  label: "Altas B2B",     icon: UserPlus,   adminOnly: true },
      { id: "users_permissions",      label: "Accesos",       icon: UserPlus,   adminOnly: true },
      { id: "credit",            label: "Crédito",       icon: CreditCard, adminOnly: true },
      { id: "business_alerts",   label: "Alertas B2B",  icon: Bell,       adminOnly: true },
    ],
  },
  {
    id: "finanzas",
    label: "Finanzas y docs",
    icon: FileText,
    items: [
      { id: "invoices",  label: "Facturas",   icon: FileText,  adminOnly: true },
      { id: "documents", label: "Documentos", icon: FileText,  adminOnly: true },
      { id: "reports",   label: "Reportes",   icon: BarChart2, adminOnly: true },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    items: [
      { id: "marketing", label: "Campañas", icon: Ticket,    adminOnly: true },
      { id: "portada",   label: "Portada del inicio", icon: Image, adminOnly: true },
      { id: "secciones_inicio", label: "Secciones del inicio", icon: Layers, adminOnly: true },
      { id: "support",   label: "Soporte",  icon: LifeBuoy,  adminOnly: true },
    ],
  },
  {
    id: "inventario",
    label: "Inventario",
    icon: Layers,
    items: [
      { id: "stock",           label: "Stock",           icon: Layers,     adminOnly: true },
      { id: "movements",       label: "Movimientos",     icon: History,    adminOnly: true },
      { id: "serials",         label: "Números Serie",   icon: ShieldCheck, adminOnly: true },
      { id: "purchase_orders", label: "Órdenes Compra",  icon: ShoppingBag, adminOnly: true },
      { id: "rma",             label: "Devoluciones",    icon: RotateCcw,  adminOnly: true },
    ],
  },
  {
    id: "configuracion",
    label: "Configuración",
    icon: Building2,
    items: [
      { id: "suppliers",        label: "Proveedores",     icon: Building2,  adminOnly: true },
      { id: "brands",           label: "Marcas",          icon: Bookmark,   adminOnly: true },
      { id: "pricing",          label: "Precios",         icon: Tag,        adminOnly: true },
      { id: "dolar",            label: "Dólar y margen",  icon: DollarSign, adminOnly: true },
      { id: "envios",           label: "Envíos",          icon: Truck,      adminOnly: true },
      { id: "transferencia",    label: "Transferencia y medios", icon: Handshake, adminOnly: true },
      { id: "price_agreements", label: "Acuerdos Precio", icon: Handshake,  adminOnly: true },
      { id: "supplier_sync",    label: "Sync",            icon: Wifi,       adminOnly: true },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: Activity,
    items: [
      { id: "admin_management", label: "Administradores", icon: ShieldAlert, adminOnly: true },
      { id: "webhooks",         label: "Webhooks",        icon: Globe,       adminOnly: true },
      { id: "activity",         label: "Actividad",       icon: Activity,    adminOnly: true },
    ],
  },
  {
    id: "legal",
    label: "Legal",
    icon: ShieldCheck,
    items: [
      { id: "arrepentimientos", label: "Arrepentimientos", icon: RotateCcw, manageOrders: true },
      { id: "textos_legales",   label: "Textos y datos",   icon: FileText,  adminOnly: true },
    ],
  },
];

/** Modo de la tienda: "consumidor" (Teqo) esconde las pestañas del portal mayorista heredado; "mayorista" las muestra. */
export const MODO_TIENDA: "consumidor" | "mayorista" = (import.meta.env.VITE_MODO_TIENDA as string | undefined) === "mayorista" ? "mayorista" : "consumidor";

const TABS_MAYORISTAS = new Set<Tab>([
  "seller_mode", "seller_management", "seller_portfolio", "seller_targets", "seller_activity",
  "credit", "approvals", "registration_requests", "price_agreements", "quotes_admin", "pos", "bundles",
  "business_alerts", "exception_inbox",
]);

export const NAV_MODULES: NavModule[] =
  MODO_TIENDA === "mayorista"
    ? NAV_MODULES_COMPLETOS
    : NAV_MODULES_COMPLETOS.map((modulo) => ({ ...modulo, items: modulo.items.filter((item) => !TABS_MAYORISTAS.has(item.id)) })).filter((modulo) => modulo.items.length > 0);

// ── Lookup helpers ─────────────────────────────────────────────────────────────

export const TAB_TO_MODULE: Record<Tab, ModuleId> = NAV_MODULES.reduce(
  (acc, module) => {
    module.items.forEach((item) => { acc[item.id] = module.id; });
    return acc;
  },
  {} as Record<Tab, ModuleId>,
);

export const ALL_NAV_ITEMS: NavItem[] = NAV_MODULES.flatMap((m) => m.items);

export function getModuleLabel(moduleId: ModuleId): string {
  return NAV_MODULES.find((m) => m.id === moduleId)?.label ?? "";
}

export function getTabLabel(tab: Tab): string {
  return ALL_NAV_ITEMS.find((i) => i.id === tab)?.label ?? "";
}
