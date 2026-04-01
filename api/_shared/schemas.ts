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
  type: z.enum(["order_confirmed", "new_order_admin", "order_shipped", "order_delivered"]),
  orderId: z.coerce.number().int().positive(),
  orderNumber: z.string().trim().min(1).max(64),
  clientId: z.string().trim().min(1).max(128),
  clientEmail: z.string().trim().email().max(320).optional(),
  clientName: optionalTrimmedString(120),
  products: z.array(orderProductSchema).max(200),
  total: z.coerce.number().nonnegative(),
  shippingProvider: optionalTrimmedString(100),
  trackingNumber:   optionalTrimmedString(100),
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
