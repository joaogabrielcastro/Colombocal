const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcrypt");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { signAuthToken, requireTenantUser } = require("../middleware/auth");
const { handleRouteError } = require("../utils/api");
const { normalizeNavPermissions } = require("../constants/navPermissions");
const { getTenantFeatures } = require("../services/tenantFeaturesResolver");
const {
  loadRegistrationTenants,
  resolveRegistrationTenantSlug,
} = require("../utils/registrationTenants");
const { parseBody } = require("../utils/zodParse");
const { forgotPasswordSchema, resetPasswordSchema } = require("../schemas/auth");
const { sendEmail, getMemoryOutbox, resetMemoryOutbox, resolveTransport } = require("../infra/email/emailService");
const { passwordResetEnabled } = require("../startup/assertProductionConfig");

const RESET_TTL_MS = 60 * 60 * 1000;
const GENERIC_RESET_MSG =
  "Se os dados forem válidos, enviaremos instruções para o e-mail informado.";

function publicAppBaseUrl() {
  return String(process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || "http://127.0.0.1:3010")
    .trim()
    .replace(/\/$/, "");
}

function hashResetToken(raw) {
  return crypto.createHash("sha256").update(String(raw), "utf8").digest("hex");
}

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_FORGOT_PASSWORD_PER_WINDOW ?? 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente em alguns minutos." },
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_RESET_PASSWORD_PER_WINDOW ?? 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente em alguns minutos." },
});

function timingSafeEqualString(a, b) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function isOpenRegistration() {
  return process.env.OPEN_REGISTRATION === "true";
}

function getRegistrationKey() {
  const k = process.env.REGISTRATION_KEY;
  if (!k || String(k).trim().length < 4) return null;
  return String(k).trim();
}

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_REGISTER_PER_HOUR ?? 20),
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_LOGIN_PER_WINDOW ?? 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Tente novamente em alguns minutos." },
});

// GET /api/auth/tenants — não é público (evita enumeração de empresas).
// O login usa POST /auth/login; se o e-mail existir em mais de um tenant, a API
// responde 409 TENANT_REQUIRED só com as organizações daquele usuário.
router.get("/tenants", (_req, res) => {
  res.status(404).json({ error: "Não encontrado" });
});

// GET /api/auth/register-status — saber se o cadastro público está ligado
router.get("/register-status", async (req, res) => {
  try {
    if (!isOpenRegistration()) {
      return res.json({
        registrationOpen: false,
        registrationRequiresKey: false,
        tenants: [],
      });
    }
    const tenants = await loadRegistrationTenants(prisma);
    res.json({
      registrationOpen: tenants.length > 0,
      registrationRequiresKey: getRegistrationKey() != null,
      tenants: tenants.map((t) => ({ slug: t.slug, name: t.name })),
    });
  } catch (e) {
    handleRouteError(res, e);
  }
});

// POST /api/auth/register — novo membro (papel member); exige OPEN_REGISTRATION=true
router.post("/register", registerLimiter, async (req, res) => {
  try {
    if (!isOpenRegistration()) {
      return res.status(403).json({ error: "Cadastro público desativado neste servidor" });
    }

    const tenants = await loadRegistrationTenants(prisma);
    let tenantSlug;
    try {
      tenantSlug = resolveRegistrationTenantSlug(req.body, tenants);
    } catch (e) {
      if (e && e.statusCode) {
        return res.status(e.statusCode).json({ error: e.message });
      }
      throw e;
    }

    const tenant = tenants.find((t) => t.slug === tenantSlug);
    if (!tenant) {
      return res.status(503).json({
        error:
          "Organização ainda não existe. Peça a um administrador para criar a empresa ou use o primeiro acesso ao servidor.",
      });
    }

    const regKey = getRegistrationKey();
    if (regKey) {
      const provided = String(req.body?.registrationKey ?? "");
      if (!timingSafeEqualString(provided, regKey)) {
        return res.status(401).json({ error: "Chave de convite inválida" });
      }
    }

    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");
    const name = req.body?.name != null ? String(req.body.name).trim() || null : null;

    if (!email || !password) {
      return res.status(400).json({ error: "Informe e-mail e senha" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
    }

    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
    });
    if (existing) {
      return res.status(409).json({ error: "Este e-mail já está cadastrado. Use o login." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        passwordHash,
        name,
        role: "member",
      },
      include: { tenant: true },
    });

    const token = signAuthToken(user);
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      },
    });
  } catch (e) {
    handleRouteError(res, e);
  }
});

// POST /api/auth/login { email, password, tenantSlug? }
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) {
      return res.status(400).json({ error: "Informe e-mail e senha" });
    }

    const tenantSlug =
      req.body?.tenantSlug != null ? String(req.body.tenantSlug).trim().toLowerCase() : "";

    let candidates = [];
    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (!tenant) {
        return res.status(401).json({ error: "Credenciais inválidas" });
      }
      const user = await prisma.user.findUnique({
        where: { tenantId_email: { tenantId: tenant.id, email } },
        include: { tenant: true },
      });
      if (user) candidates = [user];
    } else {
      candidates = await prisma.user.findMany({
        where: { email },
        include: { tenant: true },
        take: 10,
      });
    }

    const matched = [];
    for (const u of candidates) {
      const ok = await bcrypt.compare(password, u.passwordHash);
      if (ok) matched.push(u);
    }

    if (matched.length === 0) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    matched.sort((a, b) => a.id - b.id);
    if (matched.length > 1) {
      return res.status(409).json({
        error:
          "Este e-mail existe em mais de uma organização. Selecione a organização para entrar.",
        code: "TENANT_REQUIRED",
        tenants: matched.map((u) => ({
          slug: u.tenant.slug,
          name: u.tenant.name,
        })),
      });
    }
    const user = matched[0];
    const token = signAuthToken(user);
    const features = await getTenantFeatures(
      prisma,
      user.tenantId,
      user.tenant.slug,
    );
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      },
      features,
    });
  } catch (e) {
    handleRouteError(res, e);
  }
});

