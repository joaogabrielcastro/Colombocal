const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");
const { registrarAuditoria } = require("../services/financeiroEventos");
const { parseBody } = require("../utils/zodParse");
const {
  produtoCreateSchema,
  produtoUpdateSchema,
} = require("../schemas/produto");

function tw(req) {
  return { tenantId: req.tenantId };
}

// GET /api/produtos
router.get("/", async (req, res) => {
  try {
    const { busca, ativo } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 200,
      maxTake: 500,
    });
    const where = { ...tw(req) };
    if (ativo !== undefined) where.ativo = ativo === "true";
    if (busca) {
      where.OR = [
        { nome: { contains: busca, mode: "insensitive" } },
        { codigo: { contains: busca, mode: "insensitive" } },
      ];
    }
    const [produtos, total] = await Promise.all([
      prisma.produto.findMany({
        where,
        orderBy: { nome: "asc" },
        take,
        skip,
      }),
      prisma.produto.count({ where }),
    ]);
    setPaginationHeaders(res, { total, take, skip });
    res.json(produtos);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/produtos/:id
router.get("/:id", async (req, res) => {
  try {
    const produto = await prisma.produto.findFirst({
      where: { id: parseInt(req.params.id), ...tw(req) },
      include: {
        movimentacoes: {
          where: tw(req),
          orderBy: { data: "desc" },
          take: 20,
        },
      },
    });
    if (!produto)
      return res.status(404).json({ error: "Produto não encontrado" });
    res.json(produto);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// POST /api/produtos
router.post("/", async (req, res) => {
  try {
    const b = parseBody(produtoCreateSchema, req.body);
    const codigoFinal =
      b.codigo ||
      `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const produto = await prisma.$transaction(async (tx) => {
      const p = await tx.produto.create({
        data: {
          ...tw(req),
          nome: b.nome,
          codigo: codigoFinal,
          precoPadrao: b.precoPadrao,
          unidade: b.unidade || "ton",
          pesoKg: b.pesoKg != null && b.pesoKg > 0 ? b.pesoKg : null,
          ncm: b.ncm ?? undefined,
          cfopPadraoDentro: b.cfopPadraoDentro ?? undefined,
          cfopPadraoFora: b.cfopPadraoFora ?? undefined,
          origem: b.origem ?? undefined,
          cst: b.cst ?? undefined,
          csosn: b.csosn ?? undefined,
        },
      });
      await registrarAuditoria(tx, req, {
        tenantId: req.tenantId,
        tipo: "PRODUTO_CRIADO",
        entidade: "Produto",
        entidadeId: p.id,
        payload: { nome: p.nome, codigo: p.codigo },
      });
      return p;
    });
    res.status(201).json(produto);
  } catch (error) {
    if (error.code === "P2002")
      return res.status(400).json({ error: "Código já cadastrado" });
    handleRouteError(res, error);
  }
});

// PUT /api/produtos/:id
router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const exists = await prisma.produto.count({ where: { id, ...tw(req) } });
    if (!exists) return res.status(404).json({ error: "Produto não encontrado" });

    const b = parseBody(produtoUpdateSchema, req.body);
    const data = {};
    if (b.nome !== undefined) data.nome = b.nome;
    if (b.codigo !== undefined) data.codigo = b.codigo;
    if (b.precoPadrao !== undefined) data.precoPadrao = b.precoPadrao;
    if (b.unidade !== undefined) data.unidade = b.unidade;
    if (b.ativo !== undefined) data.ativo = b.ativo;
    if (b.pesoKg !== undefined) {
      data.pesoKg = b.pesoKg != null && b.pesoKg > 0 ? b.pesoKg : null;
    }
    if (b.ncm !== undefined) data.ncm = b.ncm;
    if (b.cfopPadraoDentro !== undefined) data.cfopPadraoDentro = b.cfopPadraoDentro;
    if (b.cfopPadraoFora !== undefined) data.cfopPadraoFora = b.cfopPadraoFora;
    if (b.origem !== undefined) data.origem = b.origem;
    if (b.cst !== undefined) data.cst = b.cst;
    if (b.csosn !== undefined) data.csosn = b.csosn;

    const produto = await prisma.$transaction(async (tx) => {
      const updated = await tx.produto.updateMany({
        where: { id, ...tw(req) },
        data,
      });
      if (!updated.count) {
        const err = new Error("Produto não encontrado");
        err.statusCode = 404;
        throw err;
      }
      const p = await tx.produto.findFirst({ where: { id, ...tw(req) } });
      if (!p) {
        const err = new Error("Produto não encontrado");
        err.statusCode = 404;
        throw err;
      }
      await registrarAuditoria(tx, req, {
        tenantId: req.tenantId,
        tipo: "PRODUTO_ATUALIZADO",
        entidade: "Produto",
        entidadeId: p.id,
        payload: { nome: p.nome, codigo: p.codigo, ativo: p.ativo },
      });
      return p;
    });
    res.json(produto);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// DELETE /api/produtos/:id - inativar
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const exists = await prisma.produto.count({ where: { id, ...tw(req) } });
    if (!exists) return res.status(404).json({ error: "Produto não encontrado" });

    await prisma.$transaction(async (tx) => {
      const updated = await tx.produto.updateMany({
        where: { id, ...tw(req) },
        data: { ativo: false },
      });
      if (!updated.count) {
        const err = new Error("Produto não encontrado");
        err.statusCode = 404;
        throw err;
      }
      await registrarAuditoria(tx, req, {
        tenantId: req.tenantId,
        tipo: "PRODUTO_INATIVADO",
        entidade: "Produto",
        entidadeId: id,
      });
    });
    res.json({ success: true });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
