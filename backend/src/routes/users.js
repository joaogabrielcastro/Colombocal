const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { handleRouteError } = require("../utils/api");
const {
  NAV_PERMISSION_KEYS,
  normalizeNavPermissions,
} = require("../constants/navPermissions");
const { registrarAuditoria } = require("../services/financeiroEventos");

const ROLES = new Set(["admin", "member"]);

// GET /api/users — lista usuários do tenant (admin)
router.get("/", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { id: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        navPermissions: true,
        createdAt: true,
      },
    });
    res.json(
      users.map((u) => ({
        ...u,
        navPermissions: normalizeNavPermissions(u.navPermissions),
      })),
    );
  } catch (e) {
    handleRouteError(res, e);
  }
});

// POST /api/users — cria usuário no mesmo tenant (admin)
router.post("/", async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");
    const name = req.body?.name != null ? String(req.body.name).trim() || null : null;
    const role = String(req.body?.role || "member").toLowerCase();

    if (!email || !password) {
      return res.status(400).json({ error: "Informe e-mail e senha" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
    }
    if (!ROLES.has(role)) {
      return res.status(400).json({ error: "Papel inválido (use admin ou member)" });
    }

    const existing = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: req.tenantId, email } },
    });
    if (existing) {
      return res.status(409).json({ error: "Este e-mail já está em uso" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        tenantId: req.tenantId,
        email,
        passwordHash,
        name,
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    res.status(201).json(user);
  } catch (e) {
    handleRouteError(res, e);
  }
});

// DELETE /api/users/:id — remove usuário do tenant (admin; não pode excluir a si)
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ error: "ID inválido" });
    }
    if (id === req.authUser.id) {
      return res.status(400).json({ error: "Não é possível excluir o próprio usuário" });
    }

    const user = await prisma.user.findFirst({
      where: { id, tenantId: req.tenantId },
    });
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    handleRouteError(res, e);
  }
});

// PATCH /api/users/:id/password — redefine senha (admin; pode alterar a própria)
router.patch("/:id/password", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ error: "ID inválido" });
    }
    const password = String(req.body?.password || "");
    if (!password) {
      return res.status(400).json({ error: "Informe a nova senha" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
    }

    const user = await prisma.user.findFirst({
      where: { id, tenantId: req.tenantId },
    });
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { passwordHash },
      });
      await registrarAuditoria(tx, req, {
        tenantId: req.tenantId,
        tipo: "USER_SENHA_ALTERADA",
        entidade: "User",
        entidadeId: id,
        payload: { alvoEmail: user.email },
      });
    });

    res.json({ ok: true });
  } catch (e) {
    handleRouteError(res, e);
  }
});

// PATCH /api/users/:id/nav-permissions — abas visíveis (admin)
router.patch("/:id/nav-permissions", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const user = await prisma.user.findFirst({
      where: { id, tenantId: req.tenantId },
    });
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }
    if (user.role === "admin") {
      return res.status(400).json({
        error: "Administradores têm acesso a todas as abas",
      });
    }

    let navPermissions = null;
    if (req.body?.navPermissions != null) {
      if (!Array.isArray(req.body.navPermissions)) {
        return res.status(400).json({ error: "navPermissions deve ser uma lista" });
      }
      const invalid = req.body.navPermissions.filter(
        (k) => !NAV_PERMISSION_KEYS.includes(String(k)),
      );
      if (invalid.length) {
        return res.status(400).json({
          error: `Chaves inválidas: ${invalid.join(", ")}`,
        });
      }
      navPermissions = normalizeNavPermissions(req.body.navPermissions);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: { navPermissions },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          navPermissions: true,
          createdAt: true,
        },
      });
      await registrarAuditoria(tx, req, {
        tenantId: req.tenantId,
        tipo: "USER_NAV_PERMISSOES",
        entidade: "User",
        entidadeId: id,
        payload: {
          alvoEmail: user.email,
          navPermissions,
        },
      });
      return u;
    });

    res.json({
      ...updated,
      navPermissions: normalizeNavPermissions(updated.navPermissions),
    });
  } catch (e) {
    handleRouteError(res, e);
  }
});

module.exports = router;
