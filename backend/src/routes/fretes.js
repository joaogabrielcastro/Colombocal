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

function tw(req) {
  return { tenantId: req.tenantId };
}

function formatMoneyBr(v) {
  const n = parseFloat(String(v || 0));
  return Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "R$ 0,00";
}

function normalizarUnidade(unidadeRaw) {
  const u = String(unidadeRaw || "")
    .trim()
    .toLowerCase();
  if (["saco", "sacos", "sc"].includes(u)) return "saco";
  if (["ton", "tonelada", "toneladas", "t"].includes(u)) return "ton";
  if (["kg", "quilo", "quilos"].includes(u)) return "kg";
  return u;
}

// POST /api/fretes/avulso — cadastro avulso completo (cliente/motorista/produto)
router.post("/avulso", async (req, res) => {
  try {
    const clienteId = parseIntField(req.body?.clienteId, "clienteId", { min: 1 });
    const motoristaId = parseIntField(req.body?.motoristaId, "motoristaId", { min: 1 });
    const precoSaco = parseNumberField(req.body?.precoSaco, "precoSaco", { required: false, min: 0 }) ?? 0;
    const precoTonelada =
      parseNumberField(req.body?.precoTonelada, "precoTonelada", { required: false, min: 0 }) ?? 0;
    const valorTotalInformado =
      parseNumberField(req.body?.valorTotal, "valorTotal", { required: false, min: 0.01 }) ?? null;
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
    const pagoNoAto = !!req.body?.pagoNoAto;
    const pagamentoTipo = String(req.body?.pagamentoTipo || "dinheiro");
    const pagamentoData =
      req.body?.pagamentoData != null && String(req.body.pagamentoData).trim() !== ""
        ? parseDateField(req.body.pagamentoData, "pagamentoData", { required: true })
        : dataMovimento;
    const observacaoLivre = String(req.body?.observacao || "").trim();
    const itensEntrada = Array.isArray(req.body?.itens) ? req.body.itens : null;

    const tenantId = req.tenantId;
    const result = await prisma.$transaction(async (tx) => {
      const [cliente, motorista] = await Promise.all([
        tx.cliente.findFirst({ where: { id: clienteId, tenantId } }),
        tx.motorista.findFirst({ where: { id: motoristaId, tenantId } }),
      ]);
      if (!cliente) {
        const err = new Error("Cliente não encontrado");
        err.status = 404;
        throw err;
      }
      if (!motorista) {
        const err = new Error("Motorista não encontrado");
        err.status = 404;
        throw err;
      }

      const itens = [];
      if (itensEntrada && itensEntrada.length > 0) {
        for (const item of itensEntrada) {
          const produtoId = parseIntField(item?.produtoId, "produtoId", { min: 1 });
          const quantidade = parseNumberField(item?.quantidade, "quantidade", { min: 0.001 });
          const produto = await tx.produto.findFirst({ where: { id: produtoId, tenantId } });
          if (!produto) {
            const err = new Error(`Produto #${produtoId} não encontrado`);
            err.status = 404;
            throw err;
          }
          itens.push({ produto, quantidade });
        }
      } else {
        const produtoId = parseIntField(req.body?.produtoId, "produtoId", { min: 1 });
        const quantidade = parseNumberField(req.body?.quantidade, "quantidade", { min: 0.001 });
        const produto = await tx.produto.findFirst({ where: { id: produtoId, tenantId } });
        if (!produto) {
          const err = new Error("Produto não encontrado");
          err.status = 404;
          throw err;
        }
        itens.push({ produto, quantidade });
      }

      if (!itens.length) {
        const err = new Error("Informe ao menos um item para o frete");
        err.status = 400;
        throw err;
      }

      const itensCalculados = itens.map((it) => {
        const unidade = normalizarUnidade(it.produto.unidade);
        const subtotal =
          unidade === "saco"
            ? it.quantidade * precoSaco
            : unidade === "ton"
              ? it.quantidade * precoTonelada
              : unidade === "kg"
                ? it.quantidade * (precoTonelada / 1000)
                : 0;
        return {
          produtoId: it.produto.id,
          produtoNome: it.produto.nome,
          unidade: it.produto.unidade || "",
          quantidade: it.quantidade,
          subtotal,
        };
      });
      const valorCalculado = itensCalculados.reduce((acc, item) => acc + item.subtotal, 0);
      const valorFinal = valorTotalInformado != null ? valorTotalInformado : valorCalculado;

      const observacao = [
        "Frete avulso",
        `Motorista: ${motorista.nome}`,
        ...itensCalculados.map(
          (item) =>
            `${item.produtoNome}: ${item.quantidade} ${item.unidade} (${formatMoneyBr(item.subtotal)})`,
        ),
        observacaoLivre,
      ]
        .filter(Boolean)
        .join(" · ");

      const frete = await tx.freteMovimento.create({
        data: {
          tenantId,
          vendaId: null,
          clienteId,
          valor: valorFinal,
          reciboEmitido: pagoNoAto,
          reciboData: pagoNoAto ? pagamentoData : null,
          data: dataMovimento,
          observacao,
        },
        include: { cliente: true },
      });

      let titulo = null;
      let pagamento = null;
      if (pagoNoAto) {
        pagamento = await tx.pagamento.create({
          data: {
            tenantId,
            clienteId,
            vendaId: null,
            tipo: pagamentoTipo === "transferencia" ? "transferencia" : "dinheiro",
            valor: valorFinal,
            data: pagamentoData,
            observacoes: `Pagamento de frete avulso #${frete.id}`,
          },
        });
      } else {
        titulo = await tx.tituloReceber.create({
          data: {
            tenantId,
            clienteId,
            vendaId: null,
            numero: `FRETE-AVULSO-${frete.id}`,
            vencimento,
            valorOriginal: valorFinal,
            status: "aberto",
            observacoes: observacao,
          },
        });
      }

      await registrarEventoFinanceiro(tx, {
        tenantId,
        tipo: "FRETE_AVULSO_CRIADO",
        entidade: "FreteMovimento",
        entidadeId: frete.id,
        clienteId,
        vendaId: null,
        valor: valorFinal,
        payload: {
          motoristaId,
          itens: itensCalculados,
          precoSaco,
          precoTonelada,
          valorCalculado,
          valorFinal,
          pagoNoAto,
          tituloId: titulo?.id || null,
          pagamentoId: pagamento?.id || null,
        },
      });

      return {
        frete,
        titulo,
        pagamento,
        resumoImpressao: {
          freteId: frete.id,
          cliente: cliente.nomeFantasia || cliente.razaoSocial,
          motorista: motorista.nome,
          itens: itensCalculados,
          precoSaco,
          precoTonelada,
          valorFinal,
          pagoNoAto,
          valorLabel: formatMoneyBr(valorFinal),
          data: dataMovimento,
        },
      };
    });

    res.status(201).json(result);
  } catch (e) {
    handleRouteError(res, e);
  }
});


