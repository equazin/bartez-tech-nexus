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
