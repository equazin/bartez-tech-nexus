/**
 * bundle-description-generator — Supabase Edge Function
 *
 * Genera una descripción de marketing para un bundle/PC armada
 * en base a los componentes seleccionados, usando Claude API.
 *
 * SETUP (Supabase Dashboard > Edge Functions > Secrets):
 *   ANTHROPIC_API_KEY — API key de Anthropic
 *
 * POST /functions/v1/bundle-description-generator
 * Body: {
 *   bundle_type: "pc_armada" | "esquema" | "bundle"
 *   bundle_title: string
 *   components: Array<{ label: string; product_name: string; quantity: number }>
 * }
 *
 * Response: { ok: true, description: string }
 */

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL             = "claude-haiku-4-5-20251001";

interface ComponentInput {
  label: string;
  product_name: string;
  quantity: number;
}

interface RequestBody {
  bundle_type: "pc_armada" | "esquema" | "bundle";
  bundle_title: string;
  components: ComponentInput[];
}

// ── Prompt builder ────────────────────────────────────────────

function buildPrompt(body: RequestBody): string {
  const typeLabel: Record<string, string> = {
    pc_armada: "PC armada lista para usar",
    esquema:   "esquema configurable de PC",
    bundle:    "combo de productos tecnológicos",
  };

  const componentList = body.components
    .map(c => `- ${c.quantity > 1 ? `${c.quantity}x ` : ""}${c.label}: ${c.product_name}`)
    .join("\n");

  return `Sos un especialista en tecnología IT B2B para el mercado argentino.

Generá una descripción de producto atractiva y técnica para un ${typeLabel[body.bundle_type] ?? "bundle"} llamado "${body.bundle_title}".

Componentes incluidos:
${componentList}

REGLAS:
- Máximo 3 oraciones cortas (150-200 palabras en total)
- Destacar las especificaciones técnicas clave: procesador, RAM, almacenamiento, gráficos si aplica
- Tono profesional B2B: ideal para empresas, integradores o resellers
- Mencionar ventajas competitivas: rendimiento, productividad, escalabilidad
- Idioma: español argentino natural
- NO incluir precios, NO mencionar "oferta", NO usar emojis
- Terminar con una frase de acción orientada a negocios

Respondé ÚNICAMENTE con el texto de la descripción, sin comillas, sin prefijos como "Descripción:" ni ningún otro encabezado.`;
}

// ── Main handler ─────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

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

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON body" }), { status: 400 });
  }

  if (!body.bundle_title?.trim() || !Array.isArray(body.components) || body.components.length === 0) {
    return new Response(JSON.stringify({
      ok: false,
      error: "bundle_title and at least one component are required",
    }), { status: 400 });
  }

  try {
    const prompt = buildPrompt(body);

    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key":         ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type":      "application/json",
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 400,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }

    const data = await res.json() as {
      content: Array<{ type: string; text: string }>;
    };

    const description = data.content.find(c => c.type === "text")?.text?.trim() ?? "";

    if (!description) throw new Error("Empty response from Claude");

    return new Response(JSON.stringify({ ok: true, description }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
