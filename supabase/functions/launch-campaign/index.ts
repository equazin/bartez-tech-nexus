/**
 * launch-campaign — Edge Function
 * Toma un campaign_draft aprobado y lo crea en Google Ads via API.
 * Si no hay credenciales de Google Ads, igual marca el draft como "launched"
 * y devuelve instrucciones para crearlo manualmente.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface LaunchRequest {
  draft_id: string;
}

interface AdGroup {
  name: string;
  keywords: string[];
  headlines: string[];
  descriptions: string[];
}

interface CampaignStructure {
  name: string;
  ad_groups: AdGroup[];
  negative_keywords?: string[];
  bidding_strategy?: string;
}

const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_ADS_DEVELOPER_TOKEN = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");
const GOOGLE_ADS_CLIENT_ID       = Deno.env.get("GOOGLE_ADS_CLIENT_ID");
const GOOGLE_ADS_CLIENT_SECRET   = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET");
const GOOGLE_ADS_REFRESH_TOKEN   = Deno.env.get("GOOGLE_ADS_REFRESH_TOKEN");
const GOOGLE_ADS_CUSTOMER_ID     = Deno.env.get("GOOGLE_ADS_CUSTOMER_ID");
const GOOGLE_ADS_LOGIN_CUSTOMER_ID = Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID")?.replace(/-/g, "") ?? "";
const GOOGLE_ADS_API_VERSION = Deno.env.get("GOOGLE_ADS_API_VERSION") ?? "v23";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GoogleAdsApiErrorPayload {
  error?: { message?: string };
  error_description?: string;
  message?: string;
}

function buildGoogleAdsHeaders(accessToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": GOOGLE_ADS_DEVELOPER_TOKEN!,
    "Content-Type": "application/json",
  };

  if (GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
    headers["login-customer-id"] = GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  }

  return headers;
}

function buildGoogleAdsCustomerBaseUrl(customerId: string): string {
  return `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId.replace(/-/g, "")}`;
}

function summarizeUpstreamBody(raw: string): string {
  const compact = raw.replace(/\s+/g, " ").trim();
  if (!compact) return "sin detalle adicional";
  return compact.length > 240 ? `${compact.slice(0, 240)}...` : compact;
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
    const upstreamMessage =
      parsed?.error?.message ||
      parsed?.error_description ||
      parsed?.message ||
      summarizeUpstreamBody(raw);
    throw new Error(`${context} fallo (${response.status}): ${upstreamMessage}`);
  }

  if (!parsed) {
    const contentType = response.headers.get("content-type") || "desconocido";
    throw new Error(`${context} devolvio una respuesta no JSON (${contentType}): ${summarizeUpstreamBody(raw)}`);
  }

  return parsed;
}

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     GOOGLE_ADS_CLIENT_ID!,
      client_secret: GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN!,
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

async function createCampaignInGoogleAds(
  accessToken: string,
  structure:   CampaignStructure,
  budgetArs:   number,
): Promise<string> {
  const customerId = GOOGLE_ADS_CUSTOMER_ID!.replace(/-/g, "");
  const baseUrl    = buildGoogleAdsCustomerBaseUrl(customerId);
  const headers = buildGoogleAdsHeaders(accessToken);

  // 1. Create campaign budget (in micros)
  const budgetMicros = Math.round(budgetArs * 1_000_000);
  const budgetRes = await fetch(`${baseUrl}/campaignBudgets:mutate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      operations: [{
        create: {
          name:           `Budget_${structure.name}_${Date.now()}`,
          amountMicros:   budgetMicros,
          deliveryMethod: "STANDARD",
        },
      }],
    }),
  });
  const budgetData = await readJsonResponse<{ results?: { resourceName: string }[] }>(
    budgetRes,
    "Creacion de presupuesto en Google Ads",
  );
  const budgetResource = budgetData.results?.[0]?.resourceName;
  if (!budgetResource) throw new Error("No se pudo crear el presupuesto en Google Ads");

  // 2. Create campaign
  const campaignRes = await fetch(`${baseUrl}/campaigns:mutate`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      operations: [{
        create: {
          name:              structure.name,
          status:            "PAUSED",   // always start paused — admin activates manually
          advertisingChannelType: "SEARCH",
          campaignBudget:    budgetResource,
          maximizeConversions: {},
          networkSettings: {
            targetGoogleSearch:        true,
            targetSearchNetwork:       true,
            targetContentNetwork:      false,
            targetPartnerSearchNetwork: false,
          },
          geoTargetTypeSetting: {
            positiveGeoTargetType: "PRESENCE",
          },
        },
      }],
    }),
  });
  const campaignData = await readJsonResponse<{ results?: { resourceName: string }[] }>(
    campaignRes,
    "Creacion de campana en Google Ads",
  );
  const campaignResource = campaignData.results?.[0]?.resourceName;
  if (!campaignResource) throw new Error("No se pudo crear la campaña en Google Ads");
  const campaignId = campaignResource.split("/").pop()!;

  // 3. Create ad groups + ads + keywords
  for (const ag of structure.ad_groups) {
    // Create ad group
    const agRes = await fetch(`${baseUrl}/adGroups:mutate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        operations: [{
          create: {
            name:     ag.name,
            campaign: campaignResource,
            status:   "ENABLED",
            type:     "SEARCH_STANDARD",
          },
        }],
      }),
    });
    const agData = await readJsonResponse<{ results?: { resourceName: string }[] }>(
      agRes,
      `Creacion del grupo de anuncios "${ag.name}" en Google Ads`,
    );
    const agResource = agData.results?.[0]?.resourceName;
    if (!agResource) continue;

    // Create RSA ad
    const headlines     = ag.headlines.slice(0, 15).map((text) => ({ text: text.slice(0, 30) }));
    const descriptions  = ag.descriptions.slice(0, 4).map((text) => ({ text: text.slice(0, 90) }));
    const adRes = await fetch(`${baseUrl}/adGroupAds:mutate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        operations: [{
          create: {
            adGroup: agResource,
            status:  "ENABLED",
            ad: {
              finalUrls: ["https://bartez.com.ar/empresas"],
              responsiveSearchAd: { headlines, descriptions },
            },
          },
        }],
      }),
    });
    await readJsonResponse<Record<string, unknown>>(
      adRes,
      `Creacion del anuncio RSA para "${ag.name}" en Google Ads`,
    );

    // Create keywords (broad match by default)
    const kwOps = ag.keywords.slice(0, 20).map((kw) => ({
      create: {
        adGroup:   agResource,
        text:      kw,
        matchType: "BROAD",
        status:    "ENABLED",
      },
    }));
    if (kwOps.length > 0) {
      const kwRes = await fetch(`${baseUrl}/adGroupCriteria:mutate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ operations: kwOps }),
      });
      await readJsonResponse<Record<string, unknown>>(
        kwRes,
        `Creacion de keywords para "${ag.name}" en Google Ads`,
      );
    }
  }

  // 4. Negative keywords at campaign level
  if ((structure.negative_keywords ?? []).length > 0) {
    const negOps = (structure.negative_keywords ?? []).slice(0, 30).map((kw) => ({
      create: {
        campaign:  campaignResource,
        keyword: { text: kw, matchType: "BROAD" },
      },
    }));
    const negRes = await fetch(`${baseUrl}/campaignCriteria:mutate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ operations: negOps }),
    });
    await readJsonResponse<Record<string, unknown>>(
      negRes,
      "Creacion de keywords negativas en Google Ads",
    );
  }

  return campaignId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Auth
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ ok: false, message: "No autorizado" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["admin"].includes(profile.role)) {
      return new Response(JSON.stringify({ ok: false, message: "Solo admins pueden lanzar campañas" }), {
        status: 403, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { draft_id } = await req.json() as LaunchRequest;

    // Load draft
    const { data: draft, error: draftErr } = await supabase
      .from("campaign_drafts")
      .select("*")
      .eq("id", draft_id)
      .single();

    if (draftErr || !draft) {
      return new Response(JSON.stringify({ ok: false, message: "Draft no encontrado" }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    if (draft.status !== "approved") {
      return new Response(JSON.stringify({ ok: false, message: "El draft debe estar aprobado antes de lanzar" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const hasGoogleAds = GOOGLE_ADS_DEVELOPER_TOKEN && GOOGLE_ADS_CLIENT_ID &&
                         GOOGLE_ADS_CLIENT_SECRET && GOOGLE_ADS_REFRESH_TOKEN && GOOGLE_ADS_CUSTOMER_ID;

    let googleAdsCampaignId: string | null = null;
    let launchError: string | null = null;

    if (hasGoogleAds) {
      try {
        const accessToken = await getAccessToken();
        googleAdsCampaignId = await createCampaignInGoogleAds(
          accessToken,
          draft.campaign_structure as CampaignStructure,
          draft.daily_budget_ars ?? 0,
        );
      } catch (e) {
        launchError = e instanceof Error ? e.message : String(e);
      }
    }

    // Update draft status
    await supabase.from("campaign_drafts").update({
      status:                  launchError ? "launch_error" : "launched",
      reviewed_by:             user.id,
      reviewed_at:             new Date().toISOString(),
      google_ads_campaign_id:  googleAdsCampaignId,
      launch_error:            launchError,
    }).eq("id", draft_id);

    // If launched via API, also insert into ad_campaigns for tracking
    if (googleAdsCampaignId) {
      await supabase.from("ad_campaigns").upsert({
        id:             googleAdsCampaignId,
        name:           draft.name,
        type:           draft.campaign_type,
        target_segment: draft.target_segment,
        daily_budget:   draft.daily_budget_ars,
        source:         "google_ads_api",
        status:         "paused",
      }, { onConflict: "id" });
    }

    if (launchError) {
      return new Response(JSON.stringify({
        ok:    false,
        message: `Error al crear en Google Ads: ${launchError}`,
        draft_id,
      }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      ok: true,
      google_ads_campaign_id: googleAdsCampaignId,
      manual_launch: !hasGoogleAds,
      message: hasGoogleAds
        ? `Campaña creada en Google Ads (ID: ${googleAdsCampaignId}). Está en PAUSED — activala desde Google Ads cuando estés listo.`
        : "Campaña marcada como lanzada. Configurá las credenciales de Google Ads en Supabase Secrets para crear campañas automáticamente.",
    }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, message: msg }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
