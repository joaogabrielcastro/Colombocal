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
const { resolveUsuarioExibicao } = require("../services/financeiroEventos");
const { labelTipoAuditoria } = require("../constants/auditoriaTipos");

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

    const userIds = [
      ...new Set(eventos.map((e) => e.userId).filter((id) => id != null)),
    ];
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { tenantId: req.tenantId, id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    const comUsuario = eventos.map((ev) => {
      const usuario = resolveUsuarioExibicao(ev, userById);
      return {
        ...ev,
        tipoLabel: labelTipoAuditoria(ev.tipo),
        usuario: usuario || "—",
      };
    });

    setPaginationHeaders(res, { total, take, skip });
    res.json(comUsuario);
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
    const tipos = rows
      .map((r) => ({
        key: r.tipo,
        label: labelTipoAuditoria(r.tipo),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
    res.json(tipos);
  } catch (e) {
    handleRouteError(res, e);
  }
});

/**
 * GET /api/auditoria/integridade-tenant
 * Conta vendas deste tenant cujo cliente pertence a outro tenant (FK cruzada).
 * Só admin.
 */
router.get("/integridade-tenant", async (req, res) => {
  try {
    if (req.authUser?.role !== "admin") {
      return res.status(403).json({ error: "Apenas administradores" });
    }
    const tid = req.tenantId;
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS c
      FROM "Venda" v
      INNER JOIN "Cliente" c ON c.id = v."clienteId"
      WHERE v."tenantId" = ${tid} AND c."tenantId" <> ${tid}
    `;
    const cruzados = Array.isArray(rows) && rows[0] != null ? Number(rows[0].c) : 0;

    res.json({
      tenantId: tid,
      vendasComClienteDeOutroTenant: cruzados,
      ok: cruzados === 0,
    });
  } catch (e) {
    handleRouteError(res, e);
  }
});

/**
 * GET /api/auditoria/diagnose-tenants
 * Resumo de todos os tenants no banco saas_colombocal (somente leitura).
 * Só admin — útil no Coolify sem acesso SSH local ao Postgres.
 */
router.get("/diagnose-tenants", async (req, res) => {
  try {
    if (req.authUser?.role !== "admin") {
      return res.status(403).json({ error: "Apenas administradores" });
    }

    const tenants = await prisma.tenant.findMany({
      orderBy: { id: "asc" },
      select: { id: true, name: true, slug: true },
    });

    const report = [];
    for (const t of tenants) {
      const [clientes, vendas, users, cruzados, amostraClientes, amostraVendas] =
        await Promise.all([
          prisma.cliente.count({ where: { tenantId: t.id } }),
          prisma.venda.count({ where: { tenantId: t.id } }),
          prisma.user.count({ where: { tenantId: t.id } }),
          prisma.$queryRaw`
            SELECT COUNT(*)::int AS c
            FROM "Venda" v
            INNER JOIN "Cliente" c ON c.id = v."clienteId"
            WHERE v."tenantId" = ${t.id} AND c."tenantId" <> ${t.id}
          `,
          prisma.cliente.findMany({
            where: { tenantId: t.id },
            orderBy: { id: "asc" },
            take: 5,
            select: { id: true, razaoSocial: true, nomeFantasia: true },
          }),
          prisma.venda.findMany({
            where: { tenantId: t.id },
            orderBy: { dataVenda: "desc" },
            take: 5,
            select: {
              id: true,
              numeroVenda: true,
              cliente: {
                select: { id: true, razaoSocial: true, tenantId: true },
              },
            },
          }),
        ]);

      const nCruz =
        Array.isArray(cruzados) && cruzados[0] != null ? Number(cruzados[0].c) : 0;

      report.push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        users,
        clientes,
        vendas,
        vendasComClienteDeOutroTenant: nCruz,
        amostraClientes,
        amostraVendas: amostraVendas.map((v) => ({
          id: v.id,
          numeroVenda: v.numeroVenda,
          clienteId: v.cliente?.id,
          clienteNome: v.cliente?.razaoSocial,
          clienteTenantId: v.cliente?.tenantId,
          mismatch: v.cliente != null && v.cliente.tenantId !== t.id,
        })),
      });
    }

    res.json({
      database: "saas_colombocal",
      readOnly: true,
      sessionTenantId: req.tenantId,
      tenants: report,
    });
  } catch (e) {
    handleRouteError(res, e);
  }
});

module.exports = router;
