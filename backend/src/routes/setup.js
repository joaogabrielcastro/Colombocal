const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { signAuthToken } = require("../middleware/auth");
const { handleRouteError } = require("../utils/api");

function getSetupSecret() {
  const s = process.env.SETUP_SECRET;
  if (!s || String(s).trim().length < 8) return null;
  return String(s).trim();
}

function timingSafeEqualString(a, b) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function classifyDatabaseCheckError(err) {
  const code = err && err.code;
  if (code === "P1001" || code === "P1000" || code === "P1017") return "connection";
  if (code === "P2021") return "missing_tables";
  return "other";
}

// GET /api/setup/status — público; não expõe o segredo
router.get("/status", async (req, res) => {
  try {
    const setupEnabled = getSetupSecret() != null;
    let databaseReady = false;
    let needsBootstrap = false;
    /** @type {null | "connection" | "missing_tables" | "other"} */
    let databaseIssue = null;
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseReady = true;
      const n = await prisma.user.count();
      needsBootstrap = n === 0;
    } catch (e) {
      databaseReady = false;
      needsBootstrap = false;
      databaseIssue = classifyDatabaseCheckError(e);
    }
    res.json({
      setupEnabled,
      needsBootstrap,
      databaseReady,
      databaseIssue,
    });
  } catch (e) {
    handleRouteError(res, e);
  }
});

// POST /api/setup/first-admin — primeiro admin (só com usuários = 0 e SETUP_SECRET correto)
router.post("/first-admin", async (req, res) => {
  try {
    const setupSecret = getSetupSecret();
    if (!setupSecret) {
      return res
        .status(503)
        .json({ error: "SETUP_SECRET não configurado no servidor (mín. 8 caracteres)." });
    }

    const provided = String(req.body?.setupSecret ?? "");
    if (!timingSafeEqualString(provided, setupSecret)) {
      return res.status(401).json({ error: "Chave de setup inválida" });
    }

    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return res.status(410).json({
        error: "Sistema já tem usuários. Use o login ou um admin em Usuários.",
      });
    }

    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");
    const name = req.body?.name != null ? String(req.body.name).trim() || null : null;
    const tenantName =
      String(req.body?.tenantName || "Minha organização").trim() || "Minha organização";

    if (!email || !password) {
      return res.status(400).json({ error: "Informe e-mail e senha" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
    }

    let tenant = await prisma.tenant.findUnique({ where: { slug: "default" } });
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { name: tenantName, slug: "default" },
      });
    } else {
      tenant = await prisma.tenant.update({
        where: { id: tenant.id },
        data: { name: tenantName },
      });
    }

    const dup = await prisma.user.findUnique({ where: { email } });
    if (dup) {
      return res.status(409).json({ error: "Este e-mail já está cadastrado" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        passwordHash,
        name,
        role: "admin",
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
    if (e && e.code === "P2002") {
      return res.status(409).json({ error: "Organização ou e-mail já existem" });
    }
    handleRouteError(res, e);
  }
});

module.exports = router;
