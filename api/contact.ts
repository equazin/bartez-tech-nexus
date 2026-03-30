import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createMailerTransport, getDefaultFromEmail, sanitizeHeaderText } from "./_shared/mailer";
import { contactRequestSchema } from "./_shared/schemas";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const parsed = contactRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "Datos de contacto invalidos",
        details: parsed.error.flatten(),
      });
    }

    const { name, email, message, subject } = parsed.data;
    const transporter = createMailerTransport();
    const fromEmail = getDefaultFromEmail();

    const safeSubject =
      subject ??
      sanitizeHeaderText(`Nueva solicitud de contacto: ${name}`, "Nueva solicitud de contacto");

    await transporter.sendMail({
      from: `"Bartez Soluciones IT" <${fromEmail}>`,
      to: "contacto@bartez.com.ar",
      replyTo: email,
      subject: sanitizeHeaderText(safeSubject, "Nueva solicitud de contacto"),
      text: `Nombre: ${name}\nEmail: ${email}\n\nMensaje:\n${message}`,
    });

    return res.status(200).json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    console.error("[contact] Error:", message);
    return res.status(500).json({ ok: false, error: "No se pudo enviar el mensaje" });
  }
}
