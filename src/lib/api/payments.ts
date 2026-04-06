import { supabase } from "@/lib/supabase";
import { EmailNotificationService } from "./emailNotifications";

export interface PaymentRecord {
  id: string;
  client_id: string;
  order_id?: number | null;
  invoice_id?: string | null;
  amount: number;
  currency: "ARS" | "USD";
  payment_date: string;
  payment_method: "transferencia" | "deposito" | "efectivo" | "otro";
  reference?: string;
  file_url?: string;
  notes?: string;
  status: "pendiente" | "validado" | "rechazado";
  created_at: string;
}

export interface PaymentPayload {
  order_id?: number | null;
  invoice_id?: string | null;
  amount: number;
  currency: "ARS" | "USD";
  payment_date: string;
  payment_method: "transferencia" | "deposito" | "efectivo" | "otro";
  reference?: string;
  file_url?: string;
  notes?: string;
}

/**
 * Fetch payments for the current authenticated user.
 */
export async function fetchMyPayments(): Promise<PaymentRecord[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as PaymentRecord[]) ?? [];
}

/**
 * Upload a payment proof file to Supabase Storage.
 * Stores files in: payment-proofs/{userId}/{timestamp}_{filename}
 */
export async function uploadPaymentProof(file: File, userId: string): Promise<string> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { error } = await supabase.storage
    .from("payment-proofs")
    .upload(filePath, file);

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from("payment-proofs")
    .getPublicUrl(filePath);

  return publicUrl;
}

/**
 * Submit a new payment record and notify sales.
 */
export async function submitPayment(
  payload: PaymentPayload,
  clientData: { id: string; name: string }
): Promise<PaymentRecord> {
  // 1. Insert into DB
  const { data, error } = await supabase
    .from("payments")
    .insert({
      ...payload,
      client_id: clientData.id,
      status: "pendiente"
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const payment = data as PaymentRecord;

  // 2. Notify Sales (Background)
  void (async () => {
    try {
      // Get order/invoice numbers for the email if available
      let orderNumber: string | undefined;
      let invoiceNumber: string | undefined;

      if (payload.order_id) {
        const { data: o } = await supabase.from("orders").select("order_number").eq("id", payload.order_id).single();
        orderNumber = o?.order_number;
      }
      if (payload.invoice_id) {
        const { data: i } = await supabase.from("invoices").select("invoice_number").eq("id", payload.invoice_id).single();
        invoiceNumber = i?.invoice_number;
      }

      await EmailNotificationService.notifyNewPayment({
        clientName: clientData.name,
        amount: payload.amount,
        currency: payload.currency,
        date: payload.payment_date,
        method: payload.payment_method,
        orderNumber,
        invoiceNumber,
        fileUrl: payload.file_url,
        notes: payload.notes
      });
    } catch (err) {
      console.error("Failed to send payment notification email:", err);
    }
  })();

  return payment;
}
