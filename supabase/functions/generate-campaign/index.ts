/**
 * generate-campaign — Edge Function
 * Recibe parámetros básicos de campaña, usa Claude para generar la estructura
 * completa (ad groups, keywords, headlines, descriptions) y guarda el draft
 * en campaign_drafts para que el admin apruebe o rechace.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface GenerateRequest {
  objective:       "leads" | "ventas" | "awareness";
  campaign_type:   "search" | "display" | "remarketing";
  target_segment:  string;   // "empresas" | "resellers" | "integradores" | "general"
  daily_budget_ars: number;
  product_focus?:  string;   // Ej: "notebooks", "servidores", "cámaras IP"
  extra_context?:  string;   // Texto libre del usuario
  num_ad_groups?:  number;   // Default 3
}

const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY  = Deno.env.get("ANTHROPIC_API_KEY");

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ ok: false, message: "ANTHROPIC_API_KEY no configurada en Supabase Secrets" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Auth check — requiere JWT de admin/vendedor
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ ok: false, message: "No autorizado" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["admin", "vendedor"].includes(profile.role)) {
      return new Response(JSON.stringify({ ok: false, message: "Permisos insuficientes" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as GenerateRequest;
    const { objective, campaign_type, target_segment, daily_budget_ars, product_focus, extra_context } = body;
    const numGroups = Math.min(5, Math.max(1, body.num_ad_groups ?? 3));

    const objectiveLabel: Record<string, string> = {
      leads:     "captar leads B2B (formularios de contacto y registro de empresas)",
      ventas:    "generar ventas directas en el portal B2B",
      awareness: "generar reconocimiento de marca Bartez entre empresas e integradores",
    };
    const segmentLabel: Record<string, string> = {
      empresas:      "empresas medianas y grandes de Argentina buscando equipamiento IT",
      resellers:     "resellers y distribuidores de tecnología en Argentina",
      integradores:  "integradores de sistemas y empresas de servicios IT en Argentina",
      general:       "empresas argentinas que necesiten tecnología, laptops, servidores o networking",
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
- Cada grupo debe tener entre 8-15 palabras clave relevantes (en español, para Argentina, incluir variantes con "Argentina", "Buenos Aires" donde aplique)
- Cada grupo debe tener exactamente 15 headlines (máx 30 caracteres cada uno) y 4 descriptions (máx 90 caracteres cada uno) — formato RSA de Google Ads
- Los textos deben ser en español rioplatense (vos, ustedes)
- Incluir USPs de Bartez: envío a todo el país, precios mayoristas, portal B2B, soporte técnico
- Negativos relevantes para excluir tráfico no calificado (consumidores finales, búsquedas genéricas)
- Estrategia de puja recomendada

Respondé ÚNICAMENTE con un JSON válido, sin markdown, sin explicaciones, exactamente en este formato:
{
  "name": "nombre sugerido para la campaña",
  "ad_groups": [
    {
      "name": "nombre del grupo",
      "keywords": ["keyword 1", "keyword 2", ...],
      "match_types": {"keyword 1": "broad|phrase|exact", ...},
      "headlines": ["headline 1", "headline 2", ...],
      "descriptions": ["desc 1", "desc 2", "desc 3", "desc 4"]
    }
  ],
  "negative_keywords": ["neg1", "neg2", ...],
  "bidding_strategy": "descripción de estrategia de puja",
  "notes": "notas adicionales sobre la campaña"
}`;

    // Call Claude
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
      return new Response(JSON.stringify({ ok: false, message: `Error Claude API: ${err}` }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
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
      // Try to extract JSON if Claude wrapped it in markdown
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Claude no devolvió JSON válido");
      structure = JSON.parse(match[0]);
    }

    const campaignName = (structure.name as string) || `${target_segment} ${objective} ${new Date().toLocaleDateString("es-AR")}`;

    // Save draft
    const { data: draft, error: insertErr } = await supabase
      .from("campaign_drafts")
      .insert({
        created_by:          user.id,
        name:                campaignName,
        objective,
        campaign_type,
        target_segment,
        daily_budget_ars,
        campaign_structure:  structure,
        ai_model:            "claude-haiku-4-5-20251001",
        ai_prompt_tokens:    anthropicData.usage.input_tokens,
        ai_completion_tokens: anthropicData.usage.output_tokens,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Log API usage
    await supabase.from("api_usage_log").insert({
      service:       "anthropic",
      operation:     "generate_campaign",
      tokens_input:  anthropicData.usage.input_tokens,
      tokens_output: anthropicData.usage.output_tokens,
      cost_usd:      (anthropicData.usage.input_tokens * 0.00000025) + (anthropicData.usage.output_tokens * 0.00000125),
      metadata:      { draft_id: draft?.id },
    }).throwOnError().then(() => {}).catch(() => {});

    return new Response(JSON.stringify({ ok: true, draft }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, message: msg }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
