import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bell,
  Building2,
  CreditCard,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Save,
  Shield,
  Star,
  Truck,
  UserCog,
  Wrench,
  Sparkles,
  Wallet,
  Receipt,
  Search,
} from "lucide-react";
import { QuoteList } from "@/components/QuoteList";
import { ExpressQuoter } from "@/components/b2b/ExpressQuoter";
import { PaymentsPanel } from "@/components/b2b/PaymentsPanel";
import { AccountDashboard } from "@/components/b2b/AccountDashboard";
import { fetchMyPayments, type PaymentRecord } from "@/lib/api/payments";
import { supabase, type UserProfile } from "@/lib/supabase";
import {
  addClientNote,
  fetchAccountMovements,
  fetchClientNotes,
  fetchClientProfile,
  updateClientProfile,
  type AccountMovement,
  type ClientDetail,
  type ClientNote,
} from "@/lib/api/clientDetail";
import { useCurrency } from "@/context/CurrencyContext";
import type { Invoice } from "@/lib/api/invoices";
import type { PortalOrder } from "@/hooks/useOrders";
import type { Quote } from "@/models/quote";
import type { Product } from "@/models/products";
import type { SavedCart } from "@/lib/savedCarts";
import { extractAccessRecords } from "@/lib/clientAccess";
import {
  convertMoneyAmount,
  formatMoneyAmount,
  formatMoneyInPreferredCurrency,
  getEffectiveInvoiceAmounts,
} from "@/lib/money";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { exportPriceListPDF } from "@/lib/exports";
import { LoyaltyPanel } from "@/components/b2b/LoyaltyPanel";
import { CompanyProfileEditor } from "@/components/b2b/CompanyProfileEditor";
import { NotificationPreferences as NotificationPreferencesPanel } from "@/components/b2b/NotificationPreferences";
import { exportClientOrders, exportClientInvoices, exportClientQuotes, type ExportDateRange } from "@/lib/exportClientData";

type AccountSection =
  | "resumen"
  | "datos"
  | "usuarios"
  | "sucursales"
  | "condiciones"
  | "credito"
  | "documentos"
  | "quotes"
  | "express"
  | "payments"
  | "listas"
  | "notificaciones"
  | "seguridad"
  | "soporte";

interface AccountCenterProps {
  profile: UserProfile;
  sessionEmail?: string;
  orders: PortalOrder[];
  quotes: Quote[];
  invoices: Invoice[];
  favoriteProducts: Product[];
  savedCarts: SavedCart[];
  onNavigateToTab: (tab: "catalog" | "orders" | "quotes" | "invoices") => void;
  onLoadSavedCart: (cart: SavedCart) => void;
  onDeleteSavedCart: (cartId: string) => void;
  // Quotes props
  isDark: boolean;
  onLoadQuote: (quote: Quote) => void;
  onUpdateQuoteStatus: (id: number, status: Quote["status"]) => void;
  onDeleteQuote: (id: number) => void;
  onDuplicateQuote: (id: number) => void;
  onConvertQuoteToOrder: (quote: Quote) => void;
  // Express Quoter props
  products: Product[];
  onAddToCart: (product: Product, quantity: number) => void;
}

const SECTIONS: Array<{ id: AccountSection; label: string }> = [
  { id: "resumen", label: "Resumen" },
  { id: "datos", label: "Datos fiscales" },
  { id: "usuarios", label: "Contactos y usuarios" },
  { id: "sucursales", label: "Direcciones y sucursales" },
  { id: "condiciones", label: "Condiciones comerciales" },
  { id: "credito", label: "Crédito y cuenta" },
  { id: "documentos", label: "Documentación" },
  { id: "quotes", label: "Cotizaciones" },
  { id: "express", label: "Solicitud guiada" },
  { id: "payments", label: "Pagos y comprobantes" },
  { id: "listas", label: "Listas guardadas" },
  { id: "notificaciones", label: "Notificaciones" },
  { id: "seguridad", label: "Seguridad" },
  { id: "soporte", label: "Soporte y postventa" },
];

const SECTION_GROUPS: Array<{ label: string; items: AccountSection[] }> = [
  { label: "Operacion", items: ["resumen", "quotes", "express", "listas", "soporte"] },
  { label: "Finanzas", items: ["payments", "documentos", "credito", "condiciones"] },
  { label: "Cuenta", items: ["datos", "usuarios", "sucursales", "notificaciones", "seguridad"] },
];

type NotificationPreferences = {
  invoiceDueAlerts: boolean;
  orderStatusAlerts: boolean;
  weeklySummary: boolean;
  stockAlerts: boolean;
};

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  invoiceDueAlerts: true,
  orderStatusAlerts: true,
  weeklySummary: false,
  stockAlerts: false,
};

function getNotificationPreferencesKey(userId: string) {
  return `b2b_notification_preferences_${userId}`;
}

