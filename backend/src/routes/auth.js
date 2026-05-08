const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { signAuthToken, requireTenantUser } = require("../middleware/auth");
const { handleRouteError } = require("../utils/api");

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
