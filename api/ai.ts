/**
 * api/ai.ts — Unified AI endpoint
 * Dispatches to sub-handlers based on `action` field in the request body.
 *
 *   action: "enrich_content"    → product description/specs generation
 *   action: "generate_campaign" → Google Ads campaign structure via Claude
 */
export const config = { runtime: "edge" };

// ── Shared helpers ─────────────────────────────────────────────────────────

const SB_URL = () => (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SB_KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

async function getAuthUser(request: Request): Promise<{ id: string } | null> {
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const res = await fetch(`${SB_URL()}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: process.env.VITE_SUPABASE_ANON_KEY || "" },
  });
  if (!res.ok) return null;
  const data = await res.json() as { id?: string };
  return data.id ? { id: data.id } : null;
}

async function getProfile(userId: string): Promise<{ role: string } | null> {
  const res = await fetch(`${SB_URL()}/rest/v1/profiles?id=eq.${userId}&select=role&limit=1`, {
    headers: { Authorization: `Bearer ${SB_KEY()}`, apikey: SB_KEY(), Accept: "application/json" },
  });
  if (!res.ok) return null;
  const rows = await res.json() as { role: string }[];
  return rows[0] ?? null;
}

async function insertDraft(record: Record<string, unknown>): Promise<{ id: string } | null> {
  const res = await fetch(`${SB_URL()}/rest/v1/campaign_drafts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SB_KEY()}`, apikey: SB_KEY(),
      "Content-Type": "application/json", Prefer: "return=representation",
    },
    body: JSON.stringify(record),
  });
  if (!res.ok) return null;
  const rows = await res.json() as { id: string }[];
  return rows[0] ?? null;
}

async function callSupabaseFunction(
  functionName: "google-ads-sync" | "launch-campaign",
  authHeader: string,
  payload?: Record<string, unknown>,
) {
  const res = await fetch(`${SB_URL()}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      apikey: process.env.VITE_SUPABASE_ANON_KEY || "",
      "Content-Type": "application/json",
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const raw = await res.text();
  let parsed: Record<string, unknown> | null = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = { message: raw };
    }
  }

  return { ok: res.ok, status: res.status, data: parsed };
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

async function sbPatch(table: string, id: number, data: Record<string, unknown>): Promise<void> {
  await fetch(`${SB_URL()}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${SB_KEY()}`, apikey: SB_KEY(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(data),
  });
}

async function sbInsert(table: string, data: Record<string, unknown>): Promise<void> {
  await fetch(`${SB_URL()}/rest/v1/${table}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SB_KEY()}`, apikey: SB_KEY(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(data),
  });
}

