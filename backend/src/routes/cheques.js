const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const { recalcularTitulos, recalcularTodosTitulosCliente } = require("../services/recebiveis");
const { registrarEventoFinanceiro } = require("../services/financeiroEventos");
const { registrarCheque } = require("../application/use-cases/registrarCheque");
const { registrarChequeLote } = require("../application/use-cases/registrarChequeLote");
const { excluirCheque } = require("../application/use-cases/excluirCheque");
const { parseIntField } = require("../utils/validation");
const { parseBody } = require("../utils/zodParse");
const {
  chequeCreateSchema,
  chequeLoteCreateSchema,
  chequeStatusPatchSchema,
} = require("../schemas/cheque");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");

/**
 * Mesma regra do PATCH /:id/status (pagamento + títulos), dentro de tx.
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 */
async function aplicarMudancaStatusCheque(tx, chequeAtual, statusValidado, dataCompensacaoDate) {
  const id = chequeAtual.id;
  const data = { status: statusValidado };
  if (statusValidado === "ativo" && dataCompensacaoDate) data.dataCompensacao = dataCompensacaoDate;

  await tx.cheque.update({ where: { id }, data });
  await registrarEventoFinanceiro(tx, {
    tipo: "CHEQUE_STATUS_ALTERADO",
    entidade: "Cheque",
    entidadeId: chequeAtual.id,
    chequeId: chequeAtual.id,
    clienteId: chequeAtual.clienteId,
    vendaId: chequeAtual.vendaId,
    valor: parseFloat(String(chequeAtual.valor)),
    payload: { de: chequeAtual.status, para: statusValidado },
  });

  const temPagamento = !!chequeAtual.pagamento;
  const precisaPagamento = statusValidado === "ativo";

  if (precisaPagamento && !temPagamento) {
    await tx.pagamento.create({
      data: {
        clienteId: chequeAtual.clienteId,
        vendaId: chequeAtual.vendaId,
        tipo: "cheque",
        valor: chequeAtual.valor,
        data: chequeAtual.dataRecebimento,
        chequeId: chequeAtual.id,
        observacoes: `Cheque #${chequeAtual.numero || chequeAtual.id} - ${chequeAtual.banco || ""}`,
      },
    });
    await recalcularTodosTitulosCliente(tx, chequeAtual.clienteId);
  }

  if (!precisaPagamento && temPagamento) {
    await tx.pagamento.deleteMany({ where: { chequeId: chequeAtual.id } });
    await recalcularTitulos(tx, { clienteId: chequeAtual.clienteId, vendaId: chequeAtual.vendaId });
  }
}

