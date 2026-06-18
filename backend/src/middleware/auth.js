const jwt = require("jsonwebtoken");
const { prisma } = require("../lib/prisma");

function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (s && String(s).trim()) return String(s).trim();
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET é obrigatório em produção");
  }
  return "dev-only-jwt-secret-change-me";
}

function signAuthToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      tid: user.tenantId,
      email: user.email,
      role: user.role || "member",
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
}

/**
 * Desativa verificação JWT (apenas desenvolvimento). Usa DEFAULT_TENANT_ID.
 * Em produção é ignorado — auth sempre obrigatória.
 */
function isAuthDisabled() {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.AUTH_DISABLED === "true";
}

async function requireTenantUser(req, res, next) {
  try {
    if (isAuthDisabled()) {
      const tid = Number(process.env.DEFAULT_TENANT_ID ?? 1);
      req.tenantId = Number.isFinite(tid) && tid > 0 ? tid : 1;
      req.authUser = {
        id: 0,
        tenantId: req.tenantId,
        email: "dev@local",
        name: "Desenvolvimento",
        role: "admin",
        navPermissions: null,
      };
      return next();
    }

    const raw = req.headers.authorization;
    if (!raw || typeof raw !== "string" || !raw.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    const token = raw.slice("Bearer ".length).trim();
    if (!token) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const payload = jwt.verify(token, getJwtSecret());
    const tid = Number(payload.tid);
    const uid = Number(payload.sub);
    if (!Number.isFinite(tid) || tid < 1 || !Number.isFinite(uid) || uid < 1) {
      return res.status(401).json({ error: "Token inválido" });
    }

    const user = await prisma.user.findFirst({
      where: { id: uid, tenantId: tid },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
        navPermissions: true,
      },
    });
    if (!user) {
      return res.status(401).json({ error: "Usuário não encontrado" });
    }

    req.tenantId = tid;
    req.authUser = user;
    return next();
  } catch {
    return res.status(401).json({ error: "Sessão inválida ou expirada" });
  }
}

function requireAdmin(req, res, next) {
  if (!req.authUser || req.authUser.role !== "admin") {
    return res.status(403).json({ error: "Apenas administradores podem fazer isso" });
  }
  next();
}

module.exports = {
  getJwtSecret,
  signAuthToken,
  isAuthDisabled,
  requireTenantUser,
  requireAdmin,
};
