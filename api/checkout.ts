import { createClient } from "@supabase/supabase-js";
import { resolveMarginWithContext } from "../src/lib/pricingEngine.js";
import { getEffectiveCostPrice } from "../src/lib/pricing.js";
import type { Product } from "../src/models/products.js";
import type { PricingRule } from "../src/models/pricingRule.js";

export const config = { runtime: "edge", maxDuration: 60 };

interface CheckoutPayload {
  products: { id: number; quantity: number }[];
  status?: string;
  payment_method?: string;
  payment_surcharge_pct?: number;
  shipping_type?: string;
  shipping_address?: string;
  shipping_transport?: string;
  shipping_cost?: number;
  notes?: string;
  coupon_code?: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function getSupabaseServiceRole() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceKey) throw new Error("Server configuration error: Missing Supabase Service Key.");
  return createClient(url, serviceKey);
}

export default async function handler(request: Request): Promise<Response> {
  // CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed. Use POST." }, 405);

  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ ok: false, error: "Missing or invalid Authorization header." }, 401);
  }

  // 1. Authenticate user
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
  const sbUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });

  const { data: { user }, error: authError } = await sbUser.auth.getUser();
  if (authError || !user) {
    return json({ ok: false, error: "Unauthorized access." }, 401);
  }

  // 2. Parse body
  let payload: CheckoutPayload;
  try {
    payload = await request.json() as CheckoutPayload;
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  if (!payload.products || payload.products.length === 0) {
    return json({ ok: false, error: "Cart is empty." }, 400);
  }

  const sbAdmin = getSupabaseServiceRole();

  // 3. Fetch Client Profile (for default_margin)
  const { data: profile, error: profileError } = await sbAdmin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return json({ ok: false, error: "Client profile not found." }, 404);
  }

  const defaultMargin = Number(profile.default_margin) || 0;

  // 4. Fetch Pricing Rules
  const { data: pricingRulesRaw, error: rulesError } = await sbAdmin
    .from("pricing_rules")
    .select("*")
    .eq("active", true);

  if (rulesError) {
    return json({ ok: false, error: "Failed to fetch pricing rules." }, 500);
  }
  const pricingRules = pricingRulesRaw as PricingRule[];

  // 5. Fetch Products
  const productIds = payload.products.map(p => Number(p.id));
  const { data: dbProducts, error: productsError } = await sbAdmin
    .from("products")
    .select("*")
    .in("id", productIds);

  if (productsError || !dbProducts) {
    return json({ ok: false, error: "Failed to fetch products data." }, 500);
  }

  const dbProductMap = new Map<number, Product>();
  for (const p of dbProducts) {
    dbProductMap.set(p.id, p as Product);
  }

  // 6. Compute Server-Side Pricing Securely
  let secureTotal = 0;
  let secureSubtotal = 0;
  const secureProductsList = [];

  for (const item of payload.products) {
    const p = dbProductMap.get(Number(item.id));
    if (!p) {
      return json({ ok: false, error: `Product ID ${item.id} no longer exists.` }, 400);
    }
    if (item.quantity <= 0) {
      return json({ ok: false, error: `Invalid quantity for Product ID ${item.id}.` }, 400);
    }

    // Calcular el coste interno y margen usando la logica reusada del front
    const cost = getEffectiveCostPrice(p, item.quantity);
    const { margin } = resolveMarginWithContext(p, pricingRules, defaultMargin, user.id, item.quantity);
    
    const unitPrice = cost * (1 + margin / 100);
    const totalPrice = unitPrice * item.quantity;
    
    const ivaRate = p.iva_rate ?? 21;
    const ivaAmount = totalPrice * (ivaRate / 100);

    secureSubtotal += totalPrice;
    secureTotal += totalPrice + ivaAmount;

    // Generar el JSONB tal cual como el front lo mandaba pero SIN que el front intervenga en precios, previene forjado.
    secureProductsList.push({
      product_id: p.id,
      name: p.name_custom?.trim() || p.name_original?.trim() || p.name,
      sku: p.sku || "",
      quantity: item.quantity,
      cost_price: cost,
      unit_price: unitPrice,
      total_price: totalPrice,
      margin: margin,
      // Extras por si B2B usa otras cositas de orden 
      category: p.category,
      supplier_id: p.supplier_id,
      iva_rate: p.iva_rate ?? 21
    });
  }

  // --- Marketing / Coupons (Phase 5.4) ---
  let couponId = null;
  let discountAmount = 0;

  if (payload.coupon_code) {
    const { data: coupon, error: couponError } = await sbAdmin
      .from("coupons")
      .select("*")
      .eq("code", payload.coupon_code.trim().toUpperCase())
      .eq("is_active", true)
      .single();

    if (!couponError && coupon) {
      const now = new Date();
      const validDate = !coupon.expires_at || new Date(coupon.expires_at) > now;
      const validPurchase = secureSubtotal >= (coupon.min_purchase || 0);
      const validUses = !coupon.max_uses || coupon.used_count < coupon.max_uses;
      const validClient = !coupon.client_id || coupon.client_id === user.id;

      if (validDate && validPurchase && validUses && validClient) {
        couponId = coupon.id;
        if (coupon.discount_type === "fixed") {
          discountAmount = coupon.discount_value;
        } else {
          discountAmount = (secureSubtotal * coupon.discount_value) / 100;
        }
      }
    }
  }

  // Adicionar recargos de envío, etc al Total General de la Orden.
  let orderTotal = secureTotal - discountAmount;
  const shipCost = payload.shipping_cost || 0;
  if (shipCost > 0) orderTotal += shipCost;

  const paymentSurcharge = payload.payment_surcharge_pct || 0;
  if (paymentSurcharge > 0) {
    orderTotal += orderTotal * (paymentSurcharge / 100);
  }

  // 7. Invoke updated RPC!
  try {
    const { data: rpcData, error: rpcError } = await sbAdmin.rpc("reserve_stock_and_create_order", {
      p_client_id: user.id,
      p_products: secureProductsList,
      p_total: orderTotal,
      p_status: payload.status ?? "pending",
      p_payment_method: payload.payment_method ?? null,
      p_payment_surcharge_pct: payload.payment_surcharge_pct ?? null,
      p_shipping_type: payload.shipping_type ?? null,
      p_shipping_address: payload.shipping_address ?? null,
      p_shipping_transport: payload.shipping_transport ?? null,
      p_shipping_cost: payload.shipping_cost ?? null,
      p_notes: payload.notes ?? null,
      p_coupon_id: couponId,
      p_discount_amount: discountAmount
    });

    if (rpcError) {
      console.error("[checkout] RPC Error:", rpcError);
      return json({ ok: false, error: rpcError.message }, 500);
    }

    return json({ ok: true, data: rpcData });
  } catch (err: unknown) {
    console.error("[checkout] Exception calling RPC:", err);
    const message = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: message }, 500);
  }
}
