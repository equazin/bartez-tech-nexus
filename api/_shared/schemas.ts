import { z } from "zod";

const optionalTrimmedString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

export const contactRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  message: z.string().trim().min(10).max(5000),
  subject: optionalTrimmedString(160),
});

export const orderProductSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  sku: optionalTrimmedString(100),
  quantity: z.coerce.number().int().positive(),
  unit_price: z.coerce.number().nonnegative().optional(),
  total_price: z.coerce.number().nonnegative().optional(),
});

export const orderEmailSchema = z.object({
  type: z.enum(["order_confirmed", "new_order_admin", "order_approved", "order_preparing", "order_shipped", "order_delivered", "order_rejected", "quote_approved", "quote_rejected", "new_payment"]),
  orderId: z.coerce.number().int().positive().optional(),
  orderNumber: z.string().trim().min(0).max(64).optional(),
  clientId: z.string().trim().min(1).max(128),
  clientEmail: z.string().trim().email().max(320).optional(),
  clientName: optionalTrimmedString(120),
  products: z.array(orderProductSchema).max(200).optional().default([]),
  total: z.coerce.number().nonnegative().optional().default(0),
  shippingProvider: optionalTrimmedString(100),
  trackingNumber:   optionalTrimmedString(100),
  quoteId: z.coerce.number().int().positive().optional(),
  // New Payment fields
  method: z.string().trim().optional(),
  currency: z.string().trim().optional(),
  amount: z.coerce.number().optional(),
  date: z.string().trim().optional(),
  fileUrl: z.string().trim().url().optional(),
  notes: z.string().trim().optional(),
  invoiceNumber: z.string().trim().optional(),
  echeqDetails: z.object({
    count: z.number(),
    dates: z.array(z.string())
  }).optional().nullable(),
});

export const createOrderSchema = z.object({
  client_id: z.string().trim().min(1).max(128),
  products: z.array(orderProductSchema).min(1).max(500),
  total: z.coerce.number().nonnegative(),
  status: optionalTrimmedString(32),
  order_number: optionalTrimmedString(64),
  numero_remito: optionalTrimmedString(64),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(120),
  cost_price: z.coerce.number().positive(),
  stock: z.coerce.number().nonnegative(),
  description: optionalTrimmedString(4000),
  image: optionalTrimmedString(1000),
  sku: optionalTrimmedString(100),
  active: z.coerce.boolean().optional(),
  stock_min: z.coerce.number().nonnegative().optional(),
  supplier_id: z.coerce.number().positive().optional(),
  supplier_uuid: optionalTrimmedString(128),
});

export const updateStockSchema = z.object({
  sku: z.string().trim().min(1).max(100),
  stock: z.coerce.number().nonnegative(),
});

export const ORDER_STATUSES = [
  "pending",
  "pending_approval",
  "approved",
  "confirmed",
  "preparing",
  "picked",
  "shipped",
  "delivered",
  "rejected",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const updateOrderSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(ORDER_STATUSES).optional(),
  shipping_provider: optionalTrimmedString(100),
  tracking_number: optionalTrimmedString(100),
  numero_remito: optionalTrimmedString(64),
});

// Fields an admin/vendedor can update on profiles
const PROFILE_UPDATABLE_FIELDS = z.object({
  active: z.boolean().optional(),
  estado: z.enum(["activo", "inactivo", "pendiente", "rechazado"]).optional(),
  credit_limit: z.coerce.number().nonnegative().optional(),
  client_type: z.enum(["mayorista", "reseller", "empresa"]).optional(),
  default_margin: z.coerce.number().nonnegative().optional(),
});

// role update is separate and admin-only
export const updateProfileSchema = PROFILE_UPDATABLE_FIELDS.extend({
  id: z.string().trim().min(1).max(128),
  role: z.enum(["client", "cliente", "vendedor", "sales", "admin"]).optional(),
});

// ── Coupons ───────────────────────────────────────────────────────────────────

export const createCouponSchema = z.object({
  code: z.string().trim().min(1).max(64).transform((v) => v.toUpperCase()),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.coerce.number().positive(),
  min_purchase: z.coerce.number().nonnegative().optional().default(0),
  max_uses: z.coerce.number().int().positive().nullable().optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  is_active: z.boolean().optional().default(true),
});

export const updateCouponSchema = z.object({
  id: z.string().trim().min(1).max(128),
  is_active: z.boolean().optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  max_uses: z.coerce.number().int().positive().nullable().optional(),
});

export const deleteCouponSchema = z.object({
  id: z.string().trim().min(1).max(128),
});

// ── Pricing Rules ─────────────────────────────────────────────────────────────

const PRICING_CONDITION_TYPES = [
  "product", "client", "category", "supplier", "tag", "sku_prefix",
] as const;

const quantityBreakSchema = z.object({
  min: z.coerce.number().int().nonnegative(),
  margin: z.coerce.number(),
});

