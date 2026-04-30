const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const {
  parseIntField,
  parseNumberField,
  parseDateField,
} = require("../utils/validation");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");
const { registrarEventoFinanceiro } = require("../services/financeiroEventos");


// GET /api/fretes — listagem com filtros (painel / relatório)
router.get("/", async (req, res) => {
  try {
    const { clienteId, vendaId, reciboEmitido, dataInicio, dataFim } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 50,
      maxTake: 500,
    });

    const where = {};
    if (clienteId) where.clienteId = parseInt(clienteId, 10);
    if (vendaId) where.vendaId = parseInt(vendaId, 10);
    if (reciboEmitido === "true") where.reciboEmitido = true;
    if (reciboEmitido === "false") where.reciboEmitido = false;
    if (dataInicio || dataFim) {
      where.data = {};
      if (dataInicio) where.data.gte = new Date(dataInicio);
      if (dataFim) {
        const f = new Date(dataFim);
        f.setHours(23, 59, 59, 999);
        where.data.lte = f;
      }
    }

    const [rows, total] = await Promise.all([
      prisma.freteMovimento.findMany({
        where,
        include: {
          cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
          venda: {
            select: { id: true, dataVenda: true, valorTotal: true, freteRecibo: true, freteReciboNum: true },
          },
        },
        orderBy: { data: "desc" },
        take,
        skip,
      }),
      prisma.freteMovimento.count({ where }),
    ]);
    setPaginationHeaders(res, { total, take, skip });
    res.json(rows);
  } catch (e) {
    handleRouteError(res, e);
  }
});

// PATCH /api/fretes/:id — recibo e datas
router.patch("/:id", async (req, res) => {
  try {
    const id = parseIntField(req.params.id, "id", { min: 1 });
    const {
      reciboEmitido,
      reciboNumero,
      reciboData,
      data,
      observacao,
      valor,
    } = req.body;

    const existing = await prisma.freteMovimento.findUnique({
      where: { id },
      include: { venda: true },
    });
    if (!existing) return res.status(404).json({ error: "Frete não encontrado" });

    const dataPatch = {};
    if (reciboEmitido !== undefined) dataPatch.reciboEmitido = !!reciboEmitido;
    if (reciboNumero !== undefined) dataPatch.reciboNumero = reciboNumero || null;
    if (reciboData !== undefined)
      dataPatch.reciboData = reciboData
        ? parseDateField(reciboData, "reciboData")
        : null;
    if (data !== undefined && data !== null && data !== "")
      dataPatch.data = parseDateField(data, "data", { required: true });
    if (observacao !== undefined) dataPatch.observacao = observacao || null;
    if (valor !== undefined && valor !== null && valor !== "")
      dataPatch.valor = parseNumberField(valor, "valor", { min: 0 });

    const updated = await prisma.$transaction(async (tx) => {
      const f = await tx.freteMovimento.update({
        where: { id },
        data: dataPatch,
        include: {
          cliente: true,
          venda: true,
        },
      });

      if (f.vendaId && f.venda) {
        const primeiros = await tx.freteMovimento.findMany({
          where: { vendaId: f.vendaId },
          orderBy: { id: "asc" },
        });
        const primeiro = primeiros[0];
        const mesmoPrimeiro = primeiro && primeiro.id === f.id;
        if (mesmoPrimeiro || primeiros.length === 1) {
          await tx.venda.update({
            where: { id: f.vendaId },
            data: {
              freteRecibo: !!f.reciboEmitido,
              freteReciboNum: f.reciboNumero || null,
            },
          });
        }
      }

      await registrarEventoFinanceiro(tx, {
        tipo: "FRETE_ALTERADO",
        entidade: "FreteMovimento",
        entidadeId: id,
        clienteId: f.clienteId,
        vendaId: f.vendaId,
        valor: parseFloat(String(f.valor)),
        payload: dataPatch,
      });

      return f;
    });

    res.json(updated);
  } catch (e) {
    handleRouteError(res, e);
  }
});