async function handleEnrichContent(body: Record<string, unknown>) {
  const products = (body.products as ContentProductInput[]) ?? [];
  const mode: Mode = (body.mode as Mode) ?? "both";
  const dryRun = Boolean(body.dryRun);
  if (products.length === 0) return json({ ok: true, results: [], summary: { total: 0, generated: 0, review_required: 0, skipped: 0 } });

  const results: { productId: number; action: string; confidence: number; notes?: string }[] = [];

  for (const product of products) {
    const type = detectType(product.name);
    if (!type || isGenericName(product.name)) {
      if (!dryRun) {
        await sbPatch("products", product.id, { content_review_required: true });
        await sbInsert("content_generation_log", { product_id: product.id, mode, action: "review_required", confidence: 0.2, notes: "No se pudo identificar tipo de producto" });
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
      await sbPatch("products", product.id, updatePayload);
      await sbInsert("content_generation_log", { product_id: product.id, mode, action: "generated", confidence: 0.9 });
    }
    results.push({ productId: product.id, action: "generated", confidence: 0.9 });
  }

  return json({ ok: true, results, summary: { total: results.length, generated: results.filter(r => r.action === "generated").length, review_required: results.filter(r => r.action === "review_required").length, skipped: 0 } });
}

// ── generate_campaign (template engine — sin dependencia de API externa) ───

const KEYWORDS_BY_SEGMENT: Record<string, string[]> = {
  empresas:     ["comprar notebooks para empresa", "equipamiento IT corporativo", "proveedor tecnología empresas argentina", "laptops empresa precio mayorista", "tecnología corporativa argentina"],
  resellers:    ["distribuidor mayorista tecnología", "comprar al por mayor IT", "mayorista notebooks argentina", "precio mayorista tecnología", "distribuidor IT argentina"],
  integradores: ["proveedor integradores IT", "distribuidor networking mayorista", "switches routers precio mayorista", "equipamiento servidores integradores", "soluciones IT para integradores"],
  general:      ["tecnología para empresas argentina", "equipos IT precio mayorista", "notebooks empresas argentina", "proveedor IT corporativo", "servidores y networking argentina"],
};

const KEYWORDS_BY_PRODUCT: Record<string, string[]> = {
  notebook:     ["notebook empresas precio", "laptops corporativas argentina", "notebook mayorista B2B"],
  server:       ["servidores empresas argentina", "servidor rack precio mayorista", "servidores IT corporativos"],
  networking:   ["switches cisco mayorista", "routers empresas argentina", "access point mayorista"],
  storage:      ["discos SSD empresas", "almacenamiento NVMe mayorista", "storage corporativo argentina"],
  monitor:      ["monitores empresas mayorista", "pantallas corporativas precio", "monitores IT argentina"],
};

const HEADLINES_BY_OBJECTIVE: Record<string, string[]> = {
  leads:      ["Portal B2B Bartez", "Registrate Gratis Hoy", "Cotizá Sin Compromiso", "Acceso B2B Inmediato", "Precios Mayoristas IT", "Tecnología para Empresas"],
  ventas:     ["Comprá IT Mejor Precio", "Stock Disponible Hoy", "Entrega 24-48hs", "Precios Mayoristas IT", "Portal B2B Bartez", "Tecnología Corporativa"],
  awareness:  ["Bartez Tecnología B2B", "Distribuidor IT Argentina", "14.000 Productos IT", "Portal Mayorista B2B", "Catálogo Completo IT", "Precios para Empresas"],
};

const HEADLINES_BY_SEGMENT: Record<string, string[]> = {
  empresas:     ["IT para tu Empresa", "Equipá tu Oficina Ya"],
  resellers:    ["Precio Especial Reseller", "Margen para Revendedores"],
  integradores: ["Stock para Integradores", "Precios para Proyectos IT"],
  general:      ["Tecnología al Mejor Precio", "Catálogo IT Completo"],
};

const DESCRIPTIONS_BY_OBJECTIVE: Record<string, string[]> = {
  leads:     ["Accedé al portal B2B de Bartez. Cotizá tecnología mayorista para tu empresa.", "Registrate y gestioná pedidos IT con precios preferenciales en Argentina."],
  ventas:    ["Notebooks, servidores y networking al precio mayorista con stock en Argentina.", "Catálogo +14.000 productos con precios exclusivos y entrega en todo el país."],
  awareness: ["Bartez: distribuidor mayorista de IT para empresas e integradores en Argentina.", "Portal B2B con más de 14.000 productos tecnológicos y precios mayoristas."],
};

const NEGATIVE_KEYWORDS = ["gratis", "segunda mano", "usado", "reparación", "tutoriales"];

const BIDDING_BY_OBJECTIVE: Record<string, string> = {
  leads:     "Maximizar conversiones",
  ventas:    "CPC manual optimizado",
  awareness: "Maximizar clics",
};

const GROUP_NAMES_BY_SEGMENT: Record<string, string[]> = {
  empresas:     ["Empresas Medianas y Grandes", "Equipamiento Corporativo"],
  resellers:    ["Revendedores IT", "Distribución Mayorista"],
  integradores: ["Integradores de Sistemas", "Proyectos IT"],
  general:      ["Tecnología para Empresas", "IT Corporativo"],
};

function detectProductCategory(focus: string): string | null {
  const f = focus.toLowerCase();
  if (/notebook|laptop/.test(f)) return "notebook";
  if (/server|servidor/.test(f)) return "server";
  if (/switch|router|network|wifi|access/.test(f)) return "networking";
  if (/ssd|nvme|disco|storage|almacenamiento/.test(f)) return "storage";
  if (/monitor|pantalla|display/.test(f)) return "monitor";
  return null;
}

function buildTemplateStructure(seg: string, obj: string, numGroups: number, product_focus: string | number | undefined, daily_budget_ars: string | number | undefined) {
  const baseKeywords = KEYWORDS_BY_SEGMENT[seg] ?? KEYWORDS_BY_SEGMENT.general;
  const productCat = product_focus ? detectProductCategory(String(product_focus)) : null;
  const productKeywords = productCat ? KEYWORDS_BY_PRODUCT[productCat] ?? [] : [];
  const allKeywords = [...new Set([...baseKeywords, ...productKeywords])];

  const baseHeadlines = HEADLINES_BY_OBJECTIVE[obj] ?? HEADLINES_BY_OBJECTIVE.leads;
  const segHeadlines = HEADLINES_BY_SEGMENT[seg] ?? HEADLINES_BY_SEGMENT.general;
  const allHeadlines = [...new Set([...baseHeadlines, ...segHeadlines])];

  const descriptions = DESCRIPTIONS_BY_OBJECTIVE[obj] ?? DESCRIPTIONS_BY_OBJECTIVE.leads;
  const groupNames = GROUP_NAMES_BY_SEGMENT[seg] ?? GROUP_NAMES_BY_SEGMENT.general;
  const chunkSize = Math.ceil(allKeywords.length / numGroups);

  const ad_groups = Array.from({ length: numGroups }, (_, i) => ({
    name: groupNames[i] ?? `Grupo ${i + 1}`,
    keywords: allKeywords.slice(i * chunkSize, (i + 1) * chunkSize).slice(0, 5),
    headlines: allHeadlines.slice(0, 6),
    descriptions: descriptions.slice(0, 2),
  }));

  const productLabel = product_focus ? ` - ${product_focus}` : "";
  const campaignName = `Bartez ${seg} ${obj}${productLabel} ${new Date().toLocaleDateString("es-AR")}`;

  return {
    campaignName,
    structure: {
      name: campaignName,
      ad_groups,
      negative_keywords: NEGATIVE_KEYWORDS,
      bidding_strategy: BIDDING_BY_OBJECTIVE[obj] ?? "Maximizar clics",
      notes: `Campaña generada para segmento "${seg}", objetivo "${obj}". Presupuesto diario: $${Number(daily_budget_ars).toLocaleString("es-AR")} ARS. Revisá los textos antes de activar.`,
    },
  };
}

async function callGemini(prompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 800, temperature: 0.4 },
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

async function handleGenerateCampaign(body: Record<string, unknown>, userId: string) {
  const { objective, campaign_type, target_segment, daily_budget_ars, product_focus, extra_context } = body as Record<string, string | number>;
  const seg = String(target_segment ?? "general");
  const obj = String(objective ?? "leads");
  const numGroups = Math.min(2, Math.max(1, Number(body.num_ad_groups ?? 1)));

  const objectiveLabel: Record<string, string> = {
    leads: "captar leads B2B (formularios de contacto y registro)",
    ventas: "generar ventas directas en el portal B2B",
    awareness: "reconocimiento de marca entre empresas e integradores",
  };
  const segmentLabel: Record<string, string> = {
    empresas: "empresas medianas y grandes de Argentina buscando equipamiento IT",
    resellers: "resellers y distribuidores de tecnología en Argentina",
    integradores: "integradores de sistemas y empresas de servicios IT en Argentina",
    general: "empresas argentinas que necesiten tecnología, laptops, servidores o networking",
  };

  let structure: Record<string, unknown>;
  let campaignName: string;
  let aiModel = "template-v1";

  const geminiKey = process.env.GEMINI_API_KEY;

  if (geminiKey) {
    const prompt = `Sos un experto en Google Ads B2B para el mercado argentino. Generá una campaña completa para Bartez, distribuidora de tecnología mayorista con portal B2B.

PARÁMETROS:
- Objetivo: ${objectiveLabel[String(objective)] ?? objective}
- Tipo: ${campaign_type}
- Segmento: ${segmentLabel[seg] ?? seg}
- Presupuesto diario: $${Number(daily_budget_ars).toLocaleString("es-AR")} ARS
${product_focus ? `- Foco de producto: ${product_focus}` : ""}
${extra_context ? `- Contexto: ${extra_context}` : ""}

Generá ${numGroups} grupo(s) de anuncios. Por grupo: 5 keywords, 6 headlines (máx 30 chars c/u), 2 descriptions (máx 90 chars c/u). Español rioplatense. Foco en B2B Argentina. Sin match_types. 4 negativos globales.

Respondé SOLO con JSON minificado sin markdown:
{"name":"...","ad_groups":[{"name":"...","keywords":[],"headlines":[],"descriptions":[]}],"negative_keywords":[],"bidding_strategy":"...","notes":"..."}`;

    const rawText = await callGemini(prompt);
    if (rawText) {
      try {
        const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          structure = JSON.parse(match[0]);
          campaignName = (structure.name as string) || `Bartez ${seg} ${obj} ${new Date().toLocaleDateString("es-AR")}`;
          aiModel = "gemini-2.0-flash";
        } else {
          throw new Error("no JSON found");
        }
      } catch {
        // Gemini returned invalid JSON — fall back to template
        const tpl = buildTemplateStructure(seg, obj, numGroups, product_focus, daily_budget_ars);
        structure = tpl.structure;
        campaignName = tpl.campaignName;
      }
    } else {
      const tpl = buildTemplateStructure(seg, obj, numGroups, product_focus, daily_budget_ars);
      structure = tpl.structure;
      campaignName = tpl.campaignName;
    }
  } else {
    const tpl = buildTemplateStructure(seg, obj, numGroups, product_focus, daily_budget_ars);
    structure = tpl.structure;
    campaignName = tpl.campaignName;
  }

  const draft = await insertDraft({ created_by: userId, name: campaignName, objective, campaign_type, target_segment, daily_budget_ars, campaign_structure: structure, ai_model: aiModel });
  if (!draft) return json({ ok: false, message: "No se pudo guardar el borrador" }, 500);
  return json({ ok: true, draft });
}