// GET /api/auth/me
router.get("/me", requireTenantUser, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.authUser.id },
      include: { tenant: true },
    });
    if (!user || user.tenantId !== req.tenantId) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    const features = await getTenantFeatures(
      prisma,
      user.tenantId,
      user.tenant.slug,
    );
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        navPermissions: normalizeNavPermissions(user.navPermissions),
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      },
      features,
    });
  } catch (e) {
    handleRouteError(res, e);
  }
});

// POST /api/auth/forgot-password — anti-enumeração (mesma resposta sempre)
router.post("/forgot-password", forgotLimiter, async (req, res) => {
  try {
    if (!passwordResetEnabled()) {
      return res.status(503).json({
        error: "Recuperação de senha desabilitada neste servidor",
      });
    }
    console.info("[auth] Password reset email requested");
    const body = parseBody(forgotPasswordSchema, req.body);
    const email = body.email.trim().toLowerCase();
    const tenantSlug =
      body.tenantSlug != null && String(body.tenantSlug).trim()
        ? String(body.tenantSlug).trim().toLowerCase()
        : "";

    let users = [];
    if (tenantSlug) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) {
        const u = await prisma.user.findUnique({
          where: { tenantId_email: { tenantId: tenant.id, email } },
          include: { tenant: true },
        });
        if (u) users = [u];
      }
    } else {
      users = await prisma.user.findMany({
        where: { email },
        include: { tenant: true },
        take: 10,
      });
    }

    const expiresAt = new Date(Date.now() + RESET_TTL_MS);
    for (const user of users) {
      const raw = crypto.randomBytes(32).toString("base64url");
      const tokenHash = hashResetToken(raw);
      await prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });
      const link = `${publicAppBaseUrl()}/redefinir-senha?token=${encodeURIComponent(raw)}`;
      try {
        await sendEmail({
          to: user.email,
          subject: "Redefinição de senha — Colombocal",
          text: [
            "Recebemos um pedido para redefinir sua senha.",
            `Organização: ${user.tenant?.name || "sua empresa"}.`,
            "",
            "Abra o link abaixo (válido por 60 minutos):",
            link,
            "",
            "Se você não solicitou, ignore este e-mail.",
          ].join("\n"),
        });
        console.info("[auth] Password reset email sent");
      } catch (mailErr) {
        console.error("[auth] Password reset email failed");
        throw mailErr;
      }
    }

    // Atraso constante leve para reduzir timing side-channel óbvio.
    await new Promise((r) => setTimeout(r, 40 + Math.floor(Math.random() * 40)));
    return res.json({ ok: true, message: GENERIC_RESET_MSG });
  } catch (e) {
    if (e && e.statusCode === 400) {
      return res.status(400).json({ error: e.message || "Dados inválidos" });
    }
    handleRouteError(res, e);
  }
});

// POST /api/auth/reset-password
router.post("/reset-password", resetLimiter, async (req, res) => {
  try {
    if (!passwordResetEnabled()) {
      return res.status(503).json({
        error: "Recuperação de senha desabilitada neste servidor",
      });
    }
    const body = parseBody(resetPasswordSchema, req.body);
    const tokenHash = hashResetToken(body.token);
    const row = await prisma.passwordResetToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: "Link inválido ou expirado" });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: row.userId },
        data: {
          passwordHash,
          tokenVersion: { increment: 1 },
        },
      });
      await tx.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      // Invalidar outros tokens pendentes do mesmo usuário
      await tx.passwordResetToken.updateMany({
        where: {
          userId: row.userId,
          usedAt: null,
          id: { not: row.id },
        },
        data: { usedAt: new Date() },
      });
    });

    return res.json({ ok: true, message: "Senha alterada. Faça login com a nova senha." });
  } catch (e) {
    if (e && e.statusCode === 400) {
      return res.status(400).json({ error: e.message || "Dados inválidos" });
    }
    handleRouteError(res, e);
  }
});

/**
 * Outbox de e-mail só para testes E2E (EMAIL_TRANSPORT=memory).
 * Nunca disponível em produção.
 */
function allowEmailOutboxInspect() {
  if (process.env.NODE_ENV === "production") return false;
  if (resolveTransport() !== "memory") return false;
  return (
    process.env.NODE_ENV === "test" ||
    process.env.ALLOW_EMAIL_OUTBOX_INSPECT === "true"
  );
}

router.get("/__test__/email-outbox", (req, res) => {
  if (!allowEmailOutboxInspect()) {
    return res.status(404).json({ error: "Não encontrado" });
  }
  const items = getMemoryOutbox().map((m) => ({
    to: m.to,
    subject: m.subject,
    text: m.text,
    at: m.at,
  }));
  return res.json({ items });
});

router.post("/__test__/email-outbox/clear", (req, res) => {
  if (!allowEmailOutboxInspect()) {
    return res.status(404).json({ error: "Não encontrado" });
  }
  resetMemoryOutbox();
  return res.json({ ok: true });
});

module.exports = router;
