/**
 * google-ads-sync — Supabase Edge Function (cron diario)
 *
 * Sincroniza rendimiento de campañas de Google Ads a ad_performance_snapshots.
 *
 * SETUP (variables de entorno en Supabase Dashboard > Edge Functions > Secrets):
 *   GOOGLE_ADS_DEVELOPER_TOKEN  — Developer token de Google Ads API
 *   GOOGLE_ADS_CLIENT_ID        — OAuth2 Client ID
 *   GOOGLE_ADS_CLIENT_SECRET    — OAuth2 Client Secret
 *   GOOGLE_ADS_REFRESH_TOKEN    — OAuth2 Refresh Token del MCC / cuenta principal
 *   GOOGLE_ADS_CUSTOMER_ID      — Customer ID (sin guiones, ej: 1234567890)
 *   SUPABASE_URL                — Auto-provisioned
 *   SUPABASE_SERVICE_ROLE_KEY   — Auto-provisioned
 *
 * CRON: configurar en supabase/config.toml o vía API:
 *   schedule: "0 6 * * *"  (6am UTC = 3am ARG)
 *
 * ESTADO: scaffold listo — activar cuando se tengan las credenciales de Google Ads API.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL            = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEVELOPER_TOKEN         = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");
const CLIENT_ID               = Deno.env.get("GOOGLE_ADS_CLIENT_ID");
const CLIENT_SECRET           = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET");
const REFRESH_TOKEN           = Deno.env.get("GOOGLE_ADS_REFRESH_TOKEN");
const CUSTOMER_ID             = Deno.env.get("GOOGLE_ADS_CUSTOMER_ID");
const LOGIN_CUSTOMER_ID       = Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID")?.replace(/-/g, "") ?? "";
const GOOGLE_ADS_API_VERSION  = Deno.env.get("GOOGLE_ADS_API_VERSION") ?? "v23";

const GOOGLE_TOKEN_URL        = "https://oauth2.googleapis.com/token";
const GOOGLE_ADS_API_BASE     = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

interface CampaignRow {
  campaign_id: string;
  snapshot_date: string;
  impressions: number;
  clicks: number;
  cost_ars: number;
  conversions: number;
}

interface GoogleAdsApiErrorPayload {
  error?: {
    message?: string;
    details?: Array<{
      "@type"?: string;
      requestId?: string;
      errors?: Array<{
        errorCode?: Record<string, string>;
        message?: string;
      }>;
    }>;
  };
  error_description?: string;
  message?: string;
}

function buildGoogleAdsHeaders(accessToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": DEVELOPER_TOKEN!,
    "Content-Type": "application/json",
  };

  if (LOGIN_CUSTOMER_ID) {
    headers["login-customer-id"] = LOGIN_CUSTOMER_ID;
  }

  return headers;
}

function summarizeUpstreamBody(raw: string): string {
  const compact = raw.replace(/\s+/g, " ").trim();
  if (!compact) return "sin detalle adicional";
  return compact.length > 240 ? `${compact.slice(0, 240)}...` : compact;
}

function extractGoogleAdsErrorMessage(
  parsed: GoogleAdsApiErrorPayload | null,
  raw: string,
): string {
  const detail = parsed?.error?.details?.find((entry) => Array.isArray(entry.errors));
  const errors = detail?.errors ?? [];
  const requestId = detail?.requestId ? ` Request ID: ${detail.requestId}.` : "";
  const codes = errors.flatMap((entry) => Object.values(entry.errorCode ?? {}));
  const detailMessage = errors
    .map((entry) => entry.message?.trim())
    .filter((message): message is string => Boolean(message))
    .join(" ");

  if (codes.includes("DEVELOPER_TOKEN_NOT_APPROVED")) {
    return `DEVELOPER_TOKEN_NOT_APPROVED: el developer token actual solo tiene acceso a cuentas de prueba. Solicita Basic o Standard access en Google Ads API Center para operar cuentas reales.${requestId}`;
  }

  if (codes.includes("USER_PERMISSION_DENIED")) {
    const hint = LOGIN_CUSTOMER_ID
      ? "Verifica que el usuario OAuth tenga acceso directo a la cuenta o que el manager configurado en GOOGLE_ADS_LOGIN_CUSTOMER_ID administre esta cuenta."
      : "La cuenta OAuth no tiene acceso directo a la cuenta o falta configurar GOOGLE_ADS_LOGIN_CUSTOMER_ID para operar via una cuenta administradora (MCC).";
    return `USER_PERMISSION_DENIED: ${hint}${requestId}`;
  }

  if (detailMessage) {
    return `${detailMessage}${requestId}`.trim();
  }

  return (
    parsed?.error?.message ||
    parsed?.error_description ||
    parsed?.message ||
    summarizeUpstreamBody(raw)
  );
}

async function readJsonResponse<T>(response: Response, context: string): Promise<T> {
  const raw = await response.text();
  let parsed: (T & GoogleAdsApiErrorPayload) | null = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw) as T & GoogleAdsApiErrorPayload;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const upstreamMessage = extractGoogleAdsErrorMessage(parsed, raw);
    throw new Error(`${context} fallo (${response.status}): ${upstreamMessage}`);
  }

  if (!parsed) {
    const contentType = response.headers.get("content-type") || "desconocido";
    throw new Error(`${context} devolvio una respuesta no JSON (${contentType}): ${summarizeUpstreamBody(raw)}`);
  }

  return parsed;
}

// ── OAuth2 access token ───────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      refresh_token: REFRESH_TOKEN!,
      grant_type:    "refresh_token",
    }),
  });
  const data = await readJsonResponse<{ access_token?: string; error?: string; error_description?: string }>(
    res,
    "OAuth de Google Ads",
  );
  if (!data.access_token) {
    throw new Error(`OAuth de Google Ads sin token de acceso: ${data.error_description ?? data.error ?? "unknown"}`);
  }
  return data.access_token;
}

// ── Google Ads API query ──────────────────────────────────────

async function fetchCampaignStats(
  accessToken: string,
  dateRange: { start: string; end: string },
): Promise<CampaignRow[]> {
  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${dateRange.start}' AND '${dateRange.end}'
    AND campaign.status != 'REMOVED'
  `;

  const res = await fetch(
    `${GOOGLE_ADS_API_BASE}/customers/${CUSTOMER_ID}/googleAds:searchStream`,
    {
      method: "POST",
      headers: buildGoogleAdsHeaders(accessToken),
      body: JSON.stringify({ query }),
    },
  );

  if (!res.ok) {
    const raw = await res.text();
    let parsed: GoogleAdsApiErrorPayload | null = null;

    if (raw) {
      try {
        parsed = JSON.parse(raw) as GoogleAdsApiErrorPayload;
      } catch {
        parsed = null;
      }
    }

    throw new Error(
      `Lectura de rendimiento en Google Ads fallo (${res.status}): ${extractGoogleAdsErrorMessage(parsed, raw)}`,
    );
  }

  const raw = await res.text();
  if (!raw.trim()) return [];

  const lines = raw.trim().split("\n");
  const rows: CampaignRow[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const batch = JSON.parse(line) as { results?: Array<{
      campaign: { id: string };
      metrics: { impressions: number; clicks: number; cost_micros: number; conversions: number };
    }> };

    for (const r of batch.results ?? []) {
      rows.push({
        campaign_id:   r.campaign.id,
        snapshot_date: dateRange.end,
        impressions:   r.metrics.impressions,
        clicks:        r.metrics.clicks,
        // cost_micros → ARS (Google Ads devuelve en la moneda de la cuenta)
        cost_ars:      r.metrics.cost_micros / 1_000_000,
        conversions:   r.metrics.conversions,
      });
    }
  }

  return rows;
}

// ── Main handler ─────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Permitir invocación manual via POST (para testing)
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Verificar credenciales configuradas
  if (!DEVELOPER_TOKEN || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !CUSTOMER_ID) {
    // Sin credenciales → retornar estado sin error (función existe pero no está configurada)
    await supabase.from("api_usage_log").insert({
      api_name: "google_ads", operation: "sync",
      success: false, error_msg: "Credentials not configured",
    });
    return new Response(JSON.stringify({
      ok: false,
      message: "Google Ads API credentials not configured. Set secrets in Supabase Dashboard.",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  try {
    const accessToken = await getAccessToken();
    const rows = await fetchCampaignStats(accessToken, { start: dateStr, end: dateStr });

    if (rows.length > 0) {
      // Upsert campaigns
      const campaigns = [...new Set(rows.map(r => r.campaign_id))].map(id => ({
        id, name: `Campaign ${id}`, source: "google_ads_api", updated_at: new Date().toISOString(),
      }));
      await supabase.from("ad_campaigns").upsert(campaigns, { onConflict: "id", ignoreDuplicates: false });

      // Upsert snapshots
      await supabase.from("ad_performance_snapshots").upsert(rows, {
        onConflict: "campaign_id,snapshot_date",
        ignoreDuplicates: false,
      });
    }

    // Log usage
    await supabase.from("api_usage_log").insert({
      api_name: "google_ads", operation: "sync",
      units_used: rows.length, success: true,
    });

    return new Response(JSON.stringify({ ok: true, synced: rows.length, date: dateStr }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase.from("api_usage_log").insert({
      api_name: "google_ads", operation: "sync",
      success: false, error_msg: msg,
    });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
