export type BackendJson =
  | string
  | number
  | boolean
  | null
  | { [key: string]: BackendJson | undefined }
  | BackendJson[];

export type BackendAppRole = "admin" | "vendedor" | "client";
export type BackendClientType = "mayorista" | "reseller" | "empresa";
export type BackendProfileStatus = "activo" | "inactivo" | "pendiente" | "rechazado";
export type BackendOrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";
export type BackendQuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export type BackendRmaStatus = "pending" | "approved" | "rejected" | "resolved";
export type BackendMarginType = "fixed" | "percentage";

export interface BackendOrderItem {
  product_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface BackendProfile {
  id: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  contact_name: string | null;
  role: BackendAppRole | null;
  active: boolean | null;
  estado: BackendProfileStatus | null;
  client_type: BackendClientType | null;
  default_margin: number | null;
  credit_limit: number | null;
  assigned_seller_id: string | null;
  cuit: string | null;
  tax_status: string | null;
  created_at: string;
}

export interface BackendProduct {
  id: number;
  sku: string | null;
  name: string;
  name_original: string | null;
  name_custom: string | null;
  description: string | null;
  price: number;
  cost: number | null;
  stock: number;
  stock_min: number | null;
  stock_reserved: number | null;
  category: string | null;
  brand: string | null;
  brand_id: string | null;
  images: string[] | null;
  image: string | null;
  active: boolean;
  iva_rate: number | null;
  special_price: number | null;
  min_order_qty: number | null;
  supplier_id: number | null;
  primary_supplier_id: string | null;
  supplier_name?: string | null;
  specs?: Record<string, BackendJson> | null;
  created_at: string;
  updated_at: string;
}

export interface BackendOrder {
  id: string;
  client_id: string;
  seller_id: string | null;
  status: BackendOrderStatus;
  items: BackendOrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  payment_method: string | null;
  payment_surcharge_pct: number | null;
  shipping_type: string | null;
  shipping_address: string | null;
  shipping_transport: string | null;
  shipping_cost: number | null;
  coupon_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackendQuote {
  id: string;
  client_id: string;
  seller_id: string | null;
  status: BackendQuoteStatus;
  items: BackendOrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackendRma {
  id: string;
  order_id: string;
  client_id: string;
  seller_id: string | null;
  status: BackendRmaStatus;
  reason: string;
  items: BackendOrderItem[];
  resolution: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackendPricingRule {
  id: string;
  name: string;
  client_id: string | null;
  client_type: BackendClientType | null;
  product_id: string | null;
  category: string | null;
  margin_type: BackendMarginType;
  value: number;
  active: boolean;
  priority: number;
  created_at: string;
}

export interface BackendMeta {
  count: number;
  limit: number;
  offset: number;
}

export interface BackendList<T> {
  items: T[];
  meta: BackendMeta;
}

export interface BackendRoleCapabilities {
  isAdmin: boolean;
  isSeller: boolean;
  canManageOrders: boolean;
  canManageProducts: boolean;
  canImpersonate: boolean;
}

export interface MeResponse {
  user: {
    id: string;
    email: string | null;
  };
  profile: BackendProfile | null;
  role: BackendAppRole | "anonymous";
  capabilities: BackendRoleCapabilities;
}

export interface HealthCheckResponse {
  service: string;
  status: string;
  timestamp: string;
}

export interface CuitLookupResponse {
  companyName: string;
  taxStatus: string;
  entityType: "empresa" | "persona_fisica";
  active: boolean;
}

export interface AssignedExecutiveResponse {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface BackendRegistrationRequest {
  id: string;
  cuit: string;
  company_name: string;
  contact_name: string;
  email: string;
  entity_type: "empresa" | "persona_fisica";
  tax_status: string;
  status: "pending" | "approved" | "rejected";
  assigned_to: string | null;
  assigned_seller?: { id: string; name: string; email: string } | null;
  notes: string | null;
  approved_user_id?: string | null;
  created_at: string;
}

export interface BackendUpdateRegistrationResult {
  id: string;
  status: "pending" | "approved" | "rejected";
  approved_user_id?: string | null;
  used_temp_password?: boolean;
}

// ─── Full DB-row shapes returned by the backend ───────────────────────────────

/** Shape returned by GET /v1/me/quotes and GET /v1/quotes — mirrors the quotes table */
export interface BackendQuoteRow {
  id: string | number;
  client_id: string;
  client_name?: string | null;
  seller_id?: string | null;
  items: unknown; // mapped by dbToQuote in useQuotes.ts
  subtotal: number;
  iva_total?: number | null;
  discount?: number | null;
  total: number;
  currency?: string | null;
  status: string;
  version?: number | null;
  parent_id?: string | number | null;
  order_id?: string | number | null;
  valid_days?: number | null;
  valid_until?: string | null;
  expires_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape returned by GET /v1/rma — mirrors the rma_requests table */
export interface BackendRmaRow {
  id: string | number;
  rma_number?: string | null;
  client_id: string;
  order_id: string;
  seller_id?: string | null;
  status: string;
  reason: string;
  description?: string | null;
  items: unknown; // RmaItem[]
  resolution_type?: string | null;
  resolution_notes?: string | null;
  resolution?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  // Enrichment fields — present when backend JOINs profiles/orders
  client_name?: string | null;
  order_number?: string | null;
}

/** Shape returned by GET /v1/pricing/rules — mirrors the pricing_rules table */
export interface BackendPricingRuleRow {
  id: string;
  name: string;
  condition_type: string;
  condition_value: string;
  min_margin: number;
  max_margin?: number | null;
  fixed_markup?: number | null;
  priority: number;
  active: boolean;
  quantity_breaks?: unknown | null; // QuantityBreak[] — mapped by usePricingRules
  created_at: string;
  updated_at: string;
}

export interface CreateRegistrationRequestInput {
  cuit: string;
  company_name?: string;
  contact_name: string;
  email: string;
  password: string;
  entity_type?: "empresa" | "persona_fisica";
  tax_status: string;
}

export interface UpdateMyProfileInput {
  phone?: string;
  contact_name?: string;
  company_name?: string;
}

export interface ChangePasswordInput {
  current_password: string;
  new_password: string;
}

export interface RegistrationRequestResponse {
  id: string;
  assigned_to: string | null;
  assigned_executive: AssignedExecutiveResponse | null;
}