// GET /api/fretes — listagem com filtros (painel / relatório)
router.get("/", async (req, res) => {
  try {
    const { clienteId, vendaId, reciboEmitido, dataInicio, dataFim } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 50,
      maxTake: 500,
    });

    const where = { ...tw(req) };
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
            select: {
              id: true,
              numeroVenda: true,
              dataVenda: true,
              valorTotal: true,
              freteRecibo: true,
              freteReciboNum: true,
            },
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

    const tenantId = req.tenantId;
    const existing = await prisma.freteMovimento.findFirst({
      where: { id, ...tw(req) },
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
          where: { vendaId: f.vendaId, tenantId },
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
        tenantId,
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
    const motoristaId = parseIntField(req.body?.motoristaId, "motoristaId", {
      required: false,
      min: 1,
    });
    const produtoId = parseIntField(req.body?.produtoId, "produtoId", {
      required: false,
      min: 1,
    });
    let motoristaNome = String(req.body?.motoristaNome || "").trim();
    let produtoNome = String(req.body?.produtoNome || "").trim();
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

    const tenantId = req.tenantId;
    const result = await prisma.$transaction(async (tx) => {
      if (motoristaId) {
        const motorista = await tx.motorista.findFirst({ where: { id: motoristaId, tenantId } });
        if (!motorista) {
          const err = new Error("Motorista não encontrado");
          err.status = 404;
          throw err;
        }
        motoristaNome = motorista.nome;
      }
      if (produtoId) {
        const produto = await tx.produto.findFirst({ where: { id: produtoId, tenantId } });
        if (!produto) {
          const err = new Error("Produto não encontrado");
          err.status = 404;
          throw err;
        }
        produtoNome = produto.nome;
      }
      const partesObs = [
        "Vale avulso de frete",
        motoristaNome ? `Motorista: ${motoristaNome}` : "",
        produtoNome ? `Produto: ${produtoNome}` : "",
        observacaoLivre,
      ].filter(Boolean);
      const observacao = partesObs.join(" · ");

      const frete = await tx.freteMovimento.create({
        data: {
          tenantId,
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
          tenantId,
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
        tenantId,
        tipo: "FRETE_VALE_AVULSO_CRIADO",
        entidade: "FreteMovimento",
        entidadeId: frete.id,
        clienteId,
        vendaId: null,
        valor,
        payload: {
          tituloId: titulo.id,
          motoristaId: motoristaId || null,
          produtoId: produtoId || null,
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
    const tenantId = req.tenantId;
    const existing = await prisma.freteMovimento.findFirst({
      where: { id, ...tw(req) },
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
          tenantId,
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
          venda: { select: { id: true, numeroVenda: true } },
        },
      });

      await registrarEventoFinanceiro(tx, {
        tenantId,
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
