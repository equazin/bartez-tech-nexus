/**
 * api/ai.ts — Unified AI endpoint
 * Dispatches to sub-handlers based on `action` field in the request body.
 *
 *   action: "enrich_content"    → product description/specs generation
 *   action: "generate_campaign" → Google Ads campaign structure via Claude
 */
import { createClient } from "@supabase/supabase-js";

export const config = { maxDuration: 60 };

// ── Shared helpers ─────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function getAdminSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

async function getAuthUser(request: Request) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
  const authHeader = request.headers.get("Authorization") || "";
  const sbUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await sbUser.auth.getUser();
  return error ? null : user;
}

// ── enrich_content ─────────────────────────────────────────────────────────

type Mode = "only_descriptions" | "only_specs" | "both";
interface ContentProductInput {
  id: number; name: string; brand?: string | null; sku?: string | null;
  description_short?: string | null; description_full?: string | null;
  specs?: Record<string, string> | null;
}

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}
function detectType(name: string): string | null {
  const n = normalize(name);
  if (/\bssd\b|\bnvme\b|\bm\.?2\b|\bhdd\b|\bdisco\b/.test(n)) return "storage";
  if (/\bram\b|\bddr4\b|\bddr5\b|\bmemoria\b/.test(n)) return "memory";
  if (/\brouter\b|\baccess point\b|\bap\b|\bswitch\b|\bwifi\b/.test(n)) return "networking";
  if (/\bmonitor\b|\bdisplay\b|\bpantalla\b/.test(n)) return "display";
  if (/\bnotebook\b|\blaptop\b|\bultrabook\b/.test(n)) return "notebook";
  if (/\bgpu\b|\bgeforce\b|\bradeon\b|\bplaca de video\b/.test(n)) return "gpu";
  if (/\bpos\b|\bpunto de venta\b|\bimpresora termica\b|\blector\b/.test(n)) return "pos";
  if (/\bteclado\b|\bmouse\b|\bauricular\b|\bwebcam\b/.test(n)) return "peripheral";
  return null;
}
function isGenericName(name: string): boolean {
  const n = normalize(name);
  if (!n || n.length < 8) return true;
  const tokens = n.split(" ").filter(Boolean);
  if (tokens.length < 2) return true;
  const generic = new Set(["producto", "articulo", "accesorio", "hardware", "equipo", "componente"]);
  return tokens.every((t) => generic.has(t));
}
function readCapacity(name: string): string | null {
  const m = normalize(name).match(/(\d+(?:\.\d+)?)\s*(tb|gb)\b/);
  return m ? `${m[1]} ${m[2].toUpperCase()}` : null;
}
function readSpeed(name: string): string | null {
  const m = normalize(name).match(/(\d{3,5})\s*(mhz|mb\/s|mbps|gbps)\b/);
  return m ? `${m[1]} ${m[2].toUpperCase()}` : null;
}
function buildShort(type: string): string {
  const map: Record<string, string> = {
    networking: "Equipo de red confiable para entornos de trabajo, con conectividad estable y rendimiento consistente.",
    storage: "Unidad de almacenamiento para acelerar cargas y mejorar tiempos de respuesta en uso profesional.",
    memory: "Memoria de alto desempeño para mejorar fluidez en multitarea y cargas exigentes.",
    display: "Monitor pensado para uso profesional con imagen nítida y operación estable.",
    notebook: "Notebook orientada a productividad, ideal para trabajo diario en oficina o movilidad.",
    gpu: "Tarjeta gráfica diseñada para cargas visuales exigentes con desempeño estable.",
    pos: "Equipo POS para operación comercial continua con integración simple en puntos de venta.",
    peripheral: "Periférico confiable para mejorar la experiencia de uso en puestos de trabajo.",
  };
  return map[type] ?? "Producto tecnológico orientado a uso profesional.";
}
function buildFull(type: string, name: string, brand: string | null | undefined): string {
  const brandLine = brand ? `de ${brand}` : "de tecnología";
  const intro = `🚀 ${name} ${brandLine}, pensado para operaciones B2B que necesitan estabilidad y continuidad.`;
  if (type === "networking") return `${intro}\n\n⚡ Ofrece conectividad sólida para oficinas, locales y entornos con múltiples equipos.\n🔒 Integra funciones orientadas a seguridad y administración de red.\n\nIdeal para implementaciones donde la disponibilidad y la velocidad son prioritarias.\n\n• Instalación simple\n• Operación continua\n• Rendimiento estable`;
  if (type === "storage") return `${intro}\n\n⚡ Mejora tiempos de arranque y acceso a archivos.\n🧩 Se integra fácilmente en estaciones de trabajo y equipos empresariales.\n\nIdeal para actualización de rendimiento y expansión de capacidad.\n\n• Respuesta ágil\n• Compatibilidad amplia\n• Uso profesional diario`;
  if (type === "memory") return `${intro}\n\n⚡ Incrementa la capacidad de trabajo simultáneo en aplicaciones exigentes.\n🛠️ Diseñada para mantener estabilidad bajo uso intensivo.\n\n• Mejor fluidez\n• Operación consistente\n• Instalación directa`;
  return `${intro}\n\n✅ Combina practicidad y especificaciones técnicas para uso corporativo.\n💼 Recomendado para empresas que buscan relación costo/rendimiento equilibrada.\n\n• Calidad profesional\n• Implementación simple\n• Soporte para uso continuo`;
}
function buildSpecs(type: string, name: string, sku?: string | null): Record<string, string> {
  const capacity = readCapacity(name);
  const speed = readSpeed(name);
  const out: Record<string, string> = { tecnologia: type, compatibilidad: "Plataformas estándar del mercado" };
  if (capacity) out.capacidad = capacity;
  if (speed) out.velocidad = speed;
  if (sku) out.modelo = sku;
  if (type === "networking") { out.interfaces = "Ethernet / Inalámbrica (según modelo)"; out.alimentacion = "Corriente continua mediante adaptador"; }
  else if (type === "storage") { out.interfaces = "SATA / NVMe (según modelo)"; out.alimentacion = "Vía bus del equipo"; }
  else if (type === "memory") { out.interfaces = "Ranura DIMM/SODIMM (según modelo)"; out.alimentacion = "Baja tensión de operación"; }
  else if (type === "display") { out.interfaces = "HDMI / DisplayPort (según modelo)"; out.alimentacion = "Fuente interna o adaptador externo"; }
  else if (type === "pos") { out.interfaces = "USB / Red / Serie (según modelo)"; out.alimentacion = "Adaptador incluido"; }
  else { out.interfaces = "Según versión de fabricante"; out.alimentacion = "Según especificación técnica"; }
  return out;
}

