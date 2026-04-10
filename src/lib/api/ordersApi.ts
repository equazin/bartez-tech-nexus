import { supabase } from "@/lib/supabase";

interface PatchOrderPayload {
  id: number;
  status?: string;
  shipping_provider?: string;
  tracking_number?: string;
  numero_remito?: string;
}

interface PatchProfilePayload {
  id: string;
  role?: string;
  active?: boolean;
  estado?: string;
  credit_limit?: number;
  client_type?: string;
  default_margin?: number;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export async function patchOrder(payload: PatchOrderPayload): Promise<void> {
  const authHeader = await getAuthHeader();
  const res = await fetch("/api/orders", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Error al actualizar la orden");
  }
}

export async function patchProfile(payload: PatchProfilePayload): Promise<void> {
  const authHeader = await getAuthHeader();
  const res = await fetch("/api/profiles", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Error al actualizar el perfil");
  }
}

// ── Coupons ───────────────────────────────────────────────────────────────────

interface CreateCouponPayload {
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_purchase?: number;
  max_uses?: number | null;
  expires_at?: string | null;
  is_active?: boolean;
}

async function callApi(
  url: string,
  method: string,
  body: unknown
): Promise<unknown> {
  const authHeader = await getAuthHeader();
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? "API error");
  return (json as { data: unknown }).data;
}

export async function createCoupon(payload: CreateCouponPayload): Promise<unknown> {
  return callApi("/api/coupons", "POST", payload);
}

export async function updateCoupon(payload: { id: string; is_active?: boolean; expires_at?: string | null; max_uses?: number | null }): Promise<void> {
  await callApi("/api/coupons", "PATCH", payload);
}

export async function deleteCoupon(id: string): Promise<void> {
  await callApi("/api/coupons", "DELETE", { id });
}

// ── Pricing Rules ─────────────────────────────────────────────────────────────

export async function createPricingRuleApi(payload: unknown): Promise<unknown> {
  return callApi("/api/pricing/rules", "POST", payload);
}

export async function updatePricingRuleApi(id: string, patch: unknown): Promise<unknown> {
  return callApi("/api/pricing/rules", "PATCH", { id, ...(patch as object) });
}

export async function deletePricingRuleApi(id: string): Promise<void> {
  await callApi("/api/pricing/rules", "DELETE", { id });
}

// ── Price Agreements ──────────────────────────────────────────────────────────

export async function createPriceAgreementApi(payload: unknown): Promise<unknown> {
  return callApi("/api/pricing/agreements", "POST", payload);
}

export async function updatePriceAgreementApi(id: number, patch: unknown): Promise<unknown> {
  return callApi("/api/pricing/agreements", "PATCH", { id, ...(patch as object) });
}

// ── RMA ───────────────────────────────────────────────────────────────────────

interface CreateRmaPayload {
  client_id: string;
  order_id: string;
  reason: string;
  description?: string;
  items: Array<{ product_id: number; name: string; sku?: string; quantity: number; unit_price: number }>;
}

export async function createRmaApi(payload: CreateRmaPayload): Promise<unknown> {
  return callApi("/api/rma", "POST", payload);
}

export async function updateRmaApi(payload: { id: number; status: string; resolution_type?: string; resolution_notes?: string }): Promise<unknown> {
  return callApi("/api/rma", "PATCH", payload);
}

// ── Quotes ────────────────────────────────────────────────────────────────────

export async function createQuoteApi(payload: unknown): Promise<unknown> {
  return callApi("/api/quotes", "POST", payload);
}

export async function updateQuoteApi(id: number, patch: unknown): Promise<unknown> {
  return callApi("/api/quotes", "PATCH", { id, ...(patch as object) });
}

export async function deleteQuoteApi(id: number): Promise<void> {
  await callApi("/api/quotes", "DELETE", { id });
}