// POST /api/fretes/vale-avulso — cria frete sem venda + título de cobrança
router.post("/vale-avulso", async (req, res) => {
  try {
    const clienteId = parseIntField(req.body?.clienteId, "clienteId", { min: 1 });
    const valor = parseNumberField(req.body?.valor, "valor", { min: 0.01 });
    const motoristaNome = String(req.body?.motoristaNome || "").trim();
    const produtoNome = String(req.body?.produtoNome || "").trim();
    const observacaoLivre = String(req.body?.observacao || "").trim();
    const dataMovimento =
      req.body?.dataMovimento != null && String(req.body.dataMovimento).trim() !== ""
        ? parseDateField(req.body.dataMovimento, "dataMovimento", { required: true })
        : new Date();
    const vencimento =
      req.body?.vencimento != null && String(req.body.vencimento).trim() !== ""
        ? parseDateField(req.body.vencimento, "vencimento", { required: true })
        : (() => {
            const d = new Date();
            d.setDate(d.getDate() + 30);
            return d;
          })();

    const partesObs = [
      "Vale avulso de frete",
      motoristaNome ? `Motorista: ${motoristaNome}` : "",
      produtoNome ? `Produto: ${produtoNome}` : "",
      observacaoLivre,
    ].filter(Boolean);
    const observacao = partesObs.join(" · ");

    const result = await prisma.$transaction(async (tx) => {
      const frete = await tx.freteMovimento.create({
        data: {
          clienteId,
          vendaId: null,
          valor,
          reciboEmitido: false,
          data: dataMovimento,
          observacao,
        },
        include: {
          cliente: { select: { id: true, nomeFantasia: true, razaoSocial: true } },
        },
      });

      const titulo = await tx.tituloReceber.create({
        data: {
          clienteId,
          vendaId: null,
          numero: `VALE-FRETE-${frete.id}`,
          vencimento,
          valorOriginal: valor,
          status: "aberto",
          observacoes: observacao,
        },
      });

      await registrarEventoFinanceiro(tx, {
        tipo: "FRETE_VALE_AVULSO_CRIADO",
        entidade: "FreteMovimento",
        entidadeId: frete.id,
        clienteId,
        vendaId: null,
        valor,
        payload: {
          tituloId: titulo.id,
          motoristaNome: motoristaNome || null,
          produtoNome: produtoNome || null,
        },
      });

      return { frete, titulo };
    });

    res.status(201).json(result);
  } catch (e) {
    handleRouteError(res, e);
  }
});

// POST /api/fretes/:id/vale — cria título de cobrança (vale de frete)
router.post("/:id/vale", async (req, res) => {
  try {
    const id = parseIntField(req.params.id, "id", { min: 1 });
    const existing = await prisma.freteMovimento.findUnique({
      where: { id },
    });
    if (!existing) return res.status(404).json({ error: "Frete não encontrado" });

    const valorInformado = req.body?.valor;
    const valor =
      valorInformado !== undefined && valorInformado !== null && valorInformado !== ""
        ? parseNumberField(valorInformado, "valor", { min: 0.01 })
        : parseFloat(String(existing.valor));
    if (!Number.isFinite(valor) || valor <= 0) {
      return res.status(400).json({ error: "Valor do vale inválido" });
    }

    const vencimento =
      req.body?.vencimento != null && String(req.body.vencimento).trim() !== ""
        ? parseDateField(req.body.vencimento, "vencimento", { required: true })
        : (() => {
            const d = new Date();
            d.setDate(d.getDate() + 30);
            return d;
          })();
    const observacaoExtra =
      req.body?.observacao == null ? "" : String(req.body.observacao).trim();

    const titulo = await prisma.$transaction(async (tx) => {
      const created = await tx.tituloReceber.create({
        data: {
          clienteId: existing.clienteId,
          vendaId: existing.vendaId || null,
          numero: `VALE-FRETE-${existing.id}`,
          vencimento,
          valorOriginal: valor,
          status: "aberto",
          observacoes: [observacaoExtra, `Vale criado a partir do frete #${existing.id}`]
            .filter(Boolean)
            .join(" · "),
        },
        include: {
          cliente: { select: { id: true, nomeFantasia: true, razaoSocial: true } },
          venda: { select: { id: true } },
        },
      });

      await registrarEventoFinanceiro(tx, {
        tipo: "FRETE_VALE_CRIADO",
        entidade: "TituloReceber",
        entidadeId: created.id,
        clienteId: created.clienteId,
        vendaId: created.vendaId,
        valor,
        payload: { freteMovimentoId: existing.id },
      });
      return created;
    });

    res.status(201).json(titulo);
  } catch (e) {
    handleRouteError(res, e);
  }
});

module.exports = router;