export const createPricingRuleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  condition_type: z.enum(PRICING_CONDITION_TYPES),
  condition_value: z.string().trim().min(1).max(500),
  min_margin: z.coerce.number(),
  max_margin: z.coerce.number().nullable().optional(),
  fixed_markup: z.coerce.number().nullable().optional(),
  priority: z.coerce.number().int().nonnegative(),
  active: z.boolean().optional().default(true),
  quantity_breaks: z.array(quantityBreakSchema).nullable().optional(),
});

export const updatePricingRuleSchema = createPricingRuleSchema.partial().extend({
  id: z.string().trim().min(1).max(128),
});

export const deletePricingRuleSchema = z.object({
  id: z.string().trim().min(1).max(128),
});

// ── Price Agreements ──────────────────────────────────────────────────────────

const MAX_DISCOUNT_PCT = 60; // business cap

export const createPriceAgreementSchema = z.object({
  client_id: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(200),
  margin_pct: z.coerce.number().nullable().optional(),
  discount_pct: z.coerce.number().min(0).max(MAX_DISCOUNT_PCT),
  price_list: z.enum(["mayorista", "distribuidor", "standard"]),
  valid_from: z.string().datetime({ offset: true }),
  valid_until: z.string().datetime({ offset: true }).nullable().optional(),
  active: z.boolean().optional().default(true),
  notes: z.string().trim().max(1000).nullable().optional(),
}).refine(
  (data) => !data.valid_until || data.valid_until > data.valid_from,
  { message: "valid_until must be after valid_from", path: ["valid_until"] }
);

export const updatePriceAgreementSchema = createPriceAgreementSchema
  .omit({ client_id: true })
  .partial()
  .extend({ id: z.coerce.number().int().positive() })
  .refine(
    (data) => !data.valid_until || !data.valid_from || data.valid_until > data.valid_from,
    { message: "valid_until must be after valid_from", path: ["valid_until"] }
  );

// ── RMA ───────────────────────────────────────────────────────────────────────

const RMA_REASONS = ["defective", "wrong_item", "damaged_in_transit", "not_as_described", "other"] as const;
const RMA_STATUSES = ["draft", "submitted", "reviewing", "approved", "rejected", "resolved"] as const;
const RMA_RESOLUTIONS = ["refund", "exchange", "credit_note", "repair"] as const;

const rmaItemSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().max(100).optional(),
  quantity: z.coerce.number().int().positive(),
  unit_price: z.coerce.number().nonnegative(),
});

export const createRmaSchema = z.object({
  client_id: z.string().trim().min(1).max(128),
  order_id: z.string().trim().min(1).max(128),
  reason: z.enum(RMA_REASONS),
  description: z.string().trim().max(2000).optional(),
  items: z.array(rmaItemSchema).min(1).max(100),
});

export const updateRmaSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(RMA_STATUSES),
  resolution_type: z.enum(RMA_RESOLUTIONS).optional(),
  resolution_notes: z.string().trim().max(2000).optional(),
});

// ── Quotes ────────────────────────────────────────────────────────────────────

const QUOTE_STATUSES = ["draft", "sent", "viewed", "approved", "rejected", "converted", "expired"] as const;

const quoteItemSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().positive(),
  cost: z.coerce.number().nonnegative(),
  margin: z.coerce.number(),
  unitPrice: z.coerce.number().nonnegative(),
  totalPrice: z.coerce.number().nonnegative(),
  ivaRate: z.coerce.number().nonnegative(),
  ivaAmount: z.coerce.number().nonnegative(),
  totalWithIVA: z.coerce.number().nonnegative(),
});

export const createQuoteSchema = z.object({
  client_id: z.string().trim().min(1).max(128),
  client_name: z.string().trim().min(1).max(200),
  items: z.array(quoteItemSchema).min(1).max(500),
  subtotal: z.coerce.number().nonnegative(),
  iva_total: z.coerce.number().nonnegative(),
  total: z.coerce.number().nonnegative(),
  currency: z.enum(["USD", "ARS"]),
  status: z.enum(QUOTE_STATUSES).optional().default("draft"),
  version: z.coerce.number().int().positive().optional().default(1),
  parent_id: z.coerce.number().int().positive().nullable().optional(),
  order_id: z.union([z.string(), z.number()]).nullable().optional(),
  valid_days: z.coerce.number().int().positive().nullable().optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  created_at: z.string().datetime({ offset: true }).optional(),
  updated_at: z.string().datetime({ offset: true }).optional(),
});

export const updateQuoteSchema = z.object({
  id: z.coerce.number().int().positive(),
  client_name: z.string().trim().min(1).max(200).optional(),
  items: z.array(quoteItemSchema).min(1).max(500).optional(),
  subtotal: z.coerce.number().nonnegative().optional(),
  iva_total: z.coerce.number().nonnegative().optional(),
  total: z.coerce.number().nonnegative().optional(),
  currency: z.enum(["USD", "ARS"]).optional(),
  status: z.enum(QUOTE_STATUSES).optional(),
  version: z.coerce.number().int().positive().optional(),
  parent_id: z.coerce.number().int().positive().nullable().optional(),
  order_id: z.union([z.string(), z.number()]).nullable().optional(),
  valid_days: z.coerce.number().int().positive().nullable().optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const deleteQuoteSchema = z.object({
  id: z.coerce.number().int().positive(),
});
