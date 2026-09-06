const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");
const { registrarAuditoria } = require("../services/financeiroEventos");
const {
  parseRequiredString,
  parseOptionalString,
  parseNumberField,
} = require("../utils/validation");
const { z } = require("zod");
const { produtoFiscalPatch } = require("../schemas/produtoFiscal");

const produtoFiscalSchema = z.object(produtoFiscalPatch).partial();

function tw(req) {
  return { tenantId: req.tenantId };
}

function pickProdutoFiscal(body) {
  const parsed = produtoFiscalSchema.safeParse(body || {});
  if (!parsed.success) {
    const msg = parsed.error.issues?.[0]?.message || "Dados fiscais do produto inválidos";
    const err = new Error(msg);
    err.httpStatus = 400;
    throw err;
  }
  const out = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
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
    const nome = parseRequiredString(req.body?.nome, "nome", { maxLength: 160 });
    const codigo = parseOptionalString(req.body?.codigo, "codigo", { maxLength: 80 });
    const precoPadrao = parseNumberField(req.body?.precoPadrao, "precoPadrao", {
      min: 0,
    });
    const unidade =
      parseOptionalString(req.body?.unidade, "unidade", { maxLength: 20 }) || "ton";
    const codigoFinal =
      codigo ||
      `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const pesoKg = parseNumberField(
      req.body?.pesoKg == null || req.body?.pesoKg === ""
        ? req.body?.pesoKg
        : String(req.body.pesoKg).replace(",", "."),
      "pesoKg",
      {
        required: false,
        min: 0,
      },
    );
    const produto = await prisma.$transaction(async (tx) => {
      const p = await tx.produto.create({
        data: {
          ...tw(req),
          nome,
          codigo: codigoFinal,
          precoPadrao,
          unidade,
          pesoKg: pesoKg != null && pesoKg > 0 ? pesoKg : null,
          ...pickProdutoFiscal(req.body),
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

    const data = {};
    if (req.body?.nome !== undefined) {
      data.nome = parseRequiredString(req.body.nome, "nome", { maxLength: 160 });
    }
    if (req.body?.codigo !== undefined) {
      data.codigo = parseOptionalString(req.body.codigo, "codigo", { maxLength: 80 });
    }
    if (req.body?.precoPadrao !== undefined) {
      data.precoPadrao = parseNumberField(req.body.precoPadrao, "precoPadrao", {
        min: 0,
      });
    }
    if (req.body?.unidade !== undefined) {
      data.unidade =
        parseOptionalString(req.body.unidade, "unidade", { maxLength: 20 }) || "ton";
    }
    if (req.body?.ativo !== undefined) {
      if (typeof req.body.ativo !== "boolean") {
        return res.status(400).json({ error: "ativo inválido" });
      }
      data.ativo = req.body.ativo;
    }
    if (req.body?.pesoKg !== undefined) {
      if (req.body.pesoKg === null || String(req.body.pesoKg).trim() === "") {
        data.pesoKg = null;
      } else {
        const peso = parseNumberField(
          String(req.body.pesoKg).replace(",", "."),
          "pesoKg",
          { min: 0 },
        );
        data.pesoKg = peso > 0 ? peso : null;
      }
    }
    Object.assign(data, pickProdutoFiscal(req.body));
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
