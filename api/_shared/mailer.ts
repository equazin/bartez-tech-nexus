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

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export function getDefaultFromEmail(): string {
  return (
    process.env.FROM_EMAIL?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "pedidos@bartez.com.ar"
  );
}

export function sanitizeHeaderText(value: string, fallback: string, maxLength = 160): string {
  const sanitized = value.replace(/[\r\n]+/g, " ").trim();
  if (!sanitized) return fallback;
  return sanitized.slice(0, maxLength);
}