// ── generate_copy ─────────────────────────────────────────────────────────

async function handleSyncGoogleAds(request: Request) {
  const authHeader = request.headers.get("Authorization") || "";
  const result = await callSupabaseFunction("google-ads-sync", authHeader);
  const message =
    (typeof result.data?.message === "string" && result.data.message) ||
    (typeof result.data?.error === "string" && result.data.error) ||
    (result.ok ? "Sincronizacion completada." : "No se pudo sincronizar Google Ads.");

  return json(
    {
      ok: result.ok && result.data?.ok !== false,
      synced: typeof result.data?.synced === "number" ? result.data.synced : 0,
      message,
    },
    result.ok ? 200 : result.status || 500,
  );
}

async function handleLaunchCampaign(request: Request, body: Record<string, unknown>) {
  const authHeader = request.headers.get("Authorization") || "";
  const draftId = typeof body.draft_id === "string" ? body.draft_id : "";
  if (!draftId) return json({ ok: false, message: "draft_id requerido" }, 400);

  const result = await callSupabaseFunction("launch-campaign", authHeader, { draft_id: draftId });
  const message =
    (typeof result.data?.message === "string" && result.data.message) ||
    (typeof result.data?.error === "string" && result.data.error) ||
    (result.ok ? "Campa?a lanzada." : "No se pudo lanzar la campa?a.");

  return json(
    {
      ok: result.ok && result.data?.ok !== false,
      message,
      google_ads_campaign_id:
        typeof result.data?.google_ads_campaign_id === "string" ? result.data.google_ads_campaign_id : null,
      manual_launch: Boolean(result.data?.manual_launch),
      draft_id: draftId,
    },
    result.ok ? 200 : result.status || 500,
  );
}

