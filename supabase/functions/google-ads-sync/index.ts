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

const GOOGLE_TOKEN_URL        = "https://oauth2.googleapis.com/token";
const GOOGLE_ADS_API_BASE     = "https://googleads.googleapis.com/v17";
const API_VERSION             = "v17";

interface CampaignRow {
  campaign_id: string;
  snapshot_date: string;
  impressions: number;
  clicks: number;
  cost_ars: number;
  conversions: number;
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
  const data = await res.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(`OAuth2 error: ${data.error ?? "unknown"}`);
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
      headers: {
        "Authorization":        `Bearer ${accessToken}`,
        "developer-token":      DEVELOPER_TOKEN!,
        "Content-Type":         "application/json",
        "login-customer-id":    CUSTOMER_ID!,
      },
      body: JSON.stringify({ query }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Ads API error ${res.status}: ${err}`);
  }

  const lines = (await res.text()).trim().split("\n");
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
