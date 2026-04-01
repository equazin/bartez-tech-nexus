import { createClient } from "@supabase/supabase-js";

export const config = { maxDuration: 60 };

type Mode = "only_descriptions" | "only_specs" | "both";

interface ContentProductInput {
  id: number;
  name: string;
  brand?: string | null;
  sku?: string | null;
  description_short?: string | null;
  description_full?: string | null;
  specs?: Record<string, string> | null;
}

interface ContentResult {
  productId: number;
  action: "generated" | "review_required" | "skipped";
  confidence: number;
  notes?: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function getSupabase(request: Request) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    request.headers.get("x-supabase-apikey") ||
    "";
  if (!url || !key) {
    throw new Error("Missing Supabase URL/API key for content-enricher");
  }
  return createClient(url, key);
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  if (!m) return null;
  return `${m[1]} ${m[2].toUpperCase()}`;
}

function readSpeed(name: string): string | null {
  const m = normalize(name).match(/(\d{3,5})\s*(mhz|mb\/s|mbps|gbps)\b/);
  if (!m) return null;
  return `${m[1]} ${m[2].toUpperCase()}`;
}

function buildShort(type: string, name: string): string {
  if (type === "networking") return "Equipo de red confiable para entornos de trabajo, con conectividad estable y rendimiento consistente.";
  if (type === "storage") return "Unidad de almacenamiento para acelerar cargas y mejorar tiempos de respuesta en uso profesional.";
  if (type === "memory") return "Memoria de alto desempeño para mejorar fluidez en multitarea y cargas exigentes.";
  if (type === "display") return "Monitor pensado para uso profesional con imagen nítida y operación estable.";
  if (type === "notebook") return "Notebook orientada a productividad, ideal para trabajo diario en oficina o movilidad.";
  if (type === "gpu") return "Tarjeta gráfica diseñada para cargas visuales exigentes con desempeño estable.";
  if (type === "pos") return "Equipo POS para operación comercial continua con integración simple en puntos de venta.";
  if (type === "peripheral") return "Periférico confiable para mejorar la experiencia de uso en puestos de trabajo.";
  return `Producto tecnológico ${name} orientado a uso profesional.`;
}

function buildFull(type: string, name: string, brand: string | null | undefined): string {
  const brandLine = brand ? `de ${brand}` : "de tecnología";
  const intro = `🚀 ${name} ${brandLine}, pensado para operaciones B2B que necesitan estabilidad y continuidad.`;
  if (type === "networking") {
    return `${intro}\n\n⚡ Ofrece conectividad sólida para oficinas, locales y entornos con múltiples equipos.\n🔒 Integra funciones orientadas a seguridad y administración de red.\n\nIdeal para implementaciones donde la disponibilidad y la velocidad son prioritarias.\n\n• Instalación simple\n• Operación continua\n• Rendimiento estable`;
  }
  if (type === "storage") {
    return `${intro}\n\n⚡ Mejora tiempos de arranque y acceso a archivos.\n🧩 Se integra fácilmente en estaciones de trabajo y equipos empresariales.\n\nIdeal para actualización de rendimiento y expansión de capacidad.\n\n• Respuesta ágil\n• Compatibilidad amplia\n• Uso profesional diario`;
  }
  if (type === "memory") {
    return `${intro}\n\n⚡ Incrementa la capacidad de trabajo simultáneo en aplicaciones exigentes.\n🛠️ Diseñada para mantener estabilidad bajo uso intensivo.\n\nIdeal para oficinas técnicas, diseño y multitarea avanzada.\n\n• Mejor fluidez\n• Operación consistente\n• Instalación directa`;
  }
  return `${intro}\n\n✅ Combina practicidad y especificaciones técnicas para uso corporativo.\n💼 Recomendado para empresas que buscan relación costo/rendimiento equilibrada.\n\n• Calidad profesional\n• Implementación simple\n• Soporte para uso continuo`;
}

function buildSpecs(type: string, name: string, sku?: string | null): Record<string, string> {
  const capacity = readCapacity(name);
  const speed = readSpeed(name);
  const out: Record<string, string> = {
    tecnologia: type,
    compatibilidad: "Plataformas estándar del mercado",
  };
  if (capacity) out.capacidad = capacity;
  if (speed) out.velocidad = speed;
  if (sku) out.modelo = sku;

  if (type === "networking") {
    out.interfaces = "Ethernet / Inalámbrica (según modelo)";
    out.alimentacion = "Corriente continua mediante adaptador";
  } else if (type === "storage") {
    out.interfaces = "SATA / NVMe (según modelo)";
    out.alimentacion = "Vía bus del equipo";
  } else if (type === "memory") {
    out.interfaces = "Ranura DIMM/SODIMM (según modelo)";
    out.alimentacion = "Baja tensión de operación";
  } else if (type === "display") {
    out.interfaces = "HDMI / DisplayPort (según modelo)";
    out.alimentacion = "Fuente interna o adaptador externo";
  } else if (type === "pos") {
    out.interfaces = "USB / Red / Serie (según modelo)";
    out.alimentacion = "Adaptador incluido";
  } else {
    out.interfaces = "Según versión de fabricante";
    out.alimentacion = "Según especificación técnica";
  }

  return out;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, x-supabase-apikey" } });
  }
  if (request.method !== "POST") return json({ ok: false, error: "Use POST" }, 405);

  let body: { products?: ContentProductInput[]; mode?: Mode; dryRun?: boolean };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const products = body.products ?? [];
  const mode: Mode = body.mode ?? "both";
  if (products.length === 0) return json({ ok: true, results: [], summary: { total: 0, generated: 0, review_required: 0, skipped: 0 } });

  let supabase;
  try {
    supabase = getSupabase(request);
  } catch (error) {
    return json({ ok: false, error: (error as Error).message }, 500);
  }
  const results: ContentResult[] = [];

  for (const product of products) {
    const type = detectType(product.name);
    if (!type || isGenericName(product.name)) {
      if (!body.dryRun) {
        await supabase
          .from("products")
          .update({ content_review_required: true })
          .eq("id", product.id);
        await supabase.from("content_generation_log").insert({
          product_id: product.id,
          mode,
          action: "review_required",
          confidence: 0.2,
          notes: "No se pudo identificar tipo de producto con suficiente confianza",
        });
      }
      results.push({ productId: product.id, action: "review_required", confidence: 0.2, notes: "producto ambiguo" });
      continue;
    }

    const short = buildShort(type, product.name);
    const full = buildFull(type, product.name, product.brand);
    const techSpecs = buildSpecs(type, product.name, product.sku);
    const mergedSpecs = { ...(product.specs ?? {}), ...techSpecs };

    if (!body.dryRun) {
      const updatePayload: Record<string, unknown> = {
        content_review_required: false,
      };
      if (mode === "both" || mode === "only_descriptions") {
        updatePayload.description_short = short;
        updatePayload.description_full = full;
        updatePayload.description = full;
      }
      if (mode === "both" || mode === "only_specs") {
        updatePayload.specs = mergedSpecs;
      }

      await supabase
        .from("products")
        .update(updatePayload)
        .eq("id", product.id);

      await supabase.from("content_generation_log").insert({
        product_id: product.id,
        mode,
        action: "generated",
        confidence: 0.9,
      });
    }

    results.push({ productId: product.id, action: "generated", confidence: 0.9 });
  }

  const summary = {
    total: results.length,
    generated: results.filter((r) => r.action === "generated").length,
    review_required: results.filter((r) => r.action === "review_required").length,
    skipped: results.filter((r) => r.action === "skipped").length,
  };

  return json({ ok: true, results, summary });
}
