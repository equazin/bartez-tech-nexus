export interface CommercialOrderItem {
  name?: string;
  quantity?: number;
  cost_price?: number;
  total_price?: number;
}

export interface CommercialOrder {
  id: string | number;
  client_id: string;
  total: number;
  status: string;
  created_at: string;
  order_number?: string;
  numero_remito?: string;
  products?: CommercialOrderItem[];
}

export interface CommercialQuote {
  id: number;
  client_id: string;
  total: number;
  status: string;
  created_at: string;
  order_id?: string | number;
}

export interface CommercialInvoice {
  id: string;
  client_id: string;
  total: number;
  status: string;
  created_at: string;
  due_date?: string;
  invoice_number: string;
  order_id?: number;
}

export interface CommercialPayment {
  id: string;
  client_id: string;
  monto: number;
  fecha: string;
  tipo?: string;
  descripcion?: string;
  reference_id?: string;
  reference_type?: string;
}

export interface CommercialProfile {
  id: string;
  company_name?: string;
  contact_name?: string;
  credit_limit?: number;
  credit_used?: number;
  estado?: string;
}

export interface CommercialProduct {
  id: number | string;
  name: string;
  stock: number;
  stock_min?: number | null;
}

export interface ProfitabilityMetrics {
  revenue: number;
  cost: number;
  grossProfit: number;
  marginPct: number;
  itemCount: number;
}

export interface CommercialStory {
  id: string;
  clientId: string;
  clientName: string;
  createdAt: string;
  total: number;
  quote?: { id: number; label: string; status: string };
  order?: { id: string; label: string; status: string; remito?: string };
  invoices: Array<{ id: string; label: string; status: string; total: number; dueDate?: string }>;
  payments: Array<{ id: string; amount: number; date: string; label: string }>;
  paidAmount: number;
  balance: number;
  delayed: boolean;
  overdue: boolean;
  nextAction: string;
  stage: string;
  profitability?: ProfitabilityMetrics;
}

export interface CommercialAlert {
  id: string;
  type: "low_stock" | "credit" | "invoice_overdue" | "invoice_due_soon" | "order_delay";
  severity: "high" | "medium";
  title: string;
  detail: string;
}

export interface CommercialTask {
  id: string;
  kind: "follow_up" | "collection" | "risk" | "dispatch" | "approval";
  title: string;
  detail: string;
}

export interface CommercialTimelineEntry {
  id: string;
  type: "quote" | "order" | "shipment" | "invoice" | "payment";
  label: string;
  status: string;
  date: string;
  amount?: number;
}

function daysBetween(dateIso: string, now = new Date()): number {
  return Math.floor((now.getTime() - new Date(dateIso).getTime()) / 86400000);
}

function clientName(clientId: string, clientMap: Record<string, string>) {
  return clientMap[clientId] || clientId;
}

export function calculateOrderProfitability(order: CommercialOrder): ProfitabilityMetrics {
  const products = order.products ?? [];
  const revenue = order.total || products.reduce((sum, item) => sum + (item.total_price ?? 0), 0);
  const cost = products.reduce(
    (sum, item) => sum + ((item.cost_price ?? 0) * (item.quantity ?? 0)),
    0
  );
  const grossProfit = revenue - cost;
  const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const itemCount = products.reduce((sum, item) => sum + (item.quantity ?? 0), 0);

  return { revenue, cost, grossProfit, marginPct, itemCount };
}

