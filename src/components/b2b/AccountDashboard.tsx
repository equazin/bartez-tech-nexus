import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Package,
  Receipt,
  Wallet,
  FileText,
  Sparkles,
  MessageSquare,
  History,
  TrendingUp,
  Clock,
  ArrowRight,
  ShieldCheck,
  Phone,
  Mail,
  User,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import { MetricCard } from "@/components/ui/metric-card";
import { generateWhatsAppDirectUrl } from "@/lib/api/whatsapp";
import { formatMoneyAmount } from "@/lib/money";
import type { PortalOrder } from "@/hooks/useOrders";
import type { Invoice } from "@/lib/api/invoices";
import type { Quote } from "@/models/quote";
import type { PaymentRecord } from "@/lib/api/payments";
import type { UserProfile } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";

const EXPIRY_WARN_DAYS = 30;

interface AccountDashboardProps {
  profile: UserProfile;
  orders: PortalOrder[];
  quotes: Quote[];
  invoices: Invoice[];
  payments: PaymentRecord[];
  onAction: (section: string) => void;
  onTabChange: (tab: "catalog" | "orders" | "quotes" | "invoices") => void;
  currency: "ARS" | "USD";
  exchangeRate: number;
  seller?: {
    name: string;
    email: string;
    phone?: string;
  };
}