async function handleEnrichContent(body: Record<string, unknown>, request: Request) {
  const products = (body.products as ContentProductInput[]) ?? [];
  const mode: Mode = (body.mode as Mode) ?? "both";
  const dryRun = Boolean(body.dryRun);
  if (products.length === 0) return json({ ok: true, results: [], summary: { total: 0, generated: 0, review_required: 0, skipped: 0 } });

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || request.headers.get("x-supabase-apikey") || "";
  const supabase = createClient(url, key);

  const results: { productId: number; action: string; confidence: number; notes?: string }[] = [];

  for (const product of products) {
    const type = detectType(product.name);
    if (!type || isGenericName(product.name)) {
      if (!dryRun) {
        await supabase.from("products").update({ content_review_required: true }).eq("id", product.id);
        await supabase.from("content_generation_log").insert({ product_id: product.id, mode, action: "review_required", confidence: 0.2, notes: "No se pudo identificar tipo de producto" });
      }
      results.push({ productId: product.id, action: "review_required", confidence: 0.2, notes: "producto ambiguo" });
      continue;
    }
    const short = buildShort(type);
    const full = buildFull(type, product.name, product.brand);
    const techSpecs = buildSpecs(type, product.name, product.sku);
    if (!dryRun) {
      const updatePayload: Record<string, unknown> = { content_review_required: false };
      if (mode === "both" || mode === "only_descriptions") { updatePayload.description_short = short; updatePayload.description_full = full; updatePayload.description = full; }
      if (mode === "both" || mode === "only_specs") updatePayload.specs = { ...(product.specs ?? {}), ...techSpecs };
      await supabase.from("products").update(updatePayload).eq("id", product.id);
      await supabase.from("content_generation_log").insert({ product_id: product.id, mode, action: "generated", confidence: 0.9 });
    }
    results.push({ productId: product.id, action: "generated", confidence: 0.9 });
  }

  return json({ ok: true, results, summary: { total: results.length, generated: results.filter(r => r.action === "generated").length, review_required: results.filter(r => r.action === "review_required").length, skipped: 0 } });
}

