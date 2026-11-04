import nodemailer from "nodemailer";

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} env var is required`);
  }
  return value;
}

export function createMailerTransport() {
  const host = readRequiredEnv("SMTP_HOST");
  const user = readRequiredEnv("SMTP_USER");
  const pass = readRequiredEnv("SMTP_PASS");
  const port = Number(process.env.SMTP_PORT ?? 587);

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("SMTP_PORT must be a positive number");
  }

  // Los emails se mandan antes de responder (en Vercel, lo que queda pendiente después de responder se corta):
  // con estos topes, un servidor de correo lento no traba la compra más de unos segundos.
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
  });
}

export function getDefaultFromEmail(): string {
  return (
    process.env.FROM_EMAIL?.trim() ||
    process.env.SMTP_USER?.trim() ||
    ""
  );
}

export function sanitizeHeaderText(value: string, fallback: string, maxLength = 160): string {
  const sanitized = value.replace(/[\r\n]+/g, " ").trim();
  if (!sanitized) return fallback;
  return sanitized.slice(0, maxLength);
}