export function AccountDashboard({
  profile,
  orders,
  quotes,
  invoices,
  payments,
  onAction,
  onTabChange,
  currency,
  exchangeRate,
  seller
}: AccountDashboardProps) {
  const sellerWhatsAppUrl = generateWhatsAppDirectUrl(seller?.phone);

  // ── Expiring price agreements ────────────────────────────────────────────────
  const [expiringAgreements, setExpiringAgreements] = useState<{ id: number; name: string; valid_until: string }[]>([]);

  useEffect(() => {
    if (!profile.id) return;
    const warnDate = new Date(Date.now() + EXPIRY_WARN_DAYS * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("client_price_agreements")
      .select("id, name, valid_until")
      .eq("client_id", profile.id)
      .eq("active", true)
      .not("valid_until", "is", null)
      .lt("valid_until", warnDate)
      .gt("valid_until", new Date().toISOString())
      .then(({ data }) => {
        if (data) setExpiringAgreements(data as { id: number; name: string; valid_until: string }[]);
      });
  }, [profile.id]);
  
  // Financial Calculations
  const metrics = useMemo(() => {
    const unpaidInvoices = invoices.filter(i => i.status !== "paid");
    
    const safeRate = Number(exchangeRate) || 1;
    
    // Calculate total debt converting individual invoices to the target currency
    const totalDebt = unpaidInvoices.reduce((sum, i) => {
      let amount = Number(i.total) || 0;
      if (i.currency !== currency) {
        if (currency === "ARS") amount *= safeRate;
        else amount /= safeRate;
      }
      return sum + amount;
    }, 0);

    const pendingInvoicesCount = unpaidInvoices.length;
    
    // Credit is ARS-based in the DB for most cases (confirmed by user)
    let limit = profile.credit_limit || 0;
    let used = profile.credit_used || 0;
    
    if (currency === "USD") {
      limit /= safeRate;
      used /= safeRate;
    }

    const availableCredit = limit - used;
    
    const sortedDue = [...unpaidInvoices]
      .filter(i => i.due_date)
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
    const nextDue = sortedDue[0]?.due_date;

    return {
      totalDebt,
      pendingInvoicesCount,
      availableCredit,
      creditLimit: limit,
      nextDue
    };
  }, [invoices, profile, currency, exchangeRate]);

  // Operational Status
  const operational = useMemo(() => {
    const activeOrders = orders.filter(o => !["delivered", "rejected"].includes(o.status)).length;
    const openQuotes = quotes.filter(q => q.status === "sent" || q.status === "draft").length;
    const pendingPayments = payments.filter(p => p.status === "pendiente").length;

    return {
      activeOrders,
      openQuotes,
      pendingPayments
    };
  }, [orders, quotes, payments]);

  // Combined Activity Timeline
  const activityTimeline = useMemo(() => {
    const all = [
      ...orders.map(o => ({ type: 'order', date: o.created_at, label: `Pedido ${o.order_number || `#${String(o.id).slice(-4)}`}`, status: o.status })),
      ...quotes.map(q => ({ type: 'quote', date: q.created_at, label: `Cotización #${String(q.id).slice(-4)}`, status: q.status })),
      ...payments.map(p => ({ type: 'payment', date: p.created_at, label: `Pago cargado: ${formatMoneyAmount(p.amount, p.currency, 0)}`, status: p.status })),
      ...invoices.map(i => ({ type: 'invoice', date: i.created_at, label: `Factura ${i.invoice_number}`, status: i.status }))
    ];

    return all
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [orders, quotes, payments, invoices]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">

      {/* Expiring price agreements banner */}
      {expiringAgreements.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-400">
              {expiringAgreements.length === 1
                ? "Acuerdo de precio por vencer"
                : `${expiringAgreements.length} acuerdos de precio por vencer`}
            </p>
            <ul className="mt-1 space-y-0.5">
              {expiringAgreements.map((a) => (
                <li key={a.id} className="text-xs text-amber-300/80">
                  <span className="font-medium">{a.name}</span>
                  {" — vence el "}
                  {new Date(a.valid_until).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-amber-300/60">
              Contactá a tu vendedor para renovar las condiciones comerciales.
            </p>
          </div>
        </div>
      )}

      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Hola, {profile.contact_name || profile.company_name} 👋
          </h1>
          <p className="text-muted-foreground">Bienvenido a tu centro de control operativo.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 bg-primary/5 text-primary border-primary/20">
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
            Cliente {profile.partner_level?.toUpperCase() || 'B2B'}
          </Badge>
        </div>
      </div>

      {/* 2. Financial Metrics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Deuda Pendiente"
          value={formatMoneyAmount(metrics.totalDebt, currency, 0)}
          detail={`${metrics.pendingInvoicesCount} facturas sin pagar`}
          icon={<Wallet className="text-amber-500" />}
          trend={metrics.nextDue ? new Date(metrics.nextDue).toLocaleDateString() : "—"}
        />
        <MetricCard
          label="Facturas a Vencer"
          value={String(metrics.pendingInvoicesCount)}
          detail="Total de documentos pendientes"
          icon={<Receipt className="text-blue-500" />}
        />
        <MetricCard
          label="Crédito Disponible"
          value={formatMoneyAmount(metrics.availableCredit, currency, 0)}
          detail={`Límite: ${formatMoneyAmount(metrics.creditLimit, currency, 0)}`}
          icon={<TrendingUp className="text-emerald-500" />}
        />
        <MetricCard
          label="Próximo Vencimiento"
          value={metrics.nextDue ? new Date(metrics.nextDue).toLocaleDateString("es-AR") : "—"}
          detail={metrics.nextDue ? "Cierre pronto" : "No hay fechas próximas"}
          icon={<Clock className="text-rose-500" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* 3. Quick Actions (Left span) */}
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Acciones rápidas
            </h3>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
              {[
                { label: "Nueva Cotización", action: () => onAction("express"), icon: Plus, color: "bg-blue-500", desc: "Express" },
                { label: "Cargar Pago", action: () => onAction("payments"), icon: Receipt, color: "bg-amber-500", desc: "Reportar comprobante" },
                { label: "Ver Pedidos", action: () => onTabChange("orders"), icon: Package, color: "bg-emerald-500", desc: "Estado y tracking" },
                { label: "Lista de Precios", action: () => onTabChange("catalog"), icon: TrendingUp, color: "bg-purple-500", desc: "Consultar stock" },
                { label: "Mis Facturas", action: () => onTabChange("invoices"), icon: FileText, color: "bg-indigo-500", desc: "Cuentas" },
                { label: "Soporte", action: () => onAction("soporte"), icon: MessageSquare, color: "bg-rose-500", desc: "Ayuda directa" },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="group relative flex flex-col items-center justify-center p-6 bg-card border border-border/70 rounded-3xl hover:border-primary/50 hover:bg-secondary/50 transition-all active:scale-95 text-center overflow-hidden"
                >
                  <div className={`p-3 rounded-2xl ${item.color} text-white mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                    <item.icon size={22} />
                  </div>
                  <span className="font-bold text-foreground text-sm leading-tight">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">{item.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 4. Operational Summary */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Estado Operativo
            </h3>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
               <SurfaceCard padding="md" className="flex items-center gap-4">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 rounded-lg">
                    <Package size={18} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{operational.activeOrders}</p>
                    <p className="text-xs text-muted-foreground">Pedidos activos</p>
                  </div>
               </SurfaceCard>

               <SurfaceCard padding="md" className="flex items-center gap-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-500/10 text-blue-600 rounded-lg">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{operational.openQuotes}</p>
                    <p className="text-xs text-muted-foreground">Cotizaciones abiertas</p>
                  </div>
               </SurfaceCard>

               <SurfaceCard padding="md" className="flex items-center gap-4">
                  <div className="p-2 bg-amber-100 dark:bg-amber-500/10 text-amber-600 rounded-lg">
                    <Receipt size={18} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{operational.pendingPayments}</p>
                    <p className="text-xs text-muted-foreground">Pagos en revisión</p>
                  </div>
               </SurfaceCard>
            </div>
          </section>
        </div>

        {/* 5. Right Column (Seller + Timeline) */}
        <div className="space-y-6">
          
          {/* Seller Card */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Tu ejecutivo de cuenta
            </h3>
            <SurfaceCard padding="lg" className="relative overflow-hidden">
               <div className="flex items-center gap-4 mb-5">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center border-2 border-background ring-4 ring-primary/5">
                      <User size={28} className="text-primary" />
                    </div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-background rounded-full" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">{seller?.name || "Asignación en curso"}</h4>
                    <p className="text-xs text-muted-foreground">Soporte personalizado B2B</p>
                  </div>
               </div>
               
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start rounded-2xl gap-2 h-11" asChild>
                    <a href={`mailto:${seller?.email}`}><Mail size={16} /> Enviar email</a>
                  </Button>
                  {sellerWhatsAppUrl ? (
                    <Button variant="secondary" className="w-full justify-start rounded-2xl gap-2 h-11 bg-emerald-500 text-white hover:bg-emerald-600 border-none" asChild>
                      <a href={sellerWhatsAppUrl} target="_blank" rel="noopener noreferrer">
                        <Phone size={16} /> WhatsApp Directo
                      </a>
                    </Button>
                  ) : (
                    <Button type="button" variant="secondary" disabled className="w-full justify-start rounded-2xl gap-2 h-11 bg-muted text-muted-foreground border-none">
                      <Phone size={16} /> Celular pendiente
                    </Button>
                  )}
                </div>
            </SurfaceCard>
          </section>

          {/* Activity Timeline */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
              Actividad Reciente
            </h3>
            <SurfaceCard padding="md" className="space-y-4">
              {activityTimeline.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">No hay actividad reciente.</p>
              ) : (
                activityTimeline.map((item, idx) => (
                  <div key={idx} className="flex gap-3 relative pb-4 last:pb-0">
                    {idx !== activityTimeline.length - 1 && (
                      <div className="absolute top-6 left-3 w-[1px] h-full bg-border" />
                    )}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 
                      ${item.type === 'order' ? 'bg-emerald-100 text-emerald-600' : 
                        item.type === 'quote' ? 'bg-blue-100 text-blue-600' :
                        item.type === 'payment' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-600'}`}
                    >
                      <History size={12} />
                    </div>
                    <div className="flex-1 pt-0.5">
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-xs font-bold leading-tight">{item.label}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0 uppercase tracking-tighter">
                          {new Date(item.date).toLocaleDateString("es-AR", { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{item.status.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                ))
              )}
              <Button variant="ghost" className="w-full text-[10px] h-8 text-primary uppercase font-bold tracking-widest gap-1 mt-2" onClick={() => onTabChange("orders")}>
                Ver todo <ChevronRight size={12} />
              </Button>
            </SurfaceCard>
          </section>

        </div>
      </div>
    </div>
  );
}