// ── generate_campaign ──────────────────────────────────────────────────────

async function handleGenerateCampaign(body: Record<string, unknown>, userId: string) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return json({ ok: false, message: "ANTHROPIC_API_KEY no configurada" }, 400);

  const { objective, campaign_type, target_segment, daily_budget_ars, product_focus, extra_context } = body as Record<string, string | number>;
  const numGroups = Math.min(5, Math.max(1, Number(body.num_ad_groups ?? 3)));

  const objectiveLabel: Record<string, string> = {
    leads: "captar leads B2B (formularios de contacto y registro de empresas)",
    ventas: "generar ventas directas en el portal B2B",
    awareness: "generar reconocimiento de marca Bartez entre empresas e integradores",
  };
  const segmentLabel: Record<string, string> = {
    empresas: "empresas medianas y grandes de Argentina buscando equipamiento IT",
    resellers: "resellers y distribuidores de tecnología en Argentina",
    integradores: "integradores de sistemas y empresas de servicios IT en Argentina",
    general: "empresas argentinas que necesiten tecnología, laptops, servidores o networking",
  };

  const prompt = `Sos un experto en Google Ads B2B para el mercado argentino. Generá una campaña completa para Bartez, distribuidora de tecnología mayorista con portal B2B.

PARÁMETROS:
- Objetivo: ${objectiveLabel[String(objective)] ?? objective}
- Tipo: ${campaign_type}
- Segmento: ${segmentLabel[String(target_segment)] ?? target_segment}
- Presupuesto diario: $${Number(daily_budget_ars).toLocaleString("es-AR")} ARS
${product_focus ? `- Foco de producto: ${product_focus}` : ""}
${extra_context ? `- Contexto: ${extra_context}` : ""}

Generá exactamente ${numGroups} grupos de anuncios. Cada grupo: 8-15 keywords (español, Argentina), 15 headlines (máx 30 chars), 4 descriptions (máx 90 chars). Español rioplatense. USPs: envío nacional, precios mayoristas, portal B2B, soporte técnico. Incluir negativos.

Respondé ÚNICAMENTE con JSON válido sin markdown:
{"name":"...","ad_groups":[{"name":"...","keywords":[],"match_types":{},"headlines":[],"descriptions":[]}],"negative_keywords":[],"bidding_strategy":"...","notes":"..."}`;

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 4096, messages: [{ role: "user", content: prompt }] }),
  });

  if (!anthropicRes.ok) return json({ ok: false, message: `Error Claude API: ${await anthropicRes.text()}` }, 500);

  const anthropicData = await anthropicRes.json() as { content: { type: string; text: string }[]; usage: { input_tokens: number; output_tokens: number } };
  const rawText = anthropicData.content[0]?.text ?? "";

  let structure: Record<string, unknown>;
  try { structure = JSON.parse(rawText); }
  catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return json({ ok: false, message: "Claude no devolvió JSON válido" }, 500);
    structure = JSON.parse(match[0]);
  }

  const sbAdmin = getAdminSupabase();
  const campaignName = (structure.name as string) || `${target_segment} ${objective} ${new Date().toLocaleDateString("es-AR")}`;

  const { data: draft, error: insertErr } = await sbAdmin
    .from("campaign_drafts")
    .insert({ created_by: userId, name: campaignName, objective, campaign_type, target_segment, daily_budget_ars, campaign_structure: structure, ai_model: "claude-haiku-4-5-20251001" })
    .select().single();

  if (insertErr) return json({ ok: false, message: insertErr.message }, 500);
  return json({ ok: true, draft });
}

// ── Main handler ──────────────────────────────────────────────────────────

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, x-supabase-apikey" } });
  }
  if (request.method !== "POST") return json({ ok: false, error: "Use POST" }, 405);

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  const action = String(body.action ?? "");

  if (action === "enrich_content") return handleEnrichContent(body, request);

  if (action === "generate_campaign") {
    const user = await getAuthUser(request);
    if (!user) return json({ ok: false, error: "Unauthorized" }, 401);
    const sbAdmin = getAdminSupabase();
    const { data: profile } = await sbAdmin.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["admin", "vendedor"].includes((profile as any).role)) return json({ ok: false, error: "Permisos insuficientes" }, 403);
    return handleGenerateCampaign(body, user.id);
  }

  return json({ ok: false, error: `Unknown action: ${action}` }, 400);
}
