import { createClient } from "@supabase/supabase-js";

export const config = { maxDuration: 60 };

interface GenerateRequest {
  objective:        "leads" | "ventas" | "awareness";
  campaign_type:    "search" | "display" | "remarketing";
  target_segment:   string;
  daily_budget_ars: number;
  product_focus?:   string;
  extra_context?:   string;
  num_ad_groups?:   number;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Missing Supabase config");
  return createClient(url, key);
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "Missing Authorization" }, 401);

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) return json({ ok: false, message: "ANTHROPIC_API_KEY no configurada" }, 400);

  // Auth
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
  const sbUser = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await sbUser.auth.getUser();
  if (authErr || !user) return json({ ok: false, error: "Unauthorized" }, 401);

  const sbAdmin = getSupabase();
  const { data: profile } = await sbAdmin.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "vendedor"].includes((profile as any).role)) {
    return json({ ok: false, error: "Permisos insuficientes" }, 403);
  }

  let body: GenerateRequest;
  try { body = await request.json() as GenerateRequest; }
  catch { return json({ ok: false, error: "Invalid JSON" }, 400); }

  const { objective, campaign_type, target_segment, daily_budget_ars, product_focus, extra_context } = body;
  const numGroups = Math.min(5, Math.max(1, body.num_ad_groups ?? 3));

  const objectiveLabel: Record<string, string> = {
    leads:     "captar leads B2B (formularios de contacto y registro de empresas)",
    ventas:    "generar ventas directas en el portal B2B",
    awareness: "generar reconocimiento de marca Bartez entre empresas e integradores",
  };
  const segmentLabel: Record<string, string> = {
    empresas:     "empresas medianas y grandes de Argentina buscando equipamiento IT",
    resellers:    "resellers y distribuidores de tecnología en Argentina",
    integradores: "integradores de sistemas y empresas de servicios IT en Argentina",
    general:      "empresas argentinas que necesiten tecnología, laptops, servidores o networking",
  };

  const prompt = `Sos un experto en Google Ads B2B para el mercado argentino. Tenés que generar una campaña de Google Ads completa para Bartez, una empresa distribuidora de tecnología mayorista con portal B2B.

PARÁMETROS DE LA CAMPAÑA:
- Objetivo: ${objectiveLabel[objective] ?? objective}
- Tipo de campaña: ${campaign_type}
- Segmento objetivo: ${segmentLabel[target_segment] ?? target_segment}
- Presupuesto diario: $${daily_budget_ars.toLocaleString("es-AR")} ARS
${product_focus ? `- Foco de producto: ${product_focus}` : ""}
${extra_context ? `- Contexto adicional: ${extra_context}` : ""}

REQUERIMIENTOS:
- Generá exactamente ${numGroups} grupos de anuncios temáticamente distintos
- Cada grupo debe tener entre 8-15 palabras clave relevantes (en español, para Argentina)
- Cada grupo debe tener exactamente 15 headlines (máx 30 caracteres cada uno) y 4 descriptions (máx 90 caracteres cada uno) — formato RSA
- Los textos deben ser en español rioplatense (vos, ustedes)
- Incluir USPs de Bartez: envío a todo el país, precios mayoristas, portal B2B, soporte técnico
- Negativos relevantes para excluir tráfico no calificado
- Estrategia de puja recomendada

Respondé ÚNICAMENTE con un JSON válido, sin markdown, sin explicaciones, exactamente en este formato:
{
  "name": "nombre sugerido para la campaña",
  "ad_groups": [
    {
      "name": "nombre del grupo",
      "keywords": ["keyword 1", "keyword 2"],
      "match_types": {"keyword 1": "broad|phrase|exact"},
      "headlines": ["headline 1", "headline 2"],
      "descriptions": ["desc 1", "desc 2", "desc 3", "desc 4"]
    }
  ],
  "negative_keywords": ["neg1", "neg2"],
  "bidding_strategy": "descripción de estrategia de puja",
  "notes": "notas adicionales sobre la campaña"
}`;

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key":         ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type":      "application/json",
    },
    body: JSON.stringify({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    return json({ ok: false, message: `Error Claude API: ${err}` }, 500);
  }

  const anthropicData = await anthropicRes.json() as {
    content: { type: string; text: string }[];
    usage: { input_tokens: number; output_tokens: number };
  };

  const rawText = anthropicData.content[0]?.text ?? "";
  let structure: Record<string, unknown>;
  try {
    structure = JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return json({ ok: false, message: "Claude no devolvió JSON válido" }, 500);
    structure = JSON.parse(match[0]);
  }

  const campaignName = (structure.name as string) || `${target_segment} ${objective} ${new Date().toLocaleDateString("es-AR")}`;

  const { data: draft, error: insertErr } = await sbAdmin
    .from("campaign_drafts")
    .insert({
      created_by:           user.id,
      name:                 campaignName,
      objective,
      campaign_type,
      target_segment,
      daily_budget_ars,
      campaign_structure:   structure,
      ai_model:             "claude-haiku-4-5-20251001",
    })
    .select()
    .single();

  if (insertErr) return json({ ok: false, message: insertErr.message }, 500);

  return json({ ok: true, draft });
}
