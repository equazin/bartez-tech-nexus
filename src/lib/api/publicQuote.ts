import { supabase } from "@/lib/supabase";

export interface PublicQuoteItem {
  product_id?: number | string;
  name: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  sku?: string;
}

export interface PublicQuote {
  id: number;
  client_name: string;
  company_name: string | null;
  items: PublicQuoteItem[];
  subtotal: number;
  iva_total: number;
  total: number;
  currency: "USD" | "ARS";
  status: string;
  created_at: string;
  expires_at: string | null;
}

interface RawPublicQuote {
  id: number;
  client_name: string;
  company_name: string | null;
  items: unknown;
  subtotal: number | string;
  iva_total: number | string;
  total: number | string;
  currency: string;
  status: string;
  created_at: string;
  expires_at: string | null;
}

function toItems(raw: unknown): PublicQuoteItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is PublicQuoteItem => {
    return typeof item === "object" && item !== null && typeof (item as PublicQuoteItem).name === "string";
  });
}

export async function fetchPublicQuote(token: string): Promise<PublicQuote | null> {
  const { data, error } = await supabase.rpc("get_public_quote", { p_token: token });
  if (error) throw new Error(error.message);
  if (!data) return null;
  const raw = data as RawPublicQuote;
  return {
    id: raw.id,
    client_name: raw.client_name ?? "",
    company_name: raw.company_name ?? null,
    items: toItems(raw.items),
    subtotal: Number(raw.subtotal) || 0,
    iva_total: Number(raw.iva_total) || 0,
    total: Number(raw.total) || 0,
    currency: raw.currency === "USD" ? "USD" : "ARS",
    status: raw.status,
    created_at: raw.created_at,
    expires_at: raw.expires_at,
  };
}

export async function issuePublicQuoteToken(quoteId: number): Promise<string> {
  const { data, error } = await supabase.rpc("issue_quote_public_token", { p_quote_id: quoteId });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "string") throw new Error("No se pudo generar el token");
  return data;
}

export async function markPublicQuoteViewed(token: string): Promise<void> {
  await supabase.rpc("mark_quote_viewed", { p_token: token });
}

export function buildPublicQuoteUrl(token: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/q/${token}`;
  }
  return `/q/${token}`;
}