function readNotificationPreferences(userId: string): NotificationPreferences {
  try {
    const raw = localStorage.getItem(getNotificationPreferencesKey(userId));
    if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(JSON.parse(raw) as Partial<NotificationPreferences>),
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

function formatTicketLabel(note: ClientNote) {
  const match = note.body.match(/^\[PORTAL:([A-Z_]+)\]\s*/);
  const label = match?.[1]?.replace(/_/g, " ") ?? note.tipo;
  return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
}

function stripTicketPrefix(value: string) {
  return value.replace(/^\[PORTAL:[A-Z_]+\]\s*/i, "");
}

function daysUntil(date: string) {
  const now = new Date();
  const target = new Date(date);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function AccountCenter({
  profile,
  sessionEmail,
  orders,
  quotes,
  invoices,
  favoriteProducts,
  savedCarts,
  onNavigateToTab,
  onLoadSavedCart,
  onDeleteSavedCart,
  isDark,
  onLoadQuote,
  onUpdateQuoteStatus,
  onDeleteQuote,
  onDuplicateQuote,
  onConvertQuoteToOrder,
  products,
  onAddToCart,
}: AccountCenterProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currency, exchangeRate } = useCurrency();
  const [activeSection, setActiveSection] = useState<AccountSection>(() => {
    const section = searchParams.get("section") as AccountSection;
    return (SECTIONS.some(s => s.id === section) ? section : "resumen") as AccountSection;
  });

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [assignedSeller, setAssignedSeller] = useState<{ name: string; email: string; phone?: string } | undefined>();

  useEffect(() => {
    fetchMyPayments().then(setPayments).catch(console.error);

    const sellerId = profile.assigned_seller_id ?? profile.vendedor_id;
    if (sellerId) {
      supabase
        .from("profiles")
        .select("company_name, contact_name, email, phone")
        .eq("id", sellerId)
        .single()
        .then(({ data }) => {
          if (data) {
            setAssignedSeller({
              name: data.company_name || data.contact_name || "Vendedor Bartez",
              email: data.email || "ventas@bartez.com.ar",
              phone: data.phone
            });
          }
        });
    } else {
      setAssignedSeller(undefined);
    }
  }, [profile.assigned_seller_id, profile.vendedor_id]);

  useEffect(() => {
    const section = searchParams.get("section") as AccountSection;
    if (section && SECTIONS.some(s => s.id === section) && section !== activeSection) {
      setActiveSection(section);
    }
  }, [searchParams, activeSection]);

  function handleSectionChange(section: AccountSection) {
    setActiveSection(section);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("section", section);
      return next;
    }, { replace: true });
  }
  const [clientDetail, setClientDetail] = useState<ClientDetail | null>(null);
  const [movements, setMovements] = useState<AccountMovement[]>([]);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [securityMessage, setSecurityMessage] = useState("");
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(() =>
    readNotificationPreferences(profile.id)
  );
  const [exportDateRange, setExportDateRange] = useState<ExportDateRange>("all");
  const [supportCategory, setSupportCategory] = useState("CONSULTA");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSaving, setSupportSaving] = useState(false);
  const [form, setForm] = useState({
    company_name: profile.company_name ?? "",
    contact_name: profile.contact_name ?? "",
    razon_social: "",
    cuit: "",
    phone: "",
    direccion: "",
    ciudad: "",
    provincia: "",
  });

  useEffect(() => {
    localStorage.setItem(
      getNotificationPreferencesKey(profile.id),
      JSON.stringify(notificationPreferences)
    );
  }, [notificationPreferences, profile.id]);

  useEffect(() => {
    let active = true;

    async function loadCoreData() {
      setLoading(true);
      try {
        const detail = await fetchClientProfile(profile.id);
        if (!active) return;
        setClientDetail(detail);
        setForm({
          company_name: detail.company_name ?? "",
          contact_name: detail.contact_name ?? "",
          razon_social: detail.razon_social ?? "",
          cuit: detail.cuit ?? "",
          phone: detail.phone ?? "",
          direccion: detail.direccion ?? "",
          ciudad: detail.ciudad ?? "",
          provincia: detail.provincia ?? "",
        });
      } catch (error) {
        if (!active) return;
        setSaveError(error instanceof Error ? error.message : "No se pudo cargar la cuenta.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCoreData();
    return () => {
      active = false;
    };
  }, [profile.id]);

  useEffect(() => {
    if (activeSection !== "credito") return;
    if (movements.length > 0) return;
    void fetchAccountMovements(profile.id, 50).then(setMovements).catch(() => {});
  }, [activeSection, profile.id, movements.length]);

  useEffect(() => {
    if (activeSection !== "soporte") return;
    if (notes.length > 0) return;
    void fetchClientNotes(profile.id).then(setNotes).catch(() => {});
  }, [activeSection, profile.id, notes.length]);

  const distinctAddresses = useMemo(() => {
    const current = clientDetail?.direccion
      ? [`${clientDetail.direccion}${clientDetail.ciudad ? `, ${clientDetail.ciudad}` : ""}${clientDetail.provincia ? `, ${clientDetail.provincia}` : ""}`]
      : [];
    const shippingAddresses = orders
      .map((order) => order.shipping_address)
      .filter((value): value is string => Boolean(value?.trim()));
    return Array.from(new Set([...current, ...shippingAddresses]));
  }, [clientDetail?.ciudad, clientDetail?.direccion, clientDetail?.provincia, orders]);

  const supportNotes = useMemo(
    () => notes.filter((note) => note.body.startsWith("[PORTAL:") || ["alerta", "seguimiento"].includes(note.tipo)),
    [notes]
  );
  const accessRecords = useMemo(() => extractAccessRecords(notes), [notes]);

  const pendingInvoices = useMemo(
    () => invoices.filter((invoice) => ["draft", "sent", "overdue"].includes(invoice.status)),
    [invoices]
  );

  const overdueInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.status === "overdue"),
    [invoices]
  );

  const nextDueInvoice = useMemo(() => {
    return pendingInvoices
      .filter((invoice) => invoice.due_date)
      .sort((a, b) => new Date(a.due_date ?? "").getTime() - new Date(b.due_date ?? "").getTime())[0] ?? null;
  }, [pendingInvoices]);

  const pendingDebt = useMemo(
    () =>
      pendingInvoices.reduce((sum, invoice) => {
        const effective = getEffectiveInvoiceAmounts(invoice, exchangeRate.rate);
        return sum + convertMoneyAmount(effective.total, effective.currency, currency, exchangeRate.rate);
      }, 0),
    [currency, exchangeRate.rate, pendingInvoices]
  );

  const overdueDebt = useMemo(
    () =>
      overdueInvoices.reduce((sum, invoice) => {
        const effective = getEffectiveInvoiceAmounts(invoice, exchangeRate.rate);
        return sum + convertMoneyAmount(effective.total, effective.currency, currency, exchangeRate.rate);
      }, 0),
    [currency, exchangeRate.rate, overdueInvoices]
  );

  const upcomingPayments = useMemo(() => {
    return pendingInvoices
      .filter((invoice) => invoice.due_date)
      .map((invoice) => {
        const effective = getEffectiveInvoiceAmounts(invoice, exchangeRate.rate);
        return {
          ...invoice,
          effective,
          days: daysUntil(invoice.due_date ?? ""),
        };
      })
      .sort((a, b) => a.days - b.days)
      .slice(0, 4);
  }, [exchangeRate.rate, pendingInvoices]);

  const addressUsage = useMemo(() => {
    const usage = new Map<string, { count: number; lastUsed: string }>();
    orders.forEach((order) => {
      const key = order.shipping_address?.trim();
      if (!key) return;
      const current = usage.get(key);
      if (!current) {
        usage.set(key, { count: 1, lastUsed: order.created_at });
        return;
      }
      usage.set(key, {
        count: current.count + 1,
        lastUsed:
          new Date(order.created_at).getTime() > new Date(current.lastUsed).getTime()
            ? order.created_at
            : current.lastUsed,
      });
    });
    return Array.from(usage.entries())
      .map(([address, value]) => ({ address, ...value }))
      .sort((a, b) => b.count - a.count || new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
  }, [orders]);

  const contactCards = useMemo(
    () => [
      {
        title: "Acceso principal",
        subtitle: sessionEmail || "Sin email visible",
        meta: clientDetail?.contact_name || profile.contact_name || "Contacto principal",
      },
      {
        title: "Facturacion",
        subtitle: clientDetail?.email || sessionEmail || "Mismo contacto principal",
        meta: clientDetail?.razon_social || clientDetail?.company_name || "Sin razon social cargada",
      },
      {
        title: "Logistica",
        subtitle: clientDetail?.phone || "Telefono pendiente",
        meta: distinctAddresses[0] || "Sin direccion principal",
      },
    ],
    [clientDetail?.company_name, clientDetail?.contact_name, clientDetail?.email, clientDetail?.phone, clientDetail?.razon_social, distinctAddresses, profile.contact_name, sessionEmail]
  );

  const summaryMetrics = useMemo(() => {
    const activeOrders = orders.filter((order) => !["delivered", "rejected"].includes(order.status));
    const creditLimit = clientDetail?.credit_limit ?? profile.credit_limit ?? 0;
    const creditUsed = clientDetail?.credit_used ?? 0;
    const creditApproved = clientDetail?.credit_approved ?? false;
    const creditAvailable = Math.max(0, creditLimit - creditUsed);
    const creditValue = !creditApproved
      ? "Crédito desactivado"
      : creditLimit > 0
      ? formatMoneyInPreferredCurrency(creditAvailable, "ARS", currency, exchangeRate.rate, 0)
      : "Sin límite";
    return [
      { label: "Pedidos activos", value: String(activeOrders.length), accent: "text-primary" },
      {
        label: "Facturas pendientes",
        value: formatMoneyAmount(
          pendingInvoices.reduce((sum, invoice) => {
            const effective = getEffectiveInvoiceAmounts(invoice, exchangeRate.rate);
            return sum + convertMoneyAmount(effective.total, effective.currency, currency, exchangeRate.rate);
          }, 0),
          currency,
          0
        ),
        accent: pendingInvoices.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
      },
      {
        label: "Crédito disponible",
        value: creditValue,
        accent: creditApproved ? "text-emerald-400" : "text-muted-foreground",
      },
      { label: "Cotizaciones", value: String(quotes.length), accent: "text-blue-600 dark:text-blue-400" },
    ];
  }, [clientDetail?.credit_approved, clientDetail?.credit_limit, clientDetail?.credit_used, currency, exchangeRate.rate, orders, pendingInvoices, profile.credit_limit, quotes.length]);

  const documentItems = useMemo(() => {
    const invoiceDocs = invoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      type: "Factura",
      label: invoice.invoice_number,
      meta: invoice.due_date ? `Vence ${new Date(invoice.due_date).toLocaleDateString("es-AR")}` : "Sin vencimiento",
      action: invoice.pdf_url ? "Descargar PDF" : invoice.order_id ? "Ir a pedido" : "Ver detalle",
      onAction: () => {
        if (invoice.pdf_url) {
          window.open(invoice.pdf_url, "_blank", "noopener,noreferrer");
        } else if (invoice.order_id) {
          onNavigateToTab("orders");
        } else {
          onNavigateToTab("invoices");
        }
      },
      date: invoice.created_at,
    }));
    const orderDocs = orders.map((order) => ({
      id: `order-${order.id}`,
      type: "Pedido",
      label: order.order_number ?? `#${String(order.id).slice(-6).toUpperCase()}`,
      meta: order.numero_remito ? `Remito ${order.numero_remito}` : "Sin remito",
      action: "Ver pedido",
      onAction: () => onNavigateToTab("orders"),
      date: order.created_at,
    }));
    const quoteDocs = quotes.map((quote) => ({
      id: `quote-${quote.id}`,
      type: "Cotización",
      label: `COT-${String(quote.id).padStart(5, "0")}`,
      meta: quote.status,
      action: "Ver cotización",
      onAction: () => onNavigateToTab("quotes"),
      date: quote.created_at,
    }));

    return [...invoiceDocs, ...orderDocs, ...quoteDocs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [invoices, onNavigateToTab, orders, quotes]);

  function jumpToSupport(category: string, message: string) {
    setSupportCategory(category);
    setSupportMessage(message);
    setActiveSection("soporte");
  }

  async function handleSaveProfile() {
    setSaving(true);
    setSaveError("");
    setSaveSuccess("");
    try {
      await updateClientProfile(profile.id, {
        company_name: form.company_name,
        contact_name: form.contact_name,
        razon_social: form.razon_social,
        cuit: form.cuit,
        phone: form.phone,
        direccion: form.direccion,
        ciudad: form.ciudad,
        provincia: form.provincia,
      });
      setSaveSuccess("Datos actualizados correctamente.");
      const updated = await fetchClientProfile(profile.id);
      setClientDetail(updated);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
      window.setTimeout(() => setSaveSuccess(""), 2500);
    }
  }

  async function handleDownloadStatementPDF() {
    const doc = new jsPDF();
    const title = `Estado de Cuenta - ${clientDetail?.company_name || profile.company_name}`;
    
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(10);
    doc.text(`Fecha: ${new Date().toLocaleDateString("es-AR")}`, 14, 30);
    doc.text(`Cliente: ${profile.contact_name}`, 14, 35);

    const tableData = movements.map((m) => [
      new Date(m.fecha).toLocaleDateString("es-AR"),
      m.tipo.toUpperCase(),
      m.descripcion || "-",
      formatMoneyInPreferredCurrency(m.monto, "ARS", currency, exchangeRate.rate, 2)
    ]);

    autoTable(doc, {
      startY: 45,
      head: [["Fecha", "Tipo", "Descripción", "Monto"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [45, 159, 106] }
    });

    doc.save(`Estado_Cuenta_${profile.id.slice(0, 8)}.pdf`);
  }

  async function handleSendResetLink() {
    if (!sessionEmail) {
      setSecurityMessage("No encontramos un email asociado a esta cuenta.");
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(sessionEmail, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;
      setSecurityMessage(`Enviamos un email de recuperación a ${sessionEmail}.`);
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : "No se pudo enviar el email de recuperación.");
    }
  }

  async function handleCreateSupportRequest() {
    if (!supportMessage.trim()) return;
    setSupportSaving(true);
    try {
      await addClientNote(profile.id, `[PORTAL:${supportCategory}] ${supportMessage.trim()}`, "seguimiento");
      const updatedNotes = await fetchClientNotes(profile.id);
      setNotes(updatedNotes);
      setSupportMessage("");
      setSupportCategory("CONSULTA");
      setActiveSection("soporte");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "No se pudo crear el ticket.");
    } finally {
      setSupportSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-[1680px] rounded-[24px] border border-border/70 bg-card px-6 py-16 shadow-sm">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="animate-spin text-primary" size={22} />
          <span className="text-sm text-muted-foreground">Cargando cuenta...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1680px] space-y-4">
      <div className="rounded-[24px] border border-border/70 bg-card px-5 py-4 shadow-sm">
        <h2 className="text-lg font-bold text-foreground">Mi cuenta</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Centro de cuenta con datos fiscales, credito, documentos y soporte.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryMetrics.map((metric) => (
          <div key={metric.label} className="rounded-[22px] border border-border/70 bg-card px-4 py-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{metric.label}</p>
            <p className={`mt-2 text-xl font-bold ${metric.accent}`}>{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[22px] border border-border/70 bg-card px-4 py-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Prioridades</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => handleSectionChange("quotes")} className="rounded-2xl border border-border/70 bg-background px-3 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5">
              <p className="text-sm font-semibold text-foreground">Cotizaciones</p>
              <p className="mt-1 text-xs text-muted-foreground">Retomá propuestas y convertí a pedido.</p>
            </button>
            <button type="button" onClick={() => handleSectionChange("payments")} className="rounded-2xl border border-border/70 bg-background px-3 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5">
              <p className="text-sm font-semibold text-foreground">Pagos y comprobantes</p>
              <p className="mt-1 text-xs text-muted-foreground">Imputaciones, recibos y movimientos.</p>
            </button>
            <button type="button" onClick={() => handleSectionChange("documentos")} className="rounded-2xl border border-border/70 bg-background px-3 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5">
              <p className="text-sm font-semibold text-foreground">Documentación</p>
              <p className="mt-1 text-xs text-muted-foreground">Facturas, pedidos y archivos recientes.</p>
            </button>
          </div>
        </div>

        <div className="rounded-[22px] border border-border/70 bg-card px-4 py-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Seguimiento financiero</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background px-3 py-3">
              <span className="text-muted-foreground">Deuda pendiente</span>
              <span className="font-semibold text-foreground">{formatMoneyAmount(pendingDebt, currency, 0)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background px-3 py-3">
              <span className="text-muted-foreground">Vencido</span>
              <span className={overdueDebt > 0 ? "font-semibold text-amber-600 dark:text-amber-400" : "font-semibold text-foreground"}>
                {formatMoneyAmount(overdueDebt, currency, 0)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background px-3 py-3">
              <span className="text-muted-foreground">Próximo vencimiento</span>
              <span className="font-semibold text-foreground">
                {nextDueInvoice?.due_date ? new Date(nextDueInvoice.due_date).toLocaleDateString("es-AR") : "Sin pendientes"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-[24px] border border-border/70 bg-card p-2 shadow-sm xl:sticky xl:top-4">
          <div className="space-y-4">
            {SECTION_GROUPS.map((group) => (
              <div key={group.label} className="space-y-1">
                <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{group.label}</p>
                {group.items
                  .map((sectionId) => SECTIONS.find((section) => section.id === sectionId))
                  .filter((section): section is { id: AccountSection; label: string } => Boolean(section))
                  .map((section) => (
                    <button
                      key={section.id}
                      onClick={() => handleSectionChange(section.id)}
                      className={
                        activeSection === section.id
                          ? "w-full rounded-xl bg-primary px-3 py-2 text-left text-sm font-semibold text-primary-foreground transition"
                          : "w-full rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                      }
                    >
                      {section.label}
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </aside>

        <div className="space-y-4">
          {saveError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-destructive">
              {saveError}
            </div>
          )}

          {activeSection === "resumen" && (
            <div className="space-y-6">
              <AccountDashboard
                profile={profile}
                orders={orders}
                quotes={quotes}
                invoices={invoices}
                payments={payments}
                currency={currency}
                exchangeRate={exchangeRate.rate}
                onAction={handleSectionChange}
                onTabChange={onNavigateToTab}
                seller={assignedSeller}
              />
              <LoyaltyPanel
                partnerLevel={profile.partner_level}
                ordersCount={orders.length}
                onGoToAccount={() => handleSectionChange("datos")}
              />
            </div>
          )}

          {activeSection === "quotes" && (
            <div className="space-y-4">
              <QuoteList
                quotes={quotes}
                isDark={isDark}
                onLoad={onLoadQuote}
                onUpdateStatus={onUpdateQuoteStatus}
                onDelete={onDeleteQuote}
                onGoToCatalog={() => onNavigateToTab("catalog")}
                onDuplicate={onDuplicateQuote}
                onConvertToOrder={onConvertQuoteToOrder}
              />
            </div>
          )}

          {activeSection === "express" && (
            <ExpressQuoter
              products={products}
              onAddToCart={onAddToCart}
              isDark={isDark}
            />
          )}

          {activeSection === "payments" && (
            <PaymentsPanel
              profile={profile}
              orders={orders}
              invoices={invoices}
              isDark={isDark}
            />
          )}

          {activeSection === "datos" && (
            <CompanyProfileEditor
              profile={profile}
              initialDetail={clientDetail}
              onSaved={async () => {
                const updated = await fetchClientProfile(profile.id);
                setClientDetail(updated);
              }}
            />
          )}

          {activeSection === "usuarios" && (
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="border border-border/70 bg-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <UserCog size={15} className="text-primary" />
                  <h3 className={`text-sm font-bold text-foreground`}>Contactos visibles</h3>
                </div>
                <div className="space-y-2">
                  {contactCards.map((contact) => (
                    <div key={contact.title} className={`rounded-xl border px-3 py-3 border border-border/70 bg-card`}>
                      <p className={`text-xs font-bold uppercase tracking-wider text-muted-foreground`}>{contact.title}</p>
                      <p className={`text-sm font-semibold mt-1 text-foreground`}>{contact.subtitle}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{contact.meta}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border border-border/70 bg-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Mail size={15} className="text-blue-600 dark:text-blue-400" />
                  <h3 className={`text-sm font-bold text-foreground`}>Gestión de usuarios</h3>
                </div>
                <p className={`text-sm text-muted-foreground`}>
                  Hoy la cuenta muestra un acceso principal. Si necesitás sumar compradores o aprobadores, creanos un ticket desde Soporte y lo dejamos preparado desde el admin.
                </p>
                {accessRecords.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {accessRecords.slice(0, 4).map((access) => (
                      <div key={access.id} className={`rounded-xl border px-3 py-3 border border-border/70 bg-card`}>
                        <p className={`text-sm font-semibold text-foreground`}>{access.fullName}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{access.email}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {access.role}
                          {access.allowedBranches.length > 0 ? ` · ${access.allowedBranches.join(", ")}` : ""}
                          {access.orderLimit > 0 ? ` · límite ${formatMoneyInPreferredCurrency(access.orderLimit, "ARS", currency, exchangeRate.rate, 0)}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => setActiveSection("soporte")} className="mt-3 text-sm text-primary hover:underline">
                  Solicitar alta de usuario
                </button>
                <div className="space-y-2 mt-3">
                  {[
                    ["Solicitar comprador", "ACCESOS", "Necesito dar de alta un nuevo comprador para la cuenta."],
                    ["Solicitar aprobador", "ACCESOS", "Necesito sumar un aprobador para pedidos o creditos."],
                    ["Cambiar email principal", "ACCESOS", "Necesito actualizar el email principal de acceso o facturacion."],
                  ].map(([label, category, message]) => (
                    <button key={label} onClick={() => jumpToSupport(category, message)} className="block w-full text-left text-sm text-primary hover:underline">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === "sucursales" && (
            <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
              <div className="border border-border/70 bg-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={15} className="text-amber-600 dark:text-amber-400" />
                  <h3 className={`text-sm font-bold text-foreground`}>Dirección principal</h3>
                </div>
                <p className={`text-sm text-muted-foreground`}>
                  {distinctAddresses[0] || "Todavía no registramos una dirección principal."}
                </p>
                <div className="space-y-2 mt-4">
                  <button onClick={() => setActiveSection("datos")} className="block text-sm text-primary hover:underline">
                    Actualizar direccion fiscal
                  </button>
                  <button onClick={() => jumpToSupport("LOGISTICA", "Necesito agregar o modificar una direccion/sucursal de entrega para la cuenta.")} className="block text-sm text-primary hover:underline">
                    Solicitar nueva sucursal o destino
                  </button>
                </div>
              </div>
              <div className="border border-border/70 bg-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Truck size={15} className="text-blue-600 dark:text-blue-400" />
                  <h3 className={`text-sm font-bold text-foreground`}>Sucursales usadas</h3>
                </div>
                {addressUsage.length > 0 ? (
                  <div className="space-y-2">
                    {addressUsage.map((address) => (
                      <div key={address.address} className={`rounded-xl border px-3 py-3 border border-border/70 text-muted-foreground`}>
                        <p className={`text-sm font-medium text-foreground`}>{address.address}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {address.count} envio{address.count === 1 ? "" : "s"} · ultimo uso {new Date(address.lastUsed).toLocaleDateString("es-AR")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay sucursales o direcciones de entrega registradas todavía.</p>
                )}
              </div>
            </div>
          )}

          {activeSection === "condiciones" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="border border-border/70 bg-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard size={15} className="text-primary" />
                  <h3 className={`text-sm font-bold text-foreground`}>Condición comercial</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">Lista: <span className={`font-semibold text-foreground`}>{clientDetail?.precio_lista ?? "standard"}</span></p>
                  <p className="text-muted-foreground">Credito: <span className={`font-semibold text-foreground`}>{clientDetail?.credit_approved ? "Aprobado" : "Desactivado"}</span></p>
                </div>
              </div>
              <div className="border border-border/70 bg-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet size={15} className="text-blue-600 dark:text-blue-400" />
                  <h3 className={`text-sm font-bold text-foreground`}>Términos operativos</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">Pago: <span className={`font-semibold text-foreground`}>{clientDetail?.payment_terms ? `${clientDetail.payment_terms} días` : "Contado"}</span></p>
                  <p className="text-muted-foreground">Máximo por pedido: <span className={`font-semibold text-foreground`}>{clientDetail?.max_order_value ? formatMoneyInPreferredCurrency(clientDetail.max_order_value, "ARS", currency, exchangeRate.rate, 0) : "Sin límite"}</span></p>
                  <p className="text-muted-foreground">Estado de cuenta: <span className={`font-semibold text-foreground`}>{clientDetail?.estado ?? "activo"}</span></p>
                  <p className="text-muted-foreground">Proximo vencimiento: <span className={`font-semibold text-foreground`}>{nextDueInvoice?.due_date ? new Date(nextDueInvoice.due_date).toLocaleDateString("es-AR") : "Sin vencimientos"}</span></p>
                </div>
              </div>
            </div>
          )}

          {activeSection === "credito" && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="border border-border/70 bg-card rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet size={15} className="text-primary" />
                    <h3 className={`text-sm font-bold text-foreground`}>Crédito disponible</h3>
                  </div>
                  <p className={`text-2xl font-extrabold ${clientDetail?.credit_approved ? "text-primary" : "text-muted-foreground"}`}>
                    {!clientDetail?.credit_approved
                      ? "Crédito desactivado"
                      : clientDetail?.credit_limit
                      ? formatMoneyInPreferredCurrency(Math.max(0, clientDetail.credit_limit - clientDetail.credit_used), "ARS", currency, exchangeRate.rate, 0)
                      : "Sin límite"}
                  </p>
                  {clientDetail?.credit_approved && clientDetail?.credit_limit ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Usado {formatMoneyInPreferredCurrency(clientDetail.credit_used, "ARS", currency, exchangeRate.rate, 0)} de {formatMoneyInPreferredCurrency(clientDetail.credit_limit, "ARS", currency, exchangeRate.rate, 0)}
                    </p>
                  ) : clientDetail?.credit_approved ? (
                    <p className="text-xs text-muted-foreground mt-1">No hay límite definido para esta cuenta.</p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Esta cuenta opera sin línea de crédito habilitada.</p>
                  )}
                </div>

                <div className="border border-border/70 bg-card rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CreditCard size={15} className="text-blue-600 dark:text-blue-400" />
                    <h3 className={`text-sm font-bold text-foreground`}>Resumen de cuenta</h3>
                  </div>
                  <p className={`text-sm text-muted-foreground`}>Movimientos registrados: {movements.length}</p>
                  <p className={`text-sm text-muted-foreground`}>Facturas pendientes: {pendingInvoices.length}</p>
                  <p className={`text-sm text-muted-foreground`}>Deuda abierta: {formatMoneyAmount(pendingDebt, currency, 0)}</p>
                  <p className={`text-sm text-muted-foreground`}>Proximo pago: {nextDueInvoice?.due_date ? new Date(nextDueInvoice.due_date).toLocaleDateString("es-AR") : "Sin fecha"}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="border border-border/70 bg-card rounded-2xl p-5">
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 text-muted-foreground`}>Deuda pendiente</p>
                  <p className="text-lg font-extrabold text-amber-600 dark:text-amber-400">{formatMoneyAmount(pendingDebt, currency, 0)}</p>
                </div>
                <div className="border border-border/70 bg-card rounded-2xl p-5">
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 text-muted-foreground`}>Vencido</p>
                  <p className={`text-lg font-extrabold ${overdueInvoices.length > 0 ? "text-destructive" : "text-primary"}`}>{formatMoneyAmount(overdueDebt, currency, 0)}</p>
                </div>
                <div className="border border-border/70 bg-card rounded-2xl p-5">
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 text-muted-foreground`}>Condiciones vigentes</p>
                  <p className={`text-sm font-semibold text-foreground`}>{clientDetail?.payment_terms ? `${clientDetail.payment_terms} dias netos` : "Contado"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{clientDetail?.credit_review_date ? `Revision ${new Date(clientDetail.credit_review_date).toLocaleDateString("es-AR")}` : "Sin revision programada"}</p>
                </div>
              </div>

              <div className="border rounded-2xl overflow-hidden border border-border/70 bg-card">
                <div className="grid grid-cols-[110px_1fr_120px] gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                  <span>Fecha</span>
                  <span>Concepto</span>
                  <span className="text-right">Monto</span>
                </div>
                {movements.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-muted-foreground">Todavía no hay movimientos de cuenta registrados.</p>
                ) : (
                  movements.slice(0, 8).map((movement) => (
                    <div key={movement.id} className={`grid grid-cols-[110px_1fr_120px] gap-2 px-4 py-3 border-t border-border/70`}>
                      <span className="text-xs text-muted-foreground">{new Date(movement.fecha || movement.created_at).toLocaleDateString("es-AR")}</span>
                      <span className={`text-sm text-muted-foreground`}>{movement.descripcion || movement.tipo}</span>
                      <span className={`text-sm text-right font-semibold ${movement.monto >= 0 ? "text-destructive" : "text-emerald-400"}`}>
                        {movement.monto >= 0 ? "" : "-"}{formatMoneyInPreferredCurrency(Math.abs(movement.monto), "ARS", currency, exchangeRate.rate, 0)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeSection === "documentos" && (
            <div className="border rounded-2xl overflow-hidden border border-border/70 bg-card">
              <div className="grid grid-cols-[110px_1fr_160px] gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                <span>Tipo</span>
                <span>Documento</span>
                <span className="text-right">Acción</span>
              </div>
              {documentItems.map((item) => (
                <div key={item.id} className="grid grid-cols-[110px_1fr_160px] gap-2 px-4 py-3 border-t border-border/70 items-center">
                  <span className="text-xs text-muted-foreground">{item.type}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.meta}</p>
                  </div>
                  <div className="text-right">
                    <button onClick={item.onAction} className="text-xs text-primary hover:underline">{item.action}</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSection === "listas" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="border border-border/70 bg-card rounded-2xl p-5 col-span-full">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-primary" />
                    <h3 className="text-sm font-bold text-foreground">Lista de precios</h3>
                  </div>
                  {favoriteProducts.length > 0 && (
                    <button
                      onClick={() =>
                        exportPriceListPDF(
                          favoriteProducts,
                          (v) => formatMoneyAmount(v, currency, 2),
                          currency,
                          profile.company_name || profile.contact_name || "Cliente",
                        )
                      }
                      className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                      Descargar PDF
                    </button>
                  )}
                </div>
                {favoriteProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Marcá productos como favoritos para generar tu lista de precios personalizada.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">{favoriteProducts.length} productos en tu lista. Hacé clic en "Descargar PDF" para exportarla.</p>
                )}
              </div>
              <div className="border border-border/70 bg-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Star size={15} className="text-yellow-500" />
                  <h3 className={`text-sm font-bold text-foreground`}>Favoritos</h3>
                </div>
                {favoriteProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Todavía no marcaste productos favoritos.</p>
                ) : (
                  <div className="space-y-2">
                    {favoriteProducts.slice(0, 8).map((product) => (
                      <div key={product.id} className="rounded-xl border border-border/70 bg-card px-3 py-2">
                        <p className="text-sm font-medium text-foreground">{product.name}</p>
                        <p className="text-[11px] text-muted-foreground">{product.sku || product.category}</p>
                      </div>
                    ))}
                    <button onClick={() => onNavigateToTab("catalog")} className="text-sm text-primary hover:underline">
                      Ver catálogo completo
                    </button>
                  </div>
                )}
              </div>

              <div className="border border-border/70 bg-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={15} className="text-blue-600 dark:text-blue-400" />
                  <h3 className={`text-sm font-bold text-foreground`}>Carritos guardados</h3>
                </div>
                {savedCarts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay carritos guardados todavía.</p>
                ) : (
                  <div className="space-y-2">
                    {savedCarts.map((cart) => (
                      <div key={cart.id} className="rounded-xl border border-border/70 bg-card px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate text-foreground">{cart.name}</p>
                            <p className="text-[11px] text-muted-foreground">{Object.keys(cart.items).length} SKU</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => onLoadSavedCart(cart)} className="text-xs text-primary hover:underline">Cargar</button>
                            <button onClick={() => onDeleteSavedCart(cart.id)} className="text-xs text-destructive hover:underline">Eliminar</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === "notificaciones" && (
            <div className="space-y-4">
              <NotificationPreferencesPanel profileId={profile.id} />

              {/* Export section */}
              <div className="border border-border/70 bg-card rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Mail size={15} className="text-blue-600 dark:text-blue-400" />
                  <h3 className="text-sm font-bold text-foreground">Exportar mis datos</h3>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-muted-foreground">Período:</span>
                  {(["3m", "6m", "1y", "all"] as ExportDateRange[]).map((range) => {
                    const label = range === "3m" ? "3 meses" : range === "6m" ? "6 meses" : range === "1y" ? "1 año" : "Todo";
                    return (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setExportDateRange(range)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          exportDateRange === range
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border/70 bg-card text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => exportClientOrders(orders, exportDateRange)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-card px-4 py-2 text-sm text-foreground transition hover:border-primary/30 hover:bg-primary/5"
                  >
                    Pedidos (.csv)
                  </button>
                  <button
                    type="button"
                    onClick={() => exportClientInvoices(invoices, exportDateRange)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-card px-4 py-2 text-sm text-foreground transition hover:border-primary/30 hover:bg-primary/5"
                  >
                    Facturas (.csv)
                  </button>
                  <button
                    type="button"
                    onClick={() => exportClientQuotes(quotes, exportDateRange)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-card px-4 py-2 text-sm text-foreground transition hover:border-primary/30 hover:bg-primary/5"
                  >
                    Cotizaciones (.csv)
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === "seguridad" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="border border-border/70 bg-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={15} className="text-primary" />
                  <h3 className={`text-sm font-bold text-foreground`}>Acceso al portal</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">Email de acceso: <span className={`font-semibold text-foreground`}>{sessionEmail || "No disponible"}</span></p>
                  <p className="text-muted-foreground">Rol actual: <span className={`font-semibold text-foreground`}>{profile.role}</span></p>
                  <p className="text-muted-foreground">Estado: <span className={`font-semibold text-foreground`}>{profile.active === false ? "Bloqueado" : "Activo"}</span></p>
                </div>
                <button onClick={handleSendResetLink} className="mt-4 text-sm text-primary hover:underline">
                  Enviar email para cambiar contraseña
                </button>
                <button onClick={() => jumpToSupport("ACCESOS", "Necesito revisar permisos, roles o politica de acceso de la cuenta.")} className="mt-2 block text-sm text-primary hover:underline">
                  Solicitar revision de permisos
                </button>
                {securityMessage && <p className="text-xs text-muted-foreground mt-2">{securityMessage}</p>}
              </div>

              <div className="border border-border/70 bg-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Wrench size={15} className="text-blue-600 dark:text-blue-400" />
                  <h3 className={`text-sm font-bold text-foreground`}>Gestión adicional</h3>
                </div>
                <p className={`text-sm text-muted-foreground`}>
                  Si necesitás cambiar email, sumar aprobadores o revisar permisos comerciales, pedilo desde Soporte y lo atendemos desde el admin.
                </p>
              </div>
            </div>
          )}

          {activeSection === "soporte" && (
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="border border-border/70 bg-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Wrench size={15} className="text-primary" />
                  <h3 className={`text-sm font-bold text-foreground`}>Nuevo ticket</h3>
                </div>
                <div className="space-y-3">
                  <select value={supportCategory} onChange={(event) => setSupportCategory(event.target.value)} className={`w-full rounded-lg border px-3 py-2 text-sm outline-none bg-card border border-border/70 text-foreground`}>
                    <option value="CONSULTA">Consulta general</option>
                    <option value="FACTURACION">Facturación</option>
                    <option value="LOGISTICA">Logística</option>
                    <option value="RMA">RMA / postventa</option>
                    <option value="ACCESOS">Accesos y usuarios</option>
                  </select>
                  <textarea rows={5} value={supportMessage} onChange={(event) => setSupportMessage(event.target.value)} placeholder="Contanos qué necesitás resolver, número de pedido/factura y contexto." className="w-full rounded-lg border border-border/70 px-3 py-2 text-sm outline-none resize-none bg-card text-foreground placeholder:text-muted-foreground" />
                  <button onClick={handleCreateSupportRequest} disabled={supportSaving || !supportMessage.trim()} className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                    {supportSaving ? <Loader2 size={13} className="animate-spin" /> : <Wrench size={13} />}
                    {supportSaving ? "Creando..." : "Crear ticket"}
                  </button>
                </div>
              </div>

              <div className={`border rounded-2xl overflow-hidden border border-border/70 bg-card`}>
                <div className={`px-4 py-3 border-b border-border/70`}>
                  <h3 className={`text-sm font-bold text-foreground`}>Tickets abiertos</h3>
                </div>
                {supportNotes.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-muted-foreground">TodavÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­a no hay tickets cargados desde el portal.</p>
                ) : (
                  <div className="space-y-0">
                    {supportNotes.slice(0, 8).map((note) => (
                      <div key={note.id} className={`px-4 py-3 border-t border-border/70`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{formatTicketLabel(note)}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(note.created_at).toLocaleDateString("es-AR")}</span>
                        </div>
                        <p className={`text-sm mt-1 text-muted-foreground`}>{stripTicketPrefix(note.body)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


















