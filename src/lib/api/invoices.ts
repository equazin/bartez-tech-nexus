import { supabase } from "@/lib/supabase";

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

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
  created_at: string;
}

/** Create an invoice from an existing order (admin) */
export async function createInvoiceFromOrder(
  orderId: number,
  opts?: { dueDays?: number; currency?: "ARS" | "USD"; exchangeRate?: number }
): Promise<string> {
  const { data, error } = await supabase.rpc("create_invoice_from_order", {
    p_order_id:  orderId,
    p_due_days:  opts?.dueDays   ?? 30,
    p_currency:  opts?.currency  ?? "ARS",
    p_exch_rate: opts?.exchangeRate ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
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
