import { logger } from "@/lib/logger";
import { encabezadosDelPanel } from "@/lib/api/encabezadosDelPanel";

/**
 * Cliente de INVID. Pasa por el proxy /api/invid-proxy, que tiene las credenciales del
 * lado del servidor (INVID_USER e INVID_PASSWORD) y exige sesión del panel.
 */

export interface InvidArticle {
  ID: string;
  TITLE: string;
  PRICE: string;
  CURRENCY: string;
  PART_NUMBER: string;
  BRAND: string;
  DESCRIPTION: string;
  LONG_DESCRIPTION: string;
  STOCK_STATUS: string;
  IMAGE_URL: string;
  CATEGORY_ID: string;
  CATEGORY: string;
  TAGS: Record<string, string[]>;
  HEIGHT: number;
  WIDTH: number;
  LENGTH: number;
  VOLUME: number;
  WEIGHT: number;
  DIMENSIONS_UNIT: string;
  WEIGHT_UNIT: string;
}

export interface InvidArticleResponse {
  status: number;
  data: InvidArticle[];
  next_page_url?: string;
  message?: string;
}

const PROXY_URL = "/api/invid-proxy";

export async function fetchInvidArticlesPage(offset = 0): Promise<InvidArticleResponse | null> {
  try {
    const res = await fetch(`${PROXY_URL}?offset=${encodeURIComponent(String(offset))}`, {
      method: "GET",
      headers: await encabezadosDelPanel(),
    });

    if (!res.ok) {
      const cuerpo = await res.text().catch(() => "");
      let mensaje = `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(cuerpo) as { error?: unknown };
        if (typeof parsed.error === "string") mensaje = parsed.error;
      } catch {
        // cuerpo no JSON
      }
      logger.error("INVID articles error:", res.status, mensaje);
      return { status: 0, data: [], message: mensaje };
    }

    return (await res.json()) as InvidArticleResponse;
  } catch (err) {
    logger.error("Failed to fetch INVID articles", err);
    return null;
  }
}
