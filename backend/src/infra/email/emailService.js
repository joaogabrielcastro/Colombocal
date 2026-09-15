/**
 * Abstração mínima de e-mail.
 * - test / EMAIL_TRANSPORT=memory: acumula em memória (sem rede)
 * - EMAIL_TRANSPORT=console (default em não-produção): loga assunto/destino sem corpo sensível demais
 * - EMAIL_TRANSPORT=smtp: nodemailer com SMTP_* 
 */
const nodemailer = require("nodemailer");

const memoryOutbox = [];

function resetMemoryOutbox() {
  memoryOutbox.length = 0;
}

function getMemoryOutbox() {
  return [...memoryOutbox];
}

function resolveTransport() {
  const explicit = String(process.env.EMAIL_TRANSPORT || "").trim().toLowerCase();
  if (explicit) return explicit;
  if (process.env.NODE_ENV === "test") return "memory";
  if (process.env.NODE_ENV === "production") return "smtp";
  return "console";
}

function assertSmtpConfig() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const from = String(process.env.EMAIL_FROM || "").trim();
  if (!host || !from) {
    throw new Error(
      "E-mail SMTP exige SMTP_HOST e EMAIL_FROM quando EMAIL_TRANSPORT=smtp (ou produção).",
    );
  }
}

async function sendEmail({ to, subject, text, html }) {
  const transport = resolveTransport();
  const payload = {
    to: String(to || "").trim().toLowerCase(),
    subject: String(subject || ""),
    text: text != null ? String(text) : undefined,
    html: html != null ? String(html) : undefined,
    at: new Date().toISOString(),
  };
  if (!payload.to) {
    throw new Error("Destinatário de e-mail obrigatório");
  }

  if (transport === "memory") {
    memoryOutbox.push(payload);
    return { ok: true, transport: "memory" };
  }

  if (transport === "console") {
    // Não logar o corpo completo (pode conter link com token).
    console.info(
      `[email:console] to=${payload.to} subject=${payload.subject} (corpo omitido)`,
    );
    memoryOutbox.push(payload);
    return { ok: true, transport: "console" };
  }

  if (transport === "smtp") {
    assertSmtpConfig();
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth:
        process.env.SMTP_USER || process.env.SMTP_PASS
          ? {
              user: process.env.SMTP_USER || undefined,
              pass: process.env.SMTP_PASS || undefined,
            }
          : undefined,
    });
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return { ok: true, transport: "smtp" };
  }

  throw new Error(`EMAIL_TRANSPORT desconhecido: ${transport}`);
}

module.exports = {
  sendEmail,
  resolveTransport,
  resetMemoryOutbox,
  getMemoryOutbox,
  assertSmtpConfig,
};
