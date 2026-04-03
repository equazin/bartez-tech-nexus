/**
 * marketingTracker.ts
 * Tracking de funnel B2B — sesión persistente, UTMs, deduplicación, retry queue
 */

import { supabase } from "@/lib/supabase";

// ── Tipos ─────────────────────────────────────────────────────

export type TrackEventType =
  | "page_view"
  | "landing_empresas_view"
  | "cta_click"
  | "registration_start"
  | "registration_complete"
  | "account_approved"
  | "portal_first_login"
  | "first_order"
  | "order_placed";

interface UTMParams {
  utm_source:   string | null;
  utm_medium:   string | null;
  utm_campaign: string | null;
  utm_term:     string | null;
  utm_content:  string | null;
}

interface TrackPayload {
  event_id:    string;
  event_type:  TrackEventType;
  user_id?:    string | null;
  session_id:  string;
  page:        string;
  utm_source:   string | null;
  utm_medium:   string | null;
  utm_campaign: string | null;
  utm_term:     string | null;
  utm_content:  string | null;
  metadata:    Record<string, unknown>;
  created_at:  string;
}

// ── Constantes ────────────────────────────────────────────────

const SESSION_KEY       = "btx_sid";
const SESSION_TS_KEY    = "btx_sid_ts";
const SESSION_DURATION  = 30 * 60 * 1000; // 30 minutos
const UTM_FIRST_KEY     = "btx_utm_first";
const UTM_LAST_KEY      = "btx_utm_last";
const RETRY_QUEUE_KEY   = "btx_retry_queue";
const MAX_RETRY_QUEUE   = 20; // máximo eventos en cola (evitar bloat)

// ── Session ───────────────────────────────────────────────────

function generateId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch (e) { /* ignore */ }

  // Fallback Robusto (formato UUID v4 aproximado)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/** Valida si un string tiene formato UUID */
function isValidUUID(uuid: string | null | undefined): boolean {
  if (!uuid) return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(uuid);
}

export function getOrCreateSession(): string {
  try {
    const now     = Date.now();
    const stored  = localStorage.getItem(SESSION_KEY);
    const storedTs = Number(localStorage.getItem(SESSION_TS_KEY) ?? "0");

    // Si hay sesión válida y no expiró, renovar timestamp y devolver
    if (stored && (now - storedTs) < SESSION_DURATION) {
      localStorage.setItem(SESSION_TS_KEY, String(now));
      return stored;
    }

    // Sesión expirada o inexistente — crear nueva
    const newId = generateId();
    localStorage.setItem(SESSION_KEY, newId);
    localStorage.setItem(SESSION_TS_KEY, String(now));
    return newId;
  } catch {
    // localStorage bloqueado (modo privado extremo)
    return generateId();
  }
}

// ── UTM Capture ───────────────────────────────────────────────

function parseUTMsFromURL(): UTMParams {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source:   params.get("utm_source"),
    utm_medium:   params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    utm_term:     params.get("utm_term"),
    utm_content:  params.get("utm_content"),
  };
}

function hasAnyUTM(u: UTMParams): boolean {
  return !!(u.utm_source || u.utm_medium || u.utm_campaign);
}

/**
 * Captura UTMs de la URL actual.
 * - Si hay UTMs en la URL: actualiza last_touch, guarda first_touch si no existe
 * - Si no hay UTMs en la URL: usa last_touch guardado (sesión persistente)
 * Se llama UNA vez por navegación.
 */
export function captureUTMs(): UTMParams {
  try {
    const fromURL = parseUTMsFromURL();

    if (hasAnyUTM(fromURL)) {
      // Siempre actualizar last touch
      localStorage.setItem(UTM_LAST_KEY, JSON.stringify(fromURL));

      // Guardar first touch solo si no existe aún
      if (!localStorage.getItem(UTM_FIRST_KEY)) {
        localStorage.setItem(UTM_FIRST_KEY, JSON.stringify(fromURL));
      }
      return fromURL;
    }

    // Sin UTMs en URL → devolver last touch guardado
    const lastRaw = localStorage.getItem(UTM_LAST_KEY);
    if (lastRaw) {
      try { return JSON.parse(lastRaw) as UTMParams; } catch { /* ignore */ }
    }

    return { utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null };
  } catch {
    return { utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null };
  }
}

