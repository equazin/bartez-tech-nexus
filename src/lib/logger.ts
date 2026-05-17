/**
 * Tiny logger wrapper.
 *
 * Goals:
 *  - Production drops `debug`/`info`/`log` (still noisy in browser devtools and
 *    a CPU/memory cost). `warn`/`error` stay, so prod incidents remain visible
 *    and ready to be forwarded to Sentry / Logflare later.
 *  - Same interface everywhere; teams can swap the transport once without
 *    chasing 60+ raw `console.*` calls.
 *
 * Do **not** use raw `console.*` in new code — import this instead.
 */

const isProd = typeof import.meta !== "undefined" && import.meta.env?.PROD === true;

type LogArg = unknown;

function emit(level: "debug" | "info" | "warn" | "error", args: LogArg[]) {
  if (typeof console === "undefined") return;
  if (isProd && (level === "debug" || level === "info")) return;
  const target = console[level] ?? console.log;
  try {
    target.apply(console, args as never);
  } catch {
    // Defensive: some bundlers strip `console` in prod builds.
  }
}

export const logger = {
  debug: (...args: LogArg[]) => emit("debug", args),
  info: (...args: LogArg[]) => emit("info", args),
  warn: (...args: LogArg[]) => emit("warn", args),
  error: (...args: LogArg[]) => emit("error", args),
};