// GET /api/cheques
router.get("/", async (req, res) => {
  try {
    const {
      clienteId,
      status: _statusIgnored,
      dataInicio,
      dataFim,
      ordem,
      cliente,
      emitente,
      banco,
      numero,
      valorMin,
      valorMax,
    } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 100,
      maxTake: 500,
    });
    const includeResumo =
      req.query.resumo === "1" || req.query.resumo === "true";

    const and = [];
    if (clienteId) and.push({ clienteId: parseInt(clienteId, 10) });
    // status unico: nao aplicamos filtro de status na listagem
    if (dataInicio || dataFim) {
      const dr = {};
      if (dataInicio) dr.gte = new Date(dataInicio);
      if (dataFim) {
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59, 999);
        dr.lte = fim;
      }
      and.push({ dataRecebimento: dr });
    }
    if (ordem != null && String(ordem).trim() !== "") {
      const n = parseInt(String(ordem).replace(/^#/, "").trim(), 10);
      if (!Number.isNaN(n) && n > 0) {
        and.push({
          OR: [{ numeroOrdem: n }, { vendaId: n }],
        });
      }
    }
    if (cliente && String(cliente).trim()) {
      const term = String(cliente).trim();
      and.push({
        cliente: {
          OR: [
            { nomeFantasia: { contains: term, mode: "insensitive" } },
            { razaoSocial: { contains: term, mode: "insensitive" } },
            { cnpj: { contains: term } },
          ],
        },
      });
    }
    if (emitente && String(emitente).trim()) {
      and.push({
        emitenteNome: {
          contains: String(emitente).trim(),
          mode: "insensitive",
        },
      });
    }
    if (banco && String(banco).trim()) {
      and.push({ banco: { contains: String(banco).trim(), mode: "insensitive" } });
    }
    if (numero && String(numero).trim()) {
      and.push({ numero: { contains: String(numero).trim() } });
    }
    if (
      (valorMin != null && String(valorMin).trim() !== "") ||
      (valorMax != null && String(valorMax).trim() !== "")
    ) {
      const vr = {};
      if (valorMin != null && String(valorMin).trim() !== "") {
        const min = Number(String(valorMin).replace(",", "."));
        if (!Number.isNaN(min)) vr.gte = min;
      }
      if (valorMax != null && String(valorMax).trim() !== "") {
        const max = Number(String(valorMax).replace(",", "."));
        // 0 ou inválido = sem teto (evita lista vazia com "máx. 0" no formulário)
        if (!Number.isNaN(max) && max > 0) vr.lte = max;
      }
      if (Object.keys(vr).length) and.push({ valor: vr });
    }
    const where = and.length ? { AND: and } : {};

    const queries = [
      prisma.cheque.findMany({
        where,
        include: {
          cliente: true,
          venda: { select: { id: true, dataVenda: true, valorTotal: true } },
        },
        orderBy: { numeroOrdem: "desc" },
        take,
        skip,
      }),
      prisma.cheque.count({ where }),
    ];
    if (includeResumo) {
      queries.push(
        prisma.cheque.groupBy({
          by: ["status"],
          where,
          _sum: { valor: true },
          _count: { id: true },
        }),
      );
    }

    const results = await Promise.all(queries);
    const cheques = results[0];
    const total = results[1];
    setPaginationHeaders(res, { total, take, skip });

    if (includeResumo) {
      const raw = results[2];
      const order = ["ativo"];
      const resumoPorStatus = raw
        .map((row) => ({
          status: String(row.status || "").trim(),
          count: row._count?.id ?? 0,
          total: parseFloat(String(row._sum?.valor ?? 0)),
        }))
        .sort(
          (a, b) =>
            order.indexOf(a.status) - order.indexOf(b.status) ||
            a.status.localeCompare(b.status),
        );
      res.json({ items: cheques, resumoPorStatus });
    } else {
      res.json(cheques);
    }
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/cheques/:id
router.get("/:id", async (req, res) => {
  try {
    const cheque = await prisma.cheque.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { cliente: true, pagamento: true },
    });
    if (!cheque)
      return res.status(404).json({ error: "Cheque não encontrado" });
    res.json(cheque);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// POST /api/cheques - registrar cheque
// status inicial: a_receber (sem pagamento) | recebido (com pagamento)
router.post("/", async (req, res) => {
  try {
    const b = parseBody(chequeCreateSchema, req.body);
    const result = await registrarCheque(prisma, b);
    res.status(201).json(result);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// POST /api/cheques/lote - cadastro em lote de cheques vinculados a venda
router.post("/lote", async (req, res) => {
  try {
    const b = parseBody(chequeLoteCreateSchema, req.body);
    const result = await registrarChequeLote(prisma, b);
    res.status(201).json(result);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// PATCH /api/cheques/:id/status - atualizar status do cheque
router.patch("/:id/status", async (req, res) => {
  try {
    const body = parseBody(chequeStatusPatchSchema, req.body);
    const id = parseIntField(req.params.id, "id", { min: 1 });
    const statusValidado = body.status;
    const dataCompensacaoDate =
      body.dataCompensacao instanceof Date
        ? body.dataCompensacao
        : body.dataCompensacao
          ? new Date(body.dataCompensacao)
          : null;

    const chequeAtual = await prisma.cheque.findUnique({
      where: { id },
      include: { pagamento: true },
    });
    if (!chequeAtual)
      return res.status(404).json({ error: "Cheque não encontrado" });

    await prisma.$transaction(async (tx) => {
      await aplicarMudancaStatusCheque(
        tx,
        chequeAtual,
        statusValidado,
        dataCompensacaoDate,
      );
    });

    const cheque = await prisma.cheque.findUnique({
      where: { id },
      include: { cliente: true, venda: true },
    });
    res.json(cheque);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// DELETE /api/cheques/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = parseIntField(req.params.id, "id", { min: 1 });
    await excluirCheque(prisma, id);
    res.json({ success: true });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