export function getFirstTouchUTMs(): UTMParams | null {
  try {
    const raw = localStorage.getItem(UTM_FIRST_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UTMParams;
  } catch {
    return null;
  }
}

export function getLastTouchUTMs(): UTMParams | null {
  try {
    const raw = localStorage.getItem(UTM_LAST_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UTMParams;
  } catch {
    return null;
  }
}

// ── Retry Queue ───────────────────────────────────────────────

function enqueueRetry(payload: TrackPayload): void {
  try {
    const raw   = localStorage.getItem(RETRY_QUEUE_KEY);
    const queue: TrackPayload[] = raw ? (JSON.parse(raw) as TrackPayload[]) : [];
    queue.push(payload);
    // Limitar tamaño — descartar los más viejos
    const trimmed = queue.slice(-MAX_RETRY_QUEUE);
    localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}

async function flushRetryQueue(): Promise<void> {
  try {
    const raw = localStorage.getItem(RETRY_QUEUE_KEY);
    if (!raw) return;
    const queue: TrackPayload[] = JSON.parse(raw) as TrackPayload[];
    if (!queue.length) return;

    const { error } = await supabase
      .from("marketing_events")
      .upsert(queue, { onConflict: "event_id", ignoreDuplicates: true });

    if (!error) {
      localStorage.removeItem(RETRY_QUEUE_KEY);
    }
  } catch { /* ignore — se reintentará la próxima vez */ }
}

// ── Core Track ────────────────────────────────────────────────

let _currentUTMs: UTMParams | null = null;

/** Llamar cuando cambia la ruta para actualizar UTMs activos */
export function refreshUTMs(): void {
  _currentUTMs = captureUTMs();
}

export async function track(
  event_type: TrackEventType,
  metadata: Record<string, unknown> = {},
  userId?: string | null,
): Promise<void> {
  // Intentar flush de cola pendiente (fire-and-forget, no bloquea)
  void flushRetryQueue();

  const utms       = _currentUTMs ?? captureUTMs();
  const session_id = getOrCreateSession();
  const event_id   = generateId();

  const payload: TrackPayload = {
    event_id,
    event_type,
    user_id:    isValidUUID(userId) ? userId : null,
    session_id: isValidUUID(session_id) ? session_id : generateId(),
    page:       typeof window !== "undefined" ? window.location.pathname : "",
    ...utms,
    metadata,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("marketing_events")
    .insert(payload);

  if (error) {
    // No bloquear la UI — encolar para retry silencioso
    enqueueRetry(payload);
  }
}

// ── Helpers de alto nivel ─────────────────────────────────────

/** Trackear click en CTA "Solicitar cuenta" */
export function trackCTAClick(ctaLabel: string, userId?: string | null): void {
  void track("cta_click", { cta_label: ctaLabel }, userId);
}

/** Trackear inicio de formulario de registro */
export function trackRegistrationStart(): void {
  void track("registration_start");
}

/** Trackear registro completado (llamar después de create-user exitoso) */
export function trackRegistrationComplete(userId: string, company?: string): void {
  void track("registration_complete", { company: company ?? null }, userId);
}

/** Trackear primer orden completada */
export function trackFirstOrder(userId: string, orderId: string, total: number, marginPct?: number): void {
  void track("first_order", { order_id: orderId, total, margin_pct: marginPct ?? null }, userId);
}

/** Trackear orden (no primera) */
export function trackOrderPlaced(userId: string, orderId: string, total: number): void {
  void track("order_placed", { order_id: orderId, total }, userId);
}