export function buildCommercialStories(params: {
  orders: CommercialOrder[];
  quotes: CommercialQuote[];
  invoices: CommercialInvoice[];
  payments: CommercialPayment[];
  clientMap: Record<string, string>;
  now?: Date;
}): CommercialStory[] {
  const { orders, quotes, invoices, payments, clientMap, now = new Date() } = params;
  const stories = new Map<string, CommercialStory>();
  const invoiceStoryMap = new Map<string, string>();

  function ensureStory(key: string, clientId: string, createdAt: string, total: number) {
    const existing = stories.get(key);
    if (existing) return existing;
    const story: CommercialStory = {
      id: key,
      clientId,
      clientName: clientName(clientId, clientMap),
      createdAt,
      total,
      invoices: [],
      payments: [],
      paidAmount: 0,
      balance: total,
      delayed: false,
      overdue: false,
      nextAction: "Monitorear",
      stage: "Prospecto",
    };
    stories.set(key, story);
    return story;
  }

  orders.forEach((order) => {
    const key = `order-${String(order.id)}`;
    const story = ensureStory(key, order.client_id, order.created_at, order.total);
    story.order = {
      id: String(order.id),
      label: order.order_number ?? `#${String(order.id).slice(-6).toUpperCase()}`,
      status: order.status,
      remito: order.numero_remito,
    };
    story.profitability = calculateOrderProfitability(order);
    const age = daysBetween(order.created_at, now);
    story.delayed =
      (order.status === "pending" && age >= 2) ||
      ((order.status === "approved" || order.status === "preparing") && !order.numero_remito && age >= 3);
  });

  quotes.forEach((quote) => {
    const key = quote.order_id != null ? `order-${String(quote.order_id)}` : `quote-${quote.id}`;
    const story = ensureStory(key, quote.client_id, quote.created_at, quote.total);
    story.quote = {
      id: quote.id,
      label: `COT-${String(quote.id).padStart(5, "0")}`,
      status: quote.status,
    };
  });

  invoices.forEach((invoice) => {
    const key = invoice.order_id != null ? `order-${String(invoice.order_id)}` : `invoice-${invoice.id}`;
    const story = ensureStory(key, invoice.client_id, invoice.created_at, invoice.total);
    story.invoices.push({
      id: invoice.id,
      label: invoice.invoice_number,
      status: invoice.status,
      total: invoice.total,
      dueDate: invoice.due_date,
    });
    story.overdue = story.overdue || invoice.status === "overdue";
    invoiceStoryMap.set(invoice.id, key);
  });

  payments.forEach((payment) => {
    let storyKey =
      (payment.reference_id ? invoiceStoryMap.get(payment.reference_id) : undefined) ||
      (payment.reference_type === "order" && payment.reference_id ? `order-${payment.reference_id}` : undefined);

    if (!storyKey && payment.reference_id && stories.has(`order-${payment.reference_id}`)) {
      storyKey = `order-${payment.reference_id}`;
    }

    if (!storyKey) {
      const matching = Array.from(stories.values()).find((story) => story.clientId === payment.client_id);
      storyKey = matching?.id ?? `payment-${payment.id}`;
    }

    const story = ensureStory(storyKey, payment.client_id, payment.fecha, 0);
    story.payments.push({
      id: payment.id,
      amount: Math.abs(payment.monto),
      date: payment.fecha,
      label: payment.descripcion || "Pago aplicado",
    });
  });

  return Array.from(stories.values())
    .map((story) => {
      story.paidAmount = story.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const invoicedTotal = story.invoices.reduce((sum, invoice) => sum + invoice.total, 0);
      story.balance = Math.max((invoicedTotal || story.total) - story.paidAmount, 0);

      if (story.overdue) story.nextAction = "Gestionar cobranza";
      else if (story.delayed) story.nextAction = "Hacer seguimiento";
      else if (story.order && !story.order.remito && ["approved", "preparing"].includes(story.order.status)) story.nextAction = "Preparar remito";
      else if (story.order && story.invoices.length === 0 && ["dispatched", "delivered"].includes(story.order.status)) story.nextAction = "Emitir factura";
      else if (story.quote && !story.order && ["sent", "viewed", "approved"].includes(story.quote.status)) story.nextAction = "Convertir en pedido";
      else if (story.balance > 0 && story.invoices.length > 0) story.nextAction = "Registrar cobro";

      if (story.payments.length > 0 && story.balance <= 0) story.stage = "Pagado";
      else if (story.invoices.length > 0) story.stage = story.overdue ? "Cobranza" : "Facturado";
      else if (story.order?.remito) story.stage = "Despachado";
      else if (story.order) story.stage = story.delayed ? "En revisión" : "Pedido";
      else if (story.quote) story.stage = "Cotizado";

      return story;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function buildCommercialTimeline(story: CommercialStory): CommercialTimelineEntry[] {
  const entries: CommercialTimelineEntry[] = [];

  if (story.quote) {
    entries.push({
      id: `quote-${story.quote.id}`,
      type: "quote",
      label: story.quote.label,
      status: story.quote.status,
      date: story.createdAt,
      amount: story.total,
    });
  }

  if (story.order) {
    entries.push({
      id: `order-${story.order.id}`,
      type: "order",
      label: story.order.label,
      status: story.order.status,
      date: story.createdAt,
      amount: story.total,
    });
    if (story.order.remito) {
      entries.push({
        id: `shipment-${story.order.id}`,
        type: "shipment",
        label: story.order.remito,
        status: story.order.status,
        date: story.createdAt,
      });
    }
  }

  story.invoices.forEach((invoice) => {
    entries.push({
      id: `invoice-${invoice.id}`,
      type: "invoice",
      label: invoice.label,
      status: invoice.status,
      date: invoice.dueDate ?? story.createdAt,
      amount: invoice.total,
    });
  });

  story.payments.forEach((payment) => {
    entries.push({
      id: `payment-${payment.id}`,
      type: "payment",
      label: payment.label,
      status: "aplicado",
      date: payment.date,
      amount: payment.amount,
    });
  });

  return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function buildCommercialAlerts(params: {
  orders: CommercialOrder[];
  invoices: CommercialInvoice[];
  profiles: CommercialProfile[];
  products: CommercialProduct[];
  now?: Date;
}): CommercialAlert[] {
  const { orders, invoices, profiles, products, now = new Date() } = params;
  const alerts: CommercialAlert[] = [];

  products
    .filter((product) => product.stock <= (product.stock_min ?? 3))
    .slice(0, 6)
    .forEach((product) => {
      alerts.push({
        id: `stock-${product.id}`,
        type: "low_stock",
        severity: "medium",
        title: `Stock bajo: ${product.name}`,
        detail: `${product.stock} u. disponibles${product.stock_min ? ` · mínimo ${product.stock_min}` : ""}`,
      });
    });

  profiles.forEach((profile) => {
    if ((profile.credit_limit ?? 0) <= 0) return;
    const usage = ((profile.credit_used ?? 0) / (profile.credit_limit ?? 1)) * 100;
    if (usage >= 85) {
      alerts.push({
        id: `credit-${profile.id}`,
        type: "credit",
        severity: usage >= 95 ? "high" : "medium",
        title: `Crédito casi agotado: ${profile.company_name || profile.contact_name || profile.id}`,
        detail: `${Math.round(usage)}% utilizado`,
      });
    }
  });

  invoices
    .filter((invoice) => invoice.status === "overdue")
    .slice(0, 6)
    .forEach((invoice) => {
      alerts.push({
        id: `invoice-${invoice.id}`,
        type: "invoice_overdue",
        severity: "high",
        title: `Factura vencida: ${invoice.invoice_number}`,
        detail: `Total ${Math.round(invoice.total).toLocaleString("es-AR")} · cliente ${invoice.client_id}`,
      });
    });

  invoices
    .filter((invoice) => ["draft", "sent"].includes(invoice.status) && invoice.due_date)
    .filter((invoice) => daysBetween(invoice.due_date ?? now.toISOString(), now) >= -3)
    .slice(0, 4)
    .forEach((invoice) => {
      alerts.push({
        id: `invoice-due-${invoice.id}`,
        type: "invoice_due_soon",
        severity: "medium",
        title: `Factura próxima a vencer: ${invoice.invoice_number}`,
        detail: `Vence ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("es-AR") : "sin fecha"} · cliente ${invoice.client_id}`,
      });
    });

  orders.forEach((order) => {
    const age = daysBetween(order.created_at, now);
    if (order.status === "pending" && age >= 2) {
      alerts.push({
        id: `order-pending-${order.id}`,
        type: "order_delay",
        severity: "medium",
        title: `Pedido demorado en revisión`,
        detail: `${order.order_number ?? `#${String(order.id).slice(-6)}`} · ${age} días pendiente`,
      });
    }
    if ((order.status === "approved" || order.status === "preparing") && !order.numero_remito && age >= 3) {
      alerts.push({
        id: `order-remito-${order.id}`,
        type: "order_delay",
        severity: "high",
        title: `Pedido sin remito`,
        detail: `${order.order_number ?? `#${String(order.id).slice(-6)}`} · ${age} días sin despacho`,
      });
    }
  });

  return alerts.slice(0, 12);
}

export function buildCommercialTasks(stories: CommercialStory[], profiles: CommercialProfile[]): CommercialTask[] {
  const tasks: CommercialTask[] = [];

  stories
    .filter((story) => story.overdue)
    .slice(0, 4)
    .forEach((story) => {
      tasks.push({
        id: `collection-${story.id}`,
        kind: "collection",
        title: `Cobrar ${story.clientName}`,
        detail: `${story.invoices.map((invoice) => invoice.label).join(", ")} · saldo ${Math.round(story.balance).toLocaleString("es-AR")}`,
      });
    });

  stories
    .filter((story) => story.delayed)
    .slice(0, 4)
    .forEach((story) => {
      tasks.push({
        id: `follow-up-${story.id}`,
        kind: "follow_up",
        title: `Seguimiento ${story.order?.label || story.quote?.label || story.id}`,
        detail: `${story.clientName} · ${story.nextAction}`,
      });
    });

  stories
    .filter((story) => story.order && !story.order.remito && ["approved", "preparing"].includes(story.order.status))
    .slice(0, 3)
    .forEach((story) => {
      tasks.push({
        id: `dispatch-${story.id}`,
        kind: "dispatch",
        title: `Emitir remito ${story.order?.label}`,
        detail: `${story.clientName} · pedido listo para despacho`,
      });
    });

  stories
    .filter((story) => story.quote && !story.order && ["approved", "viewed", "sent"].includes(story.quote.status))
    .slice(0, 3)
    .forEach((story) => {
      tasks.push({
        id: `approval-${story.id}`,
        kind: "approval",
        title: `Convertir ${story.quote?.label}`,
        detail: `${story.clientName} · cotización lista para pedido`,
      });
    });

  profiles
    .filter((profile) => (profile.credit_limit ?? 0) > 0)
    .filter((profile) => ((profile.credit_used ?? 0) / (profile.credit_limit ?? 1)) * 100 >= 85)
    .slice(0, 4)
    .forEach((profile) => {
      tasks.push({
        id: `risk-${profile.id}`,
        kind: "risk",
        title: `Revisar crédito de ${profile.company_name || profile.contact_name || profile.id}`,
        detail: `${Math.round(((profile.credit_used ?? 0) / (profile.credit_limit ?? 1)) * 100)}% usado`,
      });
    });

  return tasks.slice(0, 10);
}
