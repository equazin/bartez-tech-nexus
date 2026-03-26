import type { VercelRequest, VercelResponse } from "@vercel/node";
import nodemailer from "nodemailer";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { name, email, message, subject } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ ok: false, error: "Faltan campos" });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465, // 465 SSL directo
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const safeSubject =
      typeof subject === "string" && subject.trim().length > 0
        ? subject.trim()
        : `Nueva solicitud de contacto: ${name}`;

    await transporter.sendMail({
      from: `"Bartez Soluciones IT" <${process.env.SMTP_USER}>`,
      to: "contacto@bartez.com.ar",
      replyTo: email,
      subject: safeSubject,
      text: `Nombre: ${name}\nEmail: ${email}\n\nMensaje:\n${message}`,
    });

    return res.status(200).json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error";
    return res.status(500).json({ ok: false, error: message });
  }
}