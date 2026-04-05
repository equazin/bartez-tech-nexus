import { useEffect, useMemo, useState } from "react";
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
  Wallet,
  Wrench,
} from "lucide-react";
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

type AccountSection =
  | "Dirección"
  | "datos"
  | "usuarios"
  | "sucursales"
  | "condiciones"
  | "credito"
  | "documentos"
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
  onGoToTab: (tab: "catalog" | "orders" | "quotes" | "invoices") => void;
  onLoadSavedCart: (cart: SavedCart) => void;
  onDeleteSavedCart: (cartId: string) => void;
}

const SECTIONS: Array<{ id: AccountSection; label: string }> = [
  { id: "resumen", label: "Resumen" },
  { id: "datos", label: "Datos fiscales" },
  { id: "usuarios", label: "Contactos y usuarios" },
  { id: "sucursales", label: "Direcciones y sucursales" },
  { id: "condiciones", label: "Condiciones comerciales" },
  { id: "credito", label: "Crédito y cuenta" },
  { id: "documentos", label: "Documentación" },
  { id: "listas", label: "Listas guardadas" },
  { id: "notificaciones", label: "Notificaciones" },
  { id: "seguridad", label: "Seguridad" },
  { id: "soporte", label: "Soporte y postventa" },
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
  onGoToTab,
  onLoadSavedCart,
  onDeleteSavedCart,
}: AccountCenterProps) {
  const { currency, exchangeRate } = useCurrency();
  const [activeSection, setActiveSection] = useState<AccountSection>("resumen");
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
        value: creditLimit > 0 ? formatMoneyInPreferredCurrency(Math.max(0, creditLimit - creditUsed), "ARS", currency, exchangeRate.rate, 0) : "Sin límite",
        accent: "text-emerald-400",
      },
      { label: "Cotizaciones", value: String(quotes.length), accent: "text-blue-600 dark:text-blue-400" },
    ];
  }, [clientDetail?.credit_limit, clientDetail?.credit_used, currency, exchangeRate.rate, orders, pendingInvoices, profile.credit_limit, quotes.length]);

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
          onGoToTab("orders");
        } else {
          onGoToTab("invoices");
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
      onAction: () => onGoToTab("orders"),
      date: order.created_at,
    }));
    const quoteDocs = quotes.map((quote) => ({
      id: `quote-${quote.id}`,
      type: "Cotización",
      label: `COT-${String(quote.id).padStart(5, "0")}`,
      meta: quote.status,
      action: "Ver cotización",
      onAction: () => onGoToTab("quotes"),
      date: quote.created_at,
    }));

    return [...invoiceDocs, ...orderDocs, ...quoteDocs]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [invoices, onGoToTab, orders, quotes]);

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

      <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-[24px] border border-border/70 bg-card p-2 shadow-sm xl:sticky xl:top-4">
          <div className="space-y-1">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={
                  activeSection === section.id
                    ? "w-full text-left px-3 py-2 rounded-xl text-sm transition bg-primary text-primary-foreground font-semibold"
                    : "w-full text-left px-3 py-2 rounded-xl text-sm transition text-muted-foreground hover:text-foreground hover:bg-secondary"
                }
              >
                {section.label}
              </button>
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
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {summaryMetrics.map((metric) => (
                  <div key={metric.label} className={"border border-border/70 bg-card rounded-xl px-4 py-3"}>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{metric.label}</p>
                    <p className={`text-lg font-bold ${metric.accent}`}>{metric.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="border border-border/70 bg-card rounded-2xl p-5">
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 text-muted-foreground`}>Deuda pendiente</p>
                  <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{formatMoneyAmount(pendingDebt, currency, 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{pendingInvoices.length} documento{pendingInvoices.length === 1 ? "" : "s"} por cobrar</p>
                </div>

                <div className="border border-border/70 bg-card rounded-2xl p-5">
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 text-muted-foreground`}>Proximo vencimiento</p>
                  {nextDueInvoice ? (
                    <>
                      <p className="text-xl font-extrabold text-primary">{new Date(nextDueInvoice.due_date ?? "").toLocaleDateString("es-AR")}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {daysUntil(nextDueInvoice.due_date ?? "") <= 0 ? "Vence hoy o esta vencida" : `En ${daysUntil(nextDueInvoice.due_date ?? "")} dias`}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className={`text-xl font-extrabold text-foreground`}>Sin alertas</p>
                      <p className="text-xs text-muted-foreground mt-1">No hay vencimientos pendientes cargados.</p>
                    </>
                  )}
                </div>

                <div className="border border-border/70 bg-card rounded-2xl p-5">
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 text-muted-foreground`}>Facturas vencidas</p>
                  <p className={`text-xl font-extrabold ${overdueInvoices.length > 0 ? "text-destructive" : "text-primary"}`}>
                    {overdueInvoices.length}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {overdueInvoices.length > 0 ? formatMoneyAmount(overdueDebt, currency, 0) : "Sin deuda vencida"}
                  </p>
                </div>

                <div className="border border-border/70 bg-card rounded-2xl p-5">
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 text-muted-foreground`}>Condiciones vigentes</p>
                  <p className={`text-sm font-semibold text-foreground`}>
                    {clientDetail?.payment_terms ? `${clientDetail.payment_terms} dias` : "Contado"} · {clientDetail?.precio_lista ?? "standard"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {clientDetail?.credit_approved ? "Credito aprobado" : "Credito sujeto a revision"}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="border border-border/70 bg-card rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 size={15} className="text-primary" />
                    <h3 className={`text-sm font-bold text-foreground`}>Cuenta comercial</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      Empresa: <span className={`font-semibold text-foreground`}>{clientDetail?.company_name || profile.company_name}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Contacto principal: <span className={`font-semibold text-foreground`}>{clientDetail?.contact_name || profile.contact_name}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Tipo de cliente: <span className={`font-semibold text-foreground`}>{clientDetail?.client_type || profile.client_type}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Estado comercial: <span className={`font-semibold text-foreground`}>{clientDetail?.estado ?? "activo"}</span>
                    </p>
                  </div>
                </div>

                <div className="border border-border/70 bg-card rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Wallet size={15} className="text-blue-600 dark:text-blue-400" />
                    <h3 className={`text-sm font-bold text-foreground`}>Próximos focos</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <button onClick={() => setActiveSection("documentos")} className="text-left text-primary hover:underline">
                      Revisar documentación disponible
                    </button>
                    <button onClick={() => setActiveSection("credito")} className="text-left text-primary hover:underline">
                      Ver crédito y movimientos de cuenta
                    </button>
                    <button onClick={() => setActiveSection("listas")} className="text-left text-primary hover:underline">
                      Administrar favoritos y carritos guardados
                    </button>
                    <button onClick={() => jumpToSupport("ACCESOS", "Necesito sumar o ajustar usuarios/compradores en el portal.")} className="text-left text-primary hover:underline">
                      Pedir cambios de usuarios y permisos
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="border border-border/70 bg-card rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <div>
                      <h3 className={`text-sm font-bold text-foreground`}>Proximos pagos y alertas</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Vencimientos y seguimiento financiero de corto plazo.</p>
                    </div>
                    <button onClick={() => onGoToTab("invoices")} className="text-xs text-primary hover:underline">
                      Ir a facturas
                    </button>
                  </div>
                  {upcomingPayments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay vencimientos proximos registrados.</p>
                  ) : (
                    <div className="space-y-2">
                      {upcomingPayments.map((invoice) => (
                        <div key={invoice.id} className={`rounded-xl border px-3 py-3 border border-border/70 bg-card`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className={`text-sm font-semibold text-foreground`}>{invoice.invoice_number}</p>
                              <p className="text-xs text-muted-foreground">
                                {invoice.days <= 0 ? "Vencimiento inmediato" : `Vence en ${invoice.days} dias`} · {new Date(invoice.due_date ?? "").toLocaleDateString("es-AR")}
                              </p>
                            </div>
                            <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                              {formatMoneyInPreferredCurrency(invoice.effective.total, invoice.effective.currency, currency, exchangeRate.rate, 0)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border border-border/70 bg-card rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <div>
                      <h3 className={`text-sm font-bold text-foreground`}>Acciones rapidas</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Gestiona datos, accesos y operaciones frecuentes.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Editar datos", action: () => setActiveSection("datos") },
                      { label: "Usuarios", action: () => setActiveSection("usuarios") },
                      { label: "Direcciones", action: () => setActiveSection("sucursales") },
                      { label: "Credito", action: () => setActiveSection("credito") },
                      { label: "Pedidos", action: () => onGoToTab("orders") },
                      { label: "Facturas", action: () => onGoToTab("invoices") },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={item.action}
                        className="rounded-xl border border-border/70 bg-card px-3 py-3 text-sm text-left text-muted-foreground transition hover:text-foreground hover:bg-secondary"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeSection === "datos" && (
            <div className="border border-border/70 bg-card rounded-2xl p-5">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { key: "company_name", label: "Empresa / nombre" },
                  { key: "contact_name", label: "Contacto principal" },
                  { key: "razon_social", label: "Razón social" },
                  { key: "cuit", label: "CUIT" },
                  { key: "phone", label: "Teléfono" },
                  { key: "direccion", label: "Dirección" },
                  { key: "ciudad", label: "Ciudad" },
                  { key: "provincia", label: "Provincia" },
                ].map((field) => (
                  <label key={field.key} className="space-y-1">
                    <span className={`text-xs text-muted-foreground`}>{field.label}</span>
                    <input
                      value={form[field.key as keyof typeof form]}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          [field.key]: event.target.value,
                        }))
                      }
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none bg-card border border-border/70 text-foreground`}
                    />
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-3 mt-5">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
                {saveSuccess && <span className="text-xs text-emerald-400">{saveSuccess}</span>}
              </div>
            </div>
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
                  <p className="text-muted-foreground">Tipo de cliente: <span className={`font-semibold text-foreground`}>{clientDetail?.client_type || profile.client_type}</span></p>
                  <p className="text-muted-foreground">Lista: <span className={`font-semibold text-foreground`}>{clientDetail?.precio_lista ?? "standard"}</span></p>
                  <p className="text-muted-foreground">Credito: <span className={`font-semibold text-foreground`}>{clientDetail?.credit_approved ? "Aprobado" : "En revision"}</span></p>
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
                  <p className="text-2xl font-extrabold text-primary">
                    {clientDetail?.credit_limit
                      ? formatMoneyInPreferredCurrency(Math.max(0, clientDetail.credit_limit - clientDetail.credit_used), "ARS", currency, exchangeRate.rate, 0)
                      : "Sin límite"}
                  </p>
                  {clientDetail?.credit_limit ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Usado {formatMoneyInPreferredCurrency(clientDetail.credit_used, "ARS", currency, exchangeRate.rate, 0)} de {formatMoneyInPreferredCurrency(clientDetail.credit_limit, "ARS", currency, exchangeRate.rate, 0)}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">No hay límite definido para esta cuenta.</p>
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
                    <button onClick={() => onGoToTab("catalog")} className="text-sm text-primary hover:underline">
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
            <div className="grid gap-4 md:grid-cols-2">
              <div className="border border-border/70 bg-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Bell size={15} className="text-primary" />
                  <h3 className={`text-sm font-bold text-foreground`}>Preferencias</h3>
                </div>
                <div className="space-y-3">
                  {[
                    ["invoiceDueAlerts", "Alertas de vencimiento de facturas"],
                    ["orderStatusAlerts", "Alertas por cambios de estado de pedidos"],
                    ["weeklySummary", "Resumen semanal"],
                    ["stockAlerts", "Avisos de reposición y stock"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between gap-3">
                      <span className={`text-sm text-muted-foreground`}>{label}</span>
                      <button
                        onClick={() => setNotificationPreferences((prev) => ({ ...prev, [key]: !prev[key as keyof NotificationPreferences] }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationPreferences[key as keyof NotificationPreferences] ? "bg-primary" : "bg-muted"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationPreferences[key as keyof NotificationPreferences] ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border border-border/70 bg-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Mail size={15} className="text-blue-600 dark:text-blue-400" />
                  <h3 className={`text-sm font-bold text-foreground`}>Resumen visible</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">Facturas vencidas: <span className="font-semibold text-destructive">{invoices.filter((invoice) => invoice.status === "overdue").length}</span></p>
                  <p className="text-muted-foreground">Pedidos activos: <span className="font-semibold text-primary">{orders.filter((order) => !["delivered", "rejected"].includes(order.status)).length}</span></p>
                  <p className="text-muted-foreground">Tickets abiertos: <span className="font-semibold text-blue-600 dark:text-blue-400">{supportNotes.length}</span></p>
                  <p className="text-muted-foreground">Usuarios delegados: <span className="font-semibold text-emerald-400">{accessRecords.length}</span></p>
                  <p className="text-muted-foreground">Proximo vencimiento: <span className={`font-semibold text-foreground`}>{nextDueInvoice?.due_date ? new Date(nextDueInvoice.due_date).toLocaleDateString("es-AR") : "Sin fecha"}</span></p>
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


