const COPY_HEADLINES_BY_CATEGORY: Record<string, string[]> = {
  Monitores:    ["Monitores para tu Empresa", "Pantallas Profesionales B2B", "Monitores al Mejor Precio", "Stock Disponible Ya", "Calidad Corporativa"],
  Notebooks:    ["Notebooks para Empresas", "Laptops Corporativas B2B", "Equipá tu Equipo de Trabajo", "Stock Disponible Ya", "Precios Mayoristas IT"],
  Servidores:   ["Servidores para Empresas", "Infraestructura IT Segura", "Servidores al Por Mayor", "Stock Disponible Ya", "Rendimiento Profesional"],
  Networking:   ["Redes para tu Empresa", "Switches y Routers B2B", "Conectividad Profesional", "Stock Disponible Ya", "Networking Mayorista"],
  Almacenamiento: ["Storage Profesional B2B", "Discos y NVMe Mayorista", "Almacenamiento Corporativo", "Stock Disponible Ya", "Precios Mayoristas IT"],
  Periféricos:  ["Periféricos para Oficina", "Teclados y Mouses B2B", "Equipamiento Completo", "Stock Disponible Ya", "Precios Mayoristas IT"],
};

const COPY_DESCS_BY_SEGMENT: Record<string, string[]> = {
  "Empresas corporativas": [
    "Equipá tu empresa con tecnología mayorista. Portal B2B con precios exclusivos y entrega rápida.",
    "Tecnología corporativa con precios preferenciales. Registrate en el portal B2B de Bartez.",
  ],
  "Resellers": [
    "Precios mayoristas para revendedores. Catálogo completo con stock disponible en Argentina.",
    "Márgenes competitivos para resellers. Accedé al portal B2B de Bartez y comprá al por mayor.",
  ],
  "Integradores IT": [
    "Equipamiento para proyectos IT. Precios mayoristas con stock y entrega en todo el país.",
    "Soluciones tecnológicas para integradores. Portal B2B con catálogo de +14.000 productos.",
  ],
  "PyMEs": [
    "Tecnología para PyMEs al mejor precio. Portal B2B de Bartez con precios mayoristas.",
    "Equipá tu PyME con tecnología de calidad. Precios accesibles y stock disponible ya.",
  ],
};

