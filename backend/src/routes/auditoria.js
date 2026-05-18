const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { userHasNavKey } = require("../constants/navPermissions");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");
const { getDateRange } = require("../utils/dateRangeQuery");

function tw(req) {
  return { tenantId: req.tenantId };
}

async function canViewAuditoria(req) {
  if (req.authUser?.role === "admin") return true;
  const user = await prisma.user.findFirst({
    where: { id: req.authUser.id, tenantId: req.tenantId },
    select: { role: true, navPermissions: true },
  });
  return userHasNavKey(user, "auditoria");
}

// GET /api/auditoria
router.get("/", async (req, res) => {
  try {
    if (!(await canViewAuditoria(req))) {
      return res.status(403).json({ error: "Sem permissão para ver auditoria" });
    }

    const { tipo, entidade, dataInicio, dataFim, userId, vendaId, clienteId } =
      req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 50,
      maxTake: 200,
    });

    const where = { ...tw(req) };
    if (tipo) where.tipo = { contains: String(tipo), mode: "insensitive" };
    if (entidade) where.entidade = String(entidade);
    if (userId) {
      const uid = parseInt(userId, 10);
      if (!Number.isNaN(uid)) where.userId = uid;
    }
    if (vendaId) {
      const vid = parseInt(vendaId, 10);
      if (!Number.isNaN(vid)) where.vendaId = vid;
    }
    if (clienteId) {
      const cid = parseInt(clienteId, 10);
      if (!Number.isNaN(cid)) where.clienteId = cid;
    }
    if (dataInicio || dataFim) {
      const dr = getDateRange(dataInicio, dataFim);
      if (Object.keys(dr).length) where.createdAt = dr;
    }

    const [eventos, total] = await Promise.all([
      prisma.financeiroEvento.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.financeiroEvento.count({ where }),
    ]);

    setPaginationHeaders(res, { total, take, skip });
    res.json(eventos);
  } catch (e) {
    handleRouteError(res, e);
  }
});

// GET /api/auditoria/tipos — tipos distintos para filtro
router.get("/tipos", async (req, res) => {
  try {
    if (!(await canViewAuditoria(req))) {
      return res.status(403).json({ error: "Sem permissão para ver auditoria" });
    }
    const rows = await prisma.financeiroEvento.findMany({
      where: tw(req),
      distinct: ["tipo"],
      select: { tipo: true },
      orderBy: { tipo: "asc" },
    });
    res.json(rows.map((r) => r.tipo));
  } catch (e) {
    handleRouteError(res, e);
  }
});

module.exports = router;
