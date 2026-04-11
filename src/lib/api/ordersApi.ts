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
  id: string;
  status: OrderStatus;
  notes?: string | null;
}): Promise<Order> {
  return backend.patch<Order>(`/v1/orders/${payload.id}/status`, {
    status: payload.status,
    notes: payload.notes,
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

// ─── Coupons ──────────────────────────────────────────────────────────────────

export interface CouponPayload {
  code: string;
  description?: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_amount?: number | null;
  max_uses?: number | null;
  valid_from?: string | null;
  valid_until?: string | null;
  active?: boolean;
  client_id?: string | null;
  client_type?: "mayorista" | "reseller" | "empresa" | null;
}

export interface Coupon extends CouponPayload {
  id: string;
  uses_count: number;
  created_at: string;
}

export async function createCoupon(payload: CouponPayload): Promise<Coupon> {
  return backend.post<Coupon>("/v1/coupons", payload);
}

export async function updateCoupon(
  id: string,
  patch: Partial<CouponPayload>,
): Promise<Coupon> {
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
  product_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface CreateRmaPayload {
  order_id: string;
  items: RmaItem[];
  reason: string;
  notes?: string | null;
}

export interface Rma {
  id: string;
  order_id: string;
  client_id: string;
  seller_id: string | null;
  status: "pending" | "approved" | "rejected" | "resolved";
  reason: string;
  items: RmaItem[];
  resolution: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function createRmaApi(payload: CreateRmaPayload): Promise<Rma> {
  return backend.post<Rma>("/v1/rma", payload);
}

export async function updateRmaApi(
  id: string,
  patch: { status: Rma["status"]; resolution?: string | null; notes?: string | null },
): Promise<Rma> {
  return backend.patch<Rma>(`/v1/rma/${id}`, patch);
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
