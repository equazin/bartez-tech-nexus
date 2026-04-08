import {
  LayoutDashboard, Package, Download, Tag, Image, Flame, Truck, DollarSign,
  ClipboardList, Layers, CheckCircle2, MessageSquare, Users, UserPlus,
  CreditCard, Bell, FileText, BarChart2, Building2, Bookmark, Wifi,
  ShieldCheck, ShieldAlert, History, ShoppingBag, RotateCcw, Handshake, LifeBuoy,
  Ticket, Globe, Activity, type LucideIcon,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Tab =
  | "dashboard"
  | "products" | "imports" | "categories" | "images" | "opportunities" | "pos"
  | "orders" | "kanban" | "approvals" | "quotes_admin" | "registration_requests"
  | "seller_mode" | "seller_management" | "seller_portfolio" | "seller_targets" | "seller_activity"
  | "clients" | "users_permissions" | "credit" | "business_alerts" | "documents" | "support"
  | "invoices" | "reports"
  | "suppliers" | "brands" | "pricing" | "supplier_sync" | "stock" | "serials"
  | "movements" | "purchase_orders" | "rma" | "price_agreements" | "marketing" | "webhooks" | "activity" | "admin_management";

export type ModuleId = "top" | "catalogo" | "pedidos" | "vendedores" | "clientes" | "finanzas" | "sistema";

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

export const NAV_MODULES: NavModule[] = [
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
    id: "pedidos",
    label: "Ventas",
    icon: ClipboardList,
    items: [
      { id: "quotes_admin", label: "Cotizaciones", icon: MessageSquare, adminOnly: true },
      { id: "orders",       label: "Pedidos",      icon: ClipboardList, manageOrders: true },
      { id: "kanban",       label: "Kanban",       icon: Layers,        manageOrders: true },
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
    id: "sistema",
    label: "Sistema",
    icon: Activity,
    items: [
      { id: "admin_management", label: "Administradores",  icon: ShieldAlert, adminOnly: true },
      { id: "suppliers",       label: "Proveedores",     icon: Building2,  adminOnly: true },
      { id: "brands",          label: "Marcas",          icon: Bookmark,   adminOnly: true },
      { id: "pricing",         label: "Precios",         icon: Tag,        adminOnly: true },
      { id: "supplier_sync",   label: "Sync",            icon: Wifi,       adminOnly: true },
      { id: "stock",           label: "Stock",           icon: Layers,     adminOnly: true },
      { id: "serials",         label: "Números Serie",   icon: ShieldCheck, adminOnly: true },
      { id: "movements",       label: "Movimientos",     icon: History,    adminOnly: true },
      { id: "purchase_orders", label: "Órdenes Compra",  icon: ShoppingBag, adminOnly: true },
      { id: "rma",             label: "Devoluciones",    icon: RotateCcw,  adminOnly: true },
      { id: "price_agreements", label: "Acuerdos Precio", icon: Handshake, adminOnly: true },
      { id: "support",         label: "Soporte",         icon: LifeBuoy,   adminOnly: true },
      { id: "marketing",       label: "Marketing",       icon: Ticket,     adminOnly: true },
      { id: "webhooks",        label: "Webhooks",        icon: Globe,      adminOnly: true },
      { id: "activity",        label: "Actividad",       icon: Activity,   adminOnly: true },
    ],
  },
];

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
