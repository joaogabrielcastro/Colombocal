const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcrypt");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { signAuthToken, requireTenantUser } = require("../middleware/auth");
const { handleRouteError } = require("../utils/api");
const { normalizeNavPermissions } = require("../constants/navPermissions");

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

function getRegistrationTenantSlug() {
  const s = process.env.REGISTRATION_TENANT_SLUG;
  return (s && String(s).trim()) || "default";
}

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_REGISTER_PER_HOUR ?? 20),
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/auth/register-status — saber se o cadastro público está ligado
router.get("/register-status", async (req, res) => {
  try {
    if (!isOpenRegistration()) {
      return res.json({
        registrationOpen: false,
        registrationRequiresKey: false,
        tenantSlug: getRegistrationTenantSlug(),
      });
    }
    const slug = getRegistrationTenantSlug();
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    res.json({
      registrationOpen: !!tenant,
      registrationRequiresKey: getRegistrationKey() != null,
      tenantSlug: slug,
    });
  } catch (e) {
    handleRouteError(res, e);
  }
});

// POST /api/auth/register — novo membro (papel member) no tenant configurado; exige OPEN_REGISTRATION=true
router.post("/register", registerLimiter, async (req, res) => {
  try {
    if (!isOpenRegistration()) {
      return res.status(403).json({ error: "Cadastro público desativado neste servidor" });
    }

    const slug = getRegistrationTenantSlug();
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
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

    const existing = await prisma.user.findUnique({ where: { email } });
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

// POST /api/auth/login { email, password }
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) {
      return res.status(400).json({ error: "Informe e-mail e senha" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });
    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const token = signAuthToken(user);
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
    });
  } catch (e) {
    handleRouteError(res, e);
  }
});

module.exports = router;