async function generateCopyWithGemini(category: string, segment: string, count: number): Promise<Record<string, string>[] | null> {
  const prompt = `Generá ${count} variante(s) de copy para Google Ads B2B en Argentina para Bartez, distribuidora mayorista de tecnología.

Categoría: ${category}
Segmento: ${segment}

Por variante generá: headline1, headline2, headline3 (máx 30 chars c/u), description1, description2 (máx 90 chars c/u). Español rioplatense. Sin exclamaciones. Foco B2B.

Respondé SOLO con JSON array sin markdown:
[{"headline1":"...","headline2":"...","headline3":"...","description1":"...","description2":"..."}]`;

  const rawText = await callGemini(prompt);
  if (!rawText) return null;
  try {
    const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return null;
    return JSON.parse(match[0]) as Record<string, string>[];
  } catch { return null; }
}

function buildTemplateCopies(category: string, segment: string, count: number): Record<string, string>[] {
  const headlines = COPY_HEADLINES_BY_CATEGORY[category] ?? COPY_HEADLINES_BY_CATEGORY.Notebooks;
  const descs = COPY_DESCS_BY_SEGMENT[segment] ?? COPY_DESCS_BY_SEGMENT["Empresas corporativas"];
  return Array.from({ length: count }, (_, i) => ({
    headline1: headlines[0],
    headline2: headlines[1 + (i % 2)],
    headline3: headlines[3 + (i % 2)],
    description1: descs[0],
    description2: descs[1],
  }));
}

async function handleGenerateCopy(body: Record<string, unknown>, userId: string) {
  const category = String(body.category ?? "Notebooks");
  const segment  = String(body.segment  ?? "Empresas corporativas");
  const count    = Math.min(5, Math.max(1, Number(body.count ?? 3)));

  let copies = await generateCopyWithGemini(category, segment, count);
  const aiModel = copies ? "gemini-2.0-flash" : "template-v1";
  if (!copies) copies = buildTemplateCopies(category, segment, count);

  // Persist to ad_copies table
  const rows = copies.map(c => ({ ...c, category, segment, created_by: userId, status: "draft", ai_model: aiModel }));
  const res = await fetch(`${SB_URL()}/rest/v1/ad_copies`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SB_KEY()}`, apikey: SB_KEY(), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) return json({ ok: false, error: "No se pudieron guardar los copies" }, 500);
  const saved = await res.json() as Record<string, unknown>[];
  return json({ ok: true, copies: saved });
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

  if (action === "enrich_content") return handleEnrichContent(body);

  if (action === "generate_copy") {
    const user = await getAuthUser(request);
    if (!user) return json({ ok: false, error: "Unauthorized" }, 401);
    const profile = await getProfile(user.id);
    if (!profile || !["admin", "vendedor"].includes(profile.role)) return json({ ok: false, error: "Permisos insuficientes" }, 403);
    return handleGenerateCopy(body, user.id);
  }

  if (action === "generate_campaign") {
    const user = await getAuthUser(request);
    if (!user) return json({ ok: false, error: "Unauthorized" }, 401);
    const profile = await getProfile(user.id);
    if (!profile || !["admin", "vendedor"].includes(profile.role)) return json({ ok: false, error: "Permisos insuficientes" }, 403);
    return handleGenerateCampaign(body, user.id);
  }

  if (action === "sync_google_ads") {
    const user = await getAuthUser(request);
    if (!user) return json({ ok: false, error: "Unauthorized" }, 401);
    const profile = await getProfile(user.id);
    if (!profile || profile.role !== "admin") return json({ ok: false, error: "Permisos insuficientes" }, 403);
    return handleSyncGoogleAds(request);
  }

  if (action === "launch_campaign") {
    const user = await getAuthUser(request);
    if (!user) return json({ ok: false, error: "Unauthorized" }, 401);
    const profile = await getProfile(user.id);
    if (!profile || profile.role !== "admin") return json({ ok: false, error: "Permisos insuficientes" }, 403);
    return handleLaunchCampaign(request, body);
  }

  return json({ ok: false, error: `Unknown action: ${action}` }, 400);
}
