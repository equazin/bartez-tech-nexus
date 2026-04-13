import { backend } from "./backendClient";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderItem {
  product_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export type OrderStatus =
  | "pending"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "preparing"
  | "dispatched"
  | "picked"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface Order {
  id: string;
  client_id: string;
  seller_id: string | null;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function patchOrder(payload: {
  id: string | number;
  status?: OrderStatus;
  notes?: string | null;
  shipping_provider?: string;
  tracking_number?: string;
}): Promise<Order> {
  return backend.patch<Order>(`/v1/orders/${String(payload.id)}/status`, {
    ...(payload.status ? { status: payload.status } : {}),
    ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
    ...(payload.shipping_provider !== undefined
      ? { shipping_provider: payload.shipping_provider }
      : {}),
    ...(payload.tracking_number !== undefined ? { tracking_number: payload.tracking_number } : {}),
  });
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export interface PatchProfilePayload {
  id: string;
  role?: string;
  active?: boolean;
  estado?: string;
  credit_limit?: number;
  client_type?: string;
  default_margin?: number;
}

export async function patchProfile(payload: PatchProfilePayload): Promise<void> {
  const { id, ...body } = payload;
  await backend.patch<void>(`/v1/admin/profiles/${id}`, body);
}

async function callVercelApi<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const json = (await res.json().catch(() => ({ ok: false, error: res.statusText }))) as
    | { ok: true; data: T }
    | { ok?: false; error?: string };

  if (!res.ok || !json.ok) {
    throw new Error(("error" in json && json.error) || "API error");
  }

  return json.data;
}

// ─── Coupons ──────────────────────────────────────────────────────────────────

export interface CouponPayload {
  code: string;
  description?: string | null;
  discount_type: "percentage" | "fixed" | "percent";
  discount_value: number;
  min_order_amount?: number | null;
  min_purchase?: number | null;
  max_uses?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  expires_at?: string | null;
  active?: boolean;
  is_active?: boolean;
  client_id?: string | null;
  client_type?: "mayorista" | "reseller" | "empresa" | null;
}

export interface Coupon extends CouponPayload {
  id: string;
  uses_count: number;
  used_count?: number;
  created_at: string;
}

function normalizeCouponPayload(payload: CouponPayload | (Partial<CouponPayload> & { id?: string })) {
  return {
    ...payload,
    discount_type: payload.discount_type === "percent" ? "percentage" : payload.discount_type,
    ...(payload.min_purchase !== undefined ? { min_order_amount: payload.min_purchase } : {}),
    ...(payload.expires_at !== undefined ? { valid_until: payload.expires_at } : {}),
    ...(payload.is_active !== undefined ? { active: payload.is_active } : {}),
  };
}

export async function createCoupon(payload: CouponPayload): Promise<Coupon> {
  return backend.post<Coupon>("/v1/coupons", normalizeCouponPayload(payload));
}

export async function updateCoupon(
  idOrPayload: string | ({ id: string } & Partial<CouponPayload>),
  patch?: Partial<CouponPayload>,
): Promise<Coupon> {
  const id = typeof idOrPayload === "string" ? idOrPayload : idOrPayload.id;
  const nextPatch = typeof idOrPayload === "string" ? (patch ?? {}) : idOrPayload;
  return backend.patch<Coupon>(`/v1/coupons/${id}`, patch);
}

export async function deleteCoupon(id: string): Promise<void> {
  await backend.delete<void>(`/v1/coupons/${id}`);
}

export async function validateCoupon(params: {
  code: string;
  client_id: string;
  order_amount: number;
}): Promise<{
  valid: boolean;
  coupon_id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  final_amount: number;
}> {
  return backend.post("/v1/coupons/validate", params);
}

// ─── Pricing rules ────────────────────────────────────────────────────────────

export interface PricingRulePayload {
  name: string;
  client_id?: string | null;
  client_type?: "mayorista" | "reseller" | "empresa" | null;
  product_id?: string | null;
  category?: string | null;
  margin_type: "fixed" | "percentage";
  value: number;
  active?: boolean;
  priority?: number;
}

export interface PricingRule extends PricingRulePayload {
  id: string;
  created_at: string;
}

export async function createPricingRuleApi(payload: PricingRulePayload): Promise<PricingRule> {
  return backend.post<PricingRule>("/v1/pricing/rules", payload);
}

export async function updatePricingRuleApi(
  id: string,
  patch: Partial<PricingRulePayload>,
): Promise<PricingRule> {
  return backend.patch<PricingRule>(`/v1/pricing/rules/${id}`, patch);
}

export async function deletePricingRuleApi(id: string): Promise<void> {
  await backend.delete<void>(`/v1/pricing/rules/${id}`);
}

// ─── Price resolution ─────────────────────────────────────────────────────────

export interface PriceAgreementPayload {
  client_id: string;
  name: string;
  margin_pct?: number | null;
  discount_pct: number;
  price_list: "mayorista" | "distribuidor" | "standard";
  valid_from: string;
  valid_until?: string | null;
  active?: boolean;
  notes?: string | null;
}

export interface PriceAgreement extends PriceAgreementPayload {
  id: number;
  created_at: string;
  updated_at: string;
}

export async function createPriceAgreementApi(
  payload: PriceAgreementPayload,
): Promise<PriceAgreement> {
  return callVercelApi<PriceAgreement>("/api/pricing/agreements", "POST", payload);
}

export async function updatePriceAgreementApi(
  id: number,
  patch: Partial<PriceAgreementPayload>,
): Promise<PriceAgreement> {
  return callVercelApi<PriceAgreement>("/api/pricing/agreements", "PATCH", {
    id,
    ...patch,
  });
}

export async function resolveClientPrice(params: {
  client_id: string;
  product_id: string;
}): Promise<{
  product_id: string;
  client_id: string;
  base_cost: number;
  final_price: number;
  applied_rule: { id: string; name: string; priority: number } | null;
  used_default_margin: boolean;
}> {
  return backend.get("/v1/pricing/resolve", params);
}

// ─── RMA ─────────────────────────────────────────────────────────────────────

export interface RmaItem {
  product_id: string | number;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total?: number;
}

export interface CreateRmaPayload {
  client_id?: string;
  order_id: string;
  items: RmaItem[];
  reason: string;
  description?: string;
  notes?: string | null;
}

export interface Rma {
  id: string | number;
  order_id: string;
  client_id: string;
  seller_id: string | null;
  status: "draft" | "submitted" | "reviewing" | "approved" | "rejected" | "resolved" | "pending";
  reason: string;
  items: RmaItem[];
  description?: string | null;
  resolution: string | null;
  resolution_type?: string | null;
  resolution_notes?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
}

export async function createRmaApi(payload: CreateRmaPayload): Promise<Rma> {
  return backend.post<Rma>("/v1/rma", payload);
}

export async function updateRmaApi(
  idOrPayload:
    | string
    | ({
        id: string | number;
      } & {
        status: Rma["status"];
        resolution?: string | null;
        notes?: string | null;
        resolution_type?: string | null;
        resolution_notes?: string | null;
      }),
  patch?: {
    status: Rma["status"];
    resolution?: string | null;
    notes?: string | null;
    resolution_type?: string | null;
    resolution_notes?: string | null;
  },
): Promise<Rma> {
  const id = typeof idOrPayload === "string" ? idOrPayload : String(idOrPayload.id);
  const nextPatch = typeof idOrPayload === "string" ? patch : { ...idOrPayload };
  if (!nextPatch) {
    throw new Error("Missing RMA patch payload.");
  }
  const { id: _ignoredId, ...body } = nextPatch as typeof nextPatch & { id?: string | number };
  return backend.patch<Rma>(`/v1/rma/${id}`, body);
}

// ─── Quotes ───────────────────────────────────────────────────────────────────

export interface QuoteItem {
  product_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface CreateQuotePayload {
  client_id: string;
  seller_id?: string | null;
  items: QuoteItem[];
  discount?: number;
  valid_until?: string | null;
  notes?: string | null;
}

export interface Quote {
  id: string;
  client_id: string;
  seller_id: string | null;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  items: QuoteItem[];
  subtotal: number;
  discount: number;
  total: number;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function createQuoteApi(payload: CreateQuotePayload): Promise<Quote> {
  return backend.post<Quote>("/v1/quotes", payload);
}

export async function updateQuoteApi(
  id: string,
  patch: Partial<CreateQuotePayload> & { status?: Quote["status"] },
): Promise<Quote> {
  return backend.patch<Quote>(`/v1/quotes/${id}`, patch);
}

export async function deleteQuoteApi(id: string): Promise<void> {
  await backend.delete<void>(`/v1/quotes/${id}`);
}

export async function convertQuoteToOrder(id: string, notes?: string | null): Promise<{ order: Order; quote_id: string }> {
  return backend.post(`/v1/quotes/${id}/convert`, { notes });
}

// ─── CUIT lookup (now server-side) ────────────────────────────────────────────

export interface CuitLookupResult {
  companyName: string;
  taxStatus: string;
  entityType: "empresa" | "persona_fisica";
  active: boolean;
}

export async function lookupCuit(cuit: string): Promise<CuitLookupResult> {
  return backend.get<CuitLookupResult>("/v1/public/cuit-lookup", { cuit });
}

// ─── Admin: users ─────────────────────────────────────────────────────────────

export interface CreateUserPayload {
  email: string;
  password: string;
  company_name: string;
  contact_name: string;
  role?: "admin" | "vendedor" | "client";
  client_type?: "mayorista" | "reseller" | "empresa";
  default_margin?: number;
  phone?: string;
  active?: boolean;
}

export async function createUserApi(payload: CreateUserPayload): Promise<{ id: string; email: string; role: string }> {
  return backend.post("/v1/admin/users", payload);
}

export async function updateUserApi(
  userId: string,
  patch: Partial<Omit<CreateUserPayload, "password">>,
): Promise<void> {
  await backend.patch(`/v1/admin/users/${userId}`, patch);
}

// ─── Reads that still go directly to Supabase (RLS-safe) ─────────────────────
// These queries are safe because RLS enforces row-level access:
//   - clients only see their own data
//   - admin/vendedor see all (profile.role checked server-side by Supabase RLS)
// No service_role needed → no backend proxy needed.

export async function fetchOrders(params: {
  client_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from("orders")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.client_id) query = query.eq("client_id", params.client_id);
  if (params.status) query = query.eq("status", params.status);
  if (params.limit) query = query.limit(params.limit);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { items: (data ?? []) as Order[], count: count ?? 0 };
}
