/**
 * ad-copy-generator — Supabase Edge Function
 *
 * Genera copies B2B para Google Ads RSA usando Claude API.
 * Guardado automático en ad_copies con status='draft'.
 *
 * SETUP (Supabase Dashboard > Edge Functions > Secrets):
 *   ANTHROPIC_API_KEY       — API key de Anthropic
 *   SUPABASE_URL            — Auto-provisioned
 *   SUPABASE_SERVICE_ROLE_KEY — Auto-provisioned
 *
 * POST /functions/v1/ad-copy-generator
 * Body: {
 *   category: string          -- "Laptops", "Servidores", etc.
 *   segment: string           -- "empresas" | "resellers" | "integradores"
 *   products?: Array<{ name, sku, specs }>   -- contexto de productos (opcional)
 *   campaign_id?: string      -- asociar a campaña existente
 *   count?: number            -- cuántas variantes generar (default: 3, max: 5)
 * }
 *
 * Response: { ok: true, copies: AdCopy[] }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY    = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_API_URL    = "https://api.anthropic.com/v1/messages";
const MODEL                = "claude-haiku-4-5-20251001"; // Haiku: rápido y económico para copy

interface ProductContext {
  name: string;
  sku?: string;
  specs?: string;
}

interface AdCopyVariant {
  headline1: string;
  headline2: string;
  headline3: string;
  description1: string;
  description2: string;
}

// ── Prompt B2B ───────────────────────────────────────────────

function buildPrompt(
  category: string,
  segment: string,
  products: ProductContext[],
  count: number,
): string {
  const segmentContext: Record<string, string> = {
    empresas:      "empresas corporativas que necesitan renovar equipamiento IT, priorizando garantía, soporte y volumen",
    resellers:     "revendedores y distribuidores que buscan márgenes atractivos, stock disponible y facilidad de reventa",
    integradores:  "integradores de sistemas que necesitan especificaciones técnicas precisas, compatibilidad y soporte postventa",
  };

  const productList = products.length > 0
    ? `Productos de referencia:\n${products.map(p => `- ${p.name}${p.sku ? ` (${p.sku})` : ""}${p.specs ? `: ${p.specs}` : ""}`).join("\n")}`
    : "";

  return `Sos un especialista en Google Ads B2B para distribuidores de tecnología en Argentina.

Generá ${count} variantes de copy para Google Ads RSA (Responsive Search Ads) para la categoría "${category}".

Segmento objetivo: ${segmentContext[segment] ?? segment}
${productList}

REGLAS ESTRICTAS:
- headline1, headline2, headline3: MÁXIMO 30 caracteres cada uno (contá los espacios)
- description1, description2: MÁXIMO 90 caracteres cada uno
- Enfoque 100% B2B: volumen, cuenta empresarial, mayorista, distribuidor, integrador
- PROHIBIDO: precios específicos, "barato", "oferta", "gamer", "personal"
- Incluir: cuenta B2B, portal exclusivo, stock disponible, garantía, soporte técnico
- Idioma: español argentino (vos, no tú)
- Calls to action claros: "Abrí tu cuenta", "Consultá precios", "Solicitá acceso"

Respondé ÚNICAMENTE con un JSON array válido, sin texto adicional:
[
  {
    "headline1": "...",
    "headline2": "...",
    "headline3": "...",
    "description1": "...",
    "description2": "..."
  }
]`;
}

// ── Claude API call ───────────────────────────────────────────

async function generateCopies(
  prompt: string,
  startMs: number,
): Promise<{ variants: AdCopyVariant[]; tokens: number; ms: number }> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key":         ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "Content-Type":      "application/json",
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 1500,
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };

  const raw = data.content.find(c => c.type === "text")?.text ?? "[]";

  // Extract JSON array from response (Claude sometimes adds markdown)
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in Claude response");

  const variants = JSON.parse(jsonMatch[0]) as AdCopyVariant[];
  const tokens   = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);
  const ms       = Date.now() - startMs;

  return { variants, tokens, ms };
}

// ── Validation ────────────────────────────────────────────────

function validateCopy(v: AdCopyVariant): string[] {
  const errors: string[] = [];
  if (v.headline1.length > 30)    errors.push(`headline1 muy largo (${v.headline1.length} chars)`);
  if (v.headline2.length > 30)    errors.push(`headline2 muy largo (${v.headline2.length} chars)`);
  if (v.headline3.length > 30)    errors.push(`headline3 muy largo (${v.headline3.length} chars)`);
  if (v.description1.length > 90) errors.push(`description1 muy largo (${v.description1.length} chars)`);
  if (v.description2.length > 90) errors.push(`description2 muy largo (${v.description2.length} chars)`);
  return errors;
}

// ── Main handler ─────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Auth check — requerir JWT válido
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({
      ok: false,
      error: "ANTHROPIC_API_KEY not configured. Set it in Supabase Dashboard → Edge Functions → Secrets.",
    }), { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const startMs  = Date.now();

  let body: {
    category: string;
    segment?: string;
    products?: ProductContext[];
    campaign_id?: string;
    count?: number;
  };

  try {
    body = await req.json() as typeof body;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), { status: 400 });
  }

  const { category, segment = "empresas", products = [], campaign_id, count = 3 } = body;

  if (!category?.trim()) {
    return new Response(JSON.stringify({ ok: false, error: "category is required" }), { status: 400 });
  }

  const safeCount = Math.min(Math.max(1, count), 5);

  try {
    const prompt = buildPrompt(category, segment, products, safeCount);
    const { variants, tokens, ms } = await generateCopies(prompt, startMs);

    // Validar longitudes y truncar si Claude no respetó el límite
    const cleaned = variants.map(v => ({
      headline1:    v.headline1.slice(0, 30),
      headline2:    v.headline2.slice(0, 30),
      headline3:    v.headline3.slice(0, 30),
      description1: v.description1.slice(0, 90),
      description2: v.description2.slice(0, 90),
    }));

    // Guardar en ad_copies
    const rows = cleaned.map(v => ({
      campaign_id:   campaign_id ?? null,
      category,
      segment,
      product_ids:   [], // se podría enriquecer con IDs reales
      ...v,
      status:        "draft",
      model_used:    MODEL,
      prompt_tokens: tokens,
      generation_ms: ms,
    }));

    const { data: saved, error: saveErr } = await supabase
      .from("ad_copies")
      .insert(rows)
      .select("id, headline1, headline2, headline3, description1, description2, status");

    if (saveErr) throw new Error(`DB error: ${saveErr.message}`);

    // Log API usage
    await supabase.from("api_usage_log").insert({
      api_name:   "anthropic",
      operation:  "ad_copy_generation",
      units_used: tokens,
      cost_usd:   tokens * 0.00000025, // Haiku: $0.25 / 1M tokens (input+output aprox)
      success:    true,
    });

    return new Response(JSON.stringify({ ok: true, copies: saved, tokens, ms }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("api_usage_log").insert({
      api_name: "anthropic", operation: "ad_copy_generation",
      success: false, error_msg: msg,
    });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
