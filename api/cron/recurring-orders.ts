import type { VercelRequest, VercelResponse } from "@vercel/node";

import { computeNextRecurringRun, type RecurringFrequency, type RecurringMode } from "../../src/lib/recurringOrders.js";
import { fail, methodNotAllowed, ok } from "../_shared/http.js";
import { createMailerTransport, getDefaultFromEmail, sanitizeHeaderText } from "../_shared/mailer.js";
import { getSupabaseAdmin } from "../_shared/supabaseServer.js";

export const config = { maxDuration: 60 };

interface RecurringOrderRow {
  id: string;
  profile_id: string;
  company_id: string | null;
  name: string;
  items: Array<{ product_id: number; quantity: number }> | null;
  frequency: RecurringFrequency;
  custom_days: number | null;
  next_run_at: string;
  mode: RecurringMode;
  active: boolean;
}

interface ProfileRow {
  id: string;
  email: string | null;
  contact_name: string | null;
  company_name: string | null;
}

function getBackendCronUrl() {
  const explicit = process.env.BACKEND_CRON_URL?.trim();
  if (explicit) return explicit;

  const baseUrl =
    process.env.BACKEND_URL?.trim() ||
    process.env.VITE_BACKEND_URL?.trim() ||
    "";

  if (!baseUrl) return "";
  return `${baseUrl.replace(/\/$/, "")}/v1/cron/recurring-orders`;
}

async function proxyToBackend(url: string, req: VercelRequest, res: VercelResponse) {
  const authHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0] ?? ""
    : (req.headers.authorization ?? "");

  const proxyResponse = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
  });

  const raw = await proxyResponse.text();
  let parsed: unknown = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { ok: proxyResponse.ok, raw };
    }
  }

  return res.status(proxyResponse.status).json(parsed ?? { ok: proxyResponse.ok });
}

async function sendConfirmationEmail(profile: ProfileRow, template: RecurringOrderRow) {
  if (!profile.email) return;

  try {
    const transport = createMailerTransport();
    const contactName = profile.contact_name || profile.company_name || "Cliente";
    const itemsLabel = Array.isArray(template.items) ? template.items.length : 0;

    await transport.sendMail({
      from: `"Bartez Tecnologia" <${getDefaultFromEmail()}>`,
      to: profile.email,
      subject: sanitizeHeaderText(`Confirmacion requerida para "${template.name}"`, "Confirmacion de pedido recurrente"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
          <h2 style="margin-bottom:12px">Pedido recurrente listo para revisar</h2>
          <p>Hola ${contactName},</p>
          <p>La plantilla <strong>${template.name}</strong> ya quedo lista para confirmacion.</p>
          <p>Incluye ${itemsLabel} item(s) y estaba programada para ejecutarse el ${new Date(template.next_run_at).toLocaleString("es-AR")}.</p>
          <p>Entra al portal para revisarla y convertirla en pedido.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("[cron recurring-orders] email error:", error);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);

  const expected = process.env.CRON_SECRET?.trim();
  const authHeader = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0] ?? ""
    : (req.headers.authorization ?? "");

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return fail(res, "Unauthorized", 401);
  }

  const backendCronUrl = getBackendCronUrl();
  if (backendCronUrl) {
    try {
      return await proxyToBackend(backendCronUrl, req, res);
    } catch (error) {
      console.error("[cron recurring-orders] backend proxy failed, using local fallback:", error);
    }
  }

  try {
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from("recurring_orders")
      .select("id, profile_id, company_id, name, items, frequency, custom_days, next_run_at, mode, active")
      .eq("active", true)
      .lte("next_run_at", nowIso)
      .order("next_run_at", { ascending: true })
      .limit(100);

    if (error) return fail(res, error.message, 500);

    const dueTemplates = (data ?? []) as RecurringOrderRow[];
    if (dueTemplates.length === 0) {
      return ok(res, { processed: 0, confirmed_notifications: 0, skipped_auto: 0 });
    }

    const profileIds = Array.from(new Set(dueTemplates.map((template) => template.profile_id)));
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, contact_name, company_name")
      .in("id", profileIds);

    if (profilesError) return fail(res, profilesError.message, 500);

    const profiles = new Map(
      ((profilesData ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
    );

    let confirmedNotifications = 0;
    let skippedAuto = 0;

    for (const template of dueTemplates) {
      const nextRunAt = computeNextRecurringRun(
        template.next_run_at,
        template.frequency,
        template.custom_days,
      );

      if (template.mode === "auto") {
        skippedAuto += 1;
        await supabase
          .from("recurring_orders")
          .update({ next_run_at: nextRunAt })
          .eq("id", template.id);
        continue;
      }

      const profile = profiles.get(template.profile_id);

      await supabase.from("notifications").insert({
        user_id: template.profile_id,
        type: "recurring_order_confirmation",
        title: "Reposicion lista para confirmar",
        body: template.name,
        entity_type: "recurring_order",
        entity_id: template.id,
        metadata: {
          recurring_order_id: template.id,
          name: template.name,
          items_count: Array.isArray(template.items) ? template.items.length : 0,
        },
      });

      await supabase
        .from("recurring_orders")
        .update({ next_run_at: nextRunAt })
        .eq("id", template.id);

      if (profile) {
        await sendConfirmationEmail(profile, template);
      }

      confirmedNotifications += 1;
    }

    return ok(res, {
      processed: dueTemplates.length,
      confirmed_notifications: confirmedNotifications,
      skipped_auto: skippedAuto,
      backend_proxy_used: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[cron recurring-orders] fatal:", error);
    return fail(res, message, 500);
  }
}
