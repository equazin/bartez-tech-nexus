import { supabase } from "@/lib/supabase";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

interface OrderInvoiceItem {
  product_id?: number;
  name?: string;
  sku?: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
}

interface OrderForInvoice {
  id: number;
  order_number?: string | null;
  client_id: string;
  total: number;
  notes?: string | null;
  products: OrderInvoiceItem[];
}

interface ClientSnapshotRow {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  client_type: string | null;
}

interface ProductTaxRow {
  id: number;
  iva_rate: number | null;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id?: number;
  client_id: string;
  client_snapshot?: {
    company_name?: string;
    contact_name?: string;
    client_type?: string;
  };
  items: unknown[];
  subtotal: number;
  iva_total: number;
  total: number;
  currency: "ARS" | "USD";
  exchange_rate?: number;
  status: InvoiceStatus;
  due_date?: string;
  paid_at?: string;
  notes?: string;
  pdf_url?: string;
  cae?: string;
  cae_due_date?: string;
  point_of_sale?: string;
  invoice_type?: string;
  afip_qr?: string;
  erp_sync_status?: "pending" | "synced" | "error";
  created_at: string;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

/** Create an invoice from an existing order (admin) */
export async function createInvoiceFromOrder(
  orderId: number,
  opts?: { dueDays?: number; currency?: "ARS" | "USD"; exchangeRate?: number }
): Promise<string> {
  const invoiceCurrency = opts?.currency ?? "ARS";
  const exchangeRate = invoiceCurrency === "ARS" ? opts?.exchangeRate : undefined;

  if (invoiceCurrency === "ARS" && (!exchangeRate || exchangeRate <= 0)) {
    throw new Error("Ingresá un tipo de cambio válido para facturar en ARS.");
  }

  const { data: existingInvoice, error: existingInvoiceError } = await supabase
    .from("invoices")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (existingInvoiceError) throw new Error(existingInvoiceError.message);
  if (existingInvoice) throw new Error("Ese pedido ya tiene una factura asociada.");

  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, client_id, total, notes, products")
    .eq("id", orderId)
    .single();

  if (orderError) throw new Error(orderError.message);

  const order = orderData as OrderForInvoice;
  const productIds = Array.from(
    new Set(
      (order.products ?? [])
        .map((item) => item.product_id)
        .filter((productId): productId is number => typeof productId === "number")
    )
  );

  const [{ data: clientData, error: clientError }, { data: taxRows, error: taxError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, company_name, contact_name, client_type")
      .eq("id", order.client_id)
      .single(),
    productIds.length > 0
      ? supabase.from("products").select("id, iva_rate").in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (clientError) throw new Error(clientError.message);
  if (taxError) throw new Error(taxError.message);

  const client = clientData as ClientSnapshotRow;
  const ivaRateByProductId = new Map(
    ((taxRows as ProductTaxRow[] | null) ?? []).map((row) => [row.id, row.iva_rate ?? 21])
  );

  const factor = invoiceCurrency === "ARS" ? exchangeRate ?? 1 : 1;

  let subtotalProductsUsd = 0;
  let ivaTotalUsd = 0;

  const items = (order.products ?? []).map((item) => {
    const quantity = item.quantity ?? 0;
    const unitPriceUsd = item.unit_price ?? (quantity > 0 ? (item.total_price ?? 0) / quantity : 0);
    const lineSubtotalUsd = item.total_price ?? unitPriceUsd * quantity;
    const ivaRate = item.product_id ? (ivaRateByProductId.get(item.product_id) ?? 21) : 21;
    const ivaAmountUsd = lineSubtotalUsd * (ivaRate / 100);
    const lineTotalUsd = lineSubtotalUsd + ivaAmountUsd;

    subtotalProductsUsd += lineSubtotalUsd;
    ivaTotalUsd += ivaAmountUsd;

    return {
      product_id: item.product_id ?? null,
      name: item.name ?? "Producto",
      sku: item.sku ?? "",
      quantity,
      unit_price: roundMoney(unitPriceUsd * factor),
      total_price: roundMoney(lineSubtotalUsd * factor),
      iva_rate: ivaRate,
      iva_amount: roundMoney(ivaAmountUsd * factor),
      total_with_iva: roundMoney(lineTotalUsd * factor),
      currency: invoiceCurrency,
    };
  });

  const orderTotalUsd = Number(order.total ?? 0);
  const subtotalInvoiceUsd = orderTotalUsd - ivaTotalUsd;
  const adjustmentUsd = roundMoney(subtotalInvoiceUsd - subtotalProductsUsd);

  if (Math.abs(adjustmentUsd) >= 0.01) {
    items.push({
      product_id: null,
      name: adjustmentUsd > 0 ? "Ajuste operativo" : "Descuento / ajuste",
      sku: "",
      quantity: 1,
      unit_price: roundMoney(adjustmentUsd * factor),
      total_price: roundMoney(adjustmentUsd * factor),
      iva_rate: 0,
      iva_amount: 0,
      total_with_iva: roundMoney(adjustmentUsd * factor),
      currency: invoiceCurrency,
    });
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (opts?.dueDays ?? 30));

  const invoicePayload = {
    order_id: order.id,
    client_id: order.client_id,
    client_snapshot: {
      company_name: client.company_name,
      contact_name: client.contact_name,
      client_type: client.client_type,
    },
    items,
    subtotal: roundMoney(subtotalInvoiceUsd * factor),
    iva_total: roundMoney(ivaTotalUsd * factor),
    total: roundMoney(orderTotalUsd * factor),
    currency: invoiceCurrency,
    exchange_rate: invoiceCurrency === "ARS" ? exchangeRate : null,
    status: "draft" as const,
    due_date: dueDate.toISOString().slice(0, 10),
    notes: order.notes ?? null,
  };

  const { data, error } = await supabase
    .from("invoices")
    .insert(invoicePayload)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return String(data.id);
}

/** Repair an existing invoice using the current order lines and product IVA rates */
export async function repairInvoice(
  invoiceId: string,
  opts?: { currency?: "ARS" | "USD"; exchangeRate?: number }
): Promise<void> {
  const { data: invoiceData, error: invoiceError } = await supabase
    .from("invoices")
    .select("id, invoice_number, order_id, currency, exchange_rate, status, due_date, paid_at, notes")
    .eq("id", invoiceId)
    .single();

  if (invoiceError) throw new Error(invoiceError.message);
  if (!invoiceData.order_id) throw new Error("La factura no está asociada a ningún pedido.");

  const invoiceCurrency = opts?.currency ?? invoiceData.currency;
  const exchangeRate = invoiceCurrency === "ARS"
    ? (opts?.exchangeRate ?? invoiceData.exchange_rate ?? undefined)
    : undefined;

  if (invoiceCurrency === "ARS" && (!exchangeRate || exchangeRate <= 0)) {
    throw new Error("Ingresá un tipo de cambio válido para reparar una factura en ARS.");
  }

  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, client_id, total, notes, products")
    .eq("id", invoiceData.order_id)
    .single();

  if (orderError) throw new Error(orderError.message);

  const order = orderData as OrderForInvoice;
  const productIds = Array.from(
    new Set(
      (order.products ?? [])
        .map((item) => item.product_id)
        .filter((productId): productId is number => typeof productId === "number")
    )
  );

  const [{ data: clientData, error: clientError }, { data: taxRows, error: taxError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, company_name, contact_name, client_type")
      .eq("id", order.client_id)
      .single(),
    productIds.length > 0
      ? supabase.from("products").select("id, iva_rate").in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (clientError) throw new Error(clientError.message);
  if (taxError) throw new Error(taxError.message);

  const client = clientData as ClientSnapshotRow;
  const ivaRateByProductId = new Map(
    ((taxRows as ProductTaxRow[] | null) ?? []).map((row) => [row.id, row.iva_rate ?? 21])
  );

  const factor = invoiceCurrency === "ARS" ? exchangeRate ?? 1 : 1;

  let subtotalProductsUsd = 0;
  let ivaTotalUsd = 0;

  const items = (order.products ?? []).map((item) => {
    const quantity = item.quantity ?? 0;
    const unitPriceUsd = item.unit_price ?? (quantity > 0 ? (item.total_price ?? 0) / quantity : 0);
    const lineSubtotalUsd = item.total_price ?? unitPriceUsd * quantity;
    const ivaRate = item.product_id ? (ivaRateByProductId.get(item.product_id) ?? 21) : 21;
    const ivaAmountUsd = lineSubtotalUsd * (ivaRate / 100);
    const lineTotalUsd = lineSubtotalUsd + ivaAmountUsd;

    subtotalProductsUsd += lineSubtotalUsd;
    ivaTotalUsd += ivaAmountUsd;

    return {
      product_id: item.product_id ?? null,
      name: item.name ?? "Producto",
      sku: item.sku ?? "",
      quantity,
      unit_price: roundMoney(unitPriceUsd * factor),
      total_price: roundMoney(lineSubtotalUsd * factor),
      iva_rate: ivaRate,
      iva_amount: roundMoney(ivaAmountUsd * factor),
      total_with_iva: roundMoney(lineTotalUsd * factor),
      currency: invoiceCurrency,
    };
  });

  const orderTotalUsd = Number(order.total ?? 0);
  const subtotalInvoiceUsd = orderTotalUsd - ivaTotalUsd;
  const adjustmentUsd = roundMoney(subtotalInvoiceUsd - subtotalProductsUsd);

  if (Math.abs(adjustmentUsd) >= 0.01) {
    items.push({
      product_id: null,
      name: adjustmentUsd > 0 ? "Ajuste operativo" : "Descuento / ajuste",
      sku: "",
      quantity: 1,
      unit_price: roundMoney(adjustmentUsd * factor),
      total_price: roundMoney(adjustmentUsd * factor),
      iva_rate: 0,
      iva_amount: 0,
      total_with_iva: roundMoney(adjustmentUsd * factor),
      currency: invoiceCurrency,
    });
  }

  const invoicePayload = {
    order_id: order.id,
    client_id: order.client_id,
    client_snapshot: {
      company_name: client.company_name,
      contact_name: client.contact_name,
      client_type: client.client_type,
    },
    items,
    subtotal: roundMoney(subtotalInvoiceUsd * factor),
    iva_total: roundMoney(ivaTotalUsd * factor),
    total: roundMoney(orderTotalUsd * factor),
    currency: invoiceCurrency,
    exchange_rate: invoiceCurrency === "ARS" ? exchangeRate : null,
    status: invoiceData.status as InvoiceStatus,
    due_date: invoiceData.due_date,
    paid_at: invoiceData.paid_at,
    notes: invoiceData.notes ?? order.notes ?? null,
  };

  const { error } = await supabase
    .from("invoices")
    .update(invoicePayload)
    .eq("id", invoiceId);

  if (error) throw new Error(error.message);

  await Promise.all([
    supabase
      .from("account_movements")
      .update({
        monto: invoicePayload.total,
        descripcion: `Factura ${invoiceData.invoice_number ?? invoiceData.id}`,
      })
      .eq("reference_id", invoiceId)
      .eq("reference_type", "invoice"),
    supabase
      .from("account_movements")
      .update({
        monto: -invoicePayload.total,
        descripcion: `Pago factura ${invoiceData.invoice_number ?? invoiceData.id}`,
      })
      .eq("reference_id", invoiceId)
      .eq("reference_type", "invoice_payment"),
  ]);
}

/** Fetch invoices for the current admin view */
export async function fetchInvoices(filters?: {
  status?: InvoiceStatus;
  clientId?: string;
  limit?: number;
}): Promise<Invoice[]> {
  let query = supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters?.limit ?? 100);

  if (filters?.status)   query = query.eq("status", filters.status);
  if (filters?.clientId) query = query.eq("client_id", filters.clientId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as Invoice[]) ?? [];
}

/** Mark invoice as paid */
export async function markInvoicePaid(invoiceId: string): Promise<void> {
  const { error } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);
}

/** Send invoice (status: draft → sent) */
export async function sendInvoice(invoiceId: string): Promise<void> {
  const { error } = await supabase
    .from("invoices")
    .update({ status: "sent" })
    .eq("id", invoiceId);
  if (error) throw new Error(error.message);
}

/** Fetch client's own invoices */
export async function fetchMyInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Invoice[]) ?? [];
}
