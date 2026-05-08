const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const {
  parseIntField,
  parseNumberField,
  parseDateField,
  ensureArray,
} = require("../utils/validation");
const { parseBody } = require("../utils/zodParse");
const { vendaFretePatchSchema } = require("../schemas/venda");
const { registrarEventoFinanceiro } = require("../services/financeiroEventos");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");

function tw(req) {
  return { tenantId: req.tenantId };
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function calcularFreteAutomatico(itens, produtosPorId, fretePorSaco, fretePorTonelada) {
  const tarifaSaco = parseFloat(String(fretePorSaco ?? 0));
  const tarifaTon = parseFloat(String(fretePorTonelada ?? 0));
  const tarifaKg = Number.isFinite(tarifaTon) ? tarifaTon / 1000 : 0;

  return itens.reduce((acc, item) => {
    const produto = produtosPorId.get(item.produtoId);
    const unidade = String(produto?.unidade || "")
      .trim()
      .toLowerCase();
    if (unidade === "saco") return acc + item.quantidade * (Number.isFinite(tarifaSaco) ? tarifaSaco : 0);
    if (unidade === "ton") return acc + item.quantidade * (Number.isFinite(tarifaTon) ? tarifaTon : 0);
    if (unidade === "kg") return acc + item.quantidade * tarifaKg;
    return acc;
  }, 0);
}

// GET /api/vendas
router.get("/", async (req, res) => {
  try {
    const {
      clienteId,
      vendedorId,
      motoristaId,
      dataInicio,
      dataFim,
      busca,
      valorMin,
      valorMax,
      saldoEmAberto,
    } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 100,
      maxTake: 500,
    });
    const where = { ...tw(req) };
    if (clienteId) where.clienteId = parseInt(clienteId, 10);
    if (vendedorId) where.vendedorId = parseInt(vendedorId, 10);
    if (motoristaId !== undefined && motoristaId !== "") {
      const mid = parseInt(motoristaId, 10);
      if (!Number.isNaN(mid)) where.motoristaId = mid;
    }
    if (dataInicio || dataFim) {
      where.dataVenda = {};
      if (dataInicio) where.dataVenda.gte = new Date(dataInicio);
      if (dataFim) {
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59, 999);
        where.dataVenda.lte = fim;
      }
    }
    const range = {};
    if (valorMin !== undefined && valorMin !== "") {
      const v = parseFloat(valorMin);
      if (!Number.isNaN(v)) range.gte = v;
    }
    if (valorMax !== undefined && valorMax !== "") {
      const v = parseFloat(valorMax);
      if (!Number.isNaN(v)) range.lte = v;
    }
    if (Object.keys(range).length) where.valorTotal = range;
    if (saldoEmAberto === "true" || saldoEmAberto === "1") {
      where.titulos = {
        some: {
          status: { in: ["aberto", "parcial"] },
        },
      };
    }
    if (busca) {
      where.cliente = {
        OR: [
          { razaoSocial: { contains: busca, mode: "insensitive" } },
          { nomeFantasia: { contains: busca, mode: "insensitive" } },
          { cnpj: { contains: busca } },
          { telefone: { contains: busca } },
          { cidade: { contains: busca, mode: "insensitive" } },
        ],
      };
    }
    const [vendas, total, somaAgg] = await Promise.all([
      prisma.venda.findMany({
        where,
        include: {
          cliente: true,
          vendedor: true,
          motorista: true,
          itens: { include: { produto: true } },
          titulos: true,
          fretes: true,
        },
        orderBy: { dataVenda: "desc" },
        take,
        skip,
      }),
      prisma.venda.count({ where }),
      prisma.venda.aggregate({
        where,
        _sum: { valorTotal: true },
      }),
    ]);
    setPaginationHeaders(res, { total, take, skip });
    const soma = somaAgg._sum.valorTotal;
    const somaNum = soma != null ? parseFloat(String(soma)) : 0;
    res.set("x-sum-valor-total", Number.isFinite(somaNum) ? somaNum.toFixed(2) : "0");
    const comSaldo = vendas.map((v) => {
      let saldoEmAbertoTitulos = 0;
      for (const t of v.titulos || []) {
        const vo = parseFloat(String(t.valorOriginal ?? 0));
        const vp = parseFloat(String(t.valorPago ?? 0));
        if (!Number.isNaN(vo) && !Number.isNaN(vp)) {
          saldoEmAbertoTitulos += Math.max(0, vo - vp);
        }
      }
      return { ...v, saldoEmAbertoTitulos };
    });
    res.json(comSaldo);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/vendas/:id
router.get("/:id", async (req, res) => {
  try {
    const venda = await prisma.venda.findFirst({
      where: { id: parseInt(req.params.id), ...tw(req) },
      include: {
        cliente: true,
        vendedor: true,
        motorista: true,
        itens: { include: { produto: true } },
        pagamentos: { orderBy: { data: "desc" } },
        titulos: { orderBy: { vencimento: "asc" } },
        fretes: { orderBy: { data: "desc" } },
      },
    });
    if (!venda) return res.status(404).json({ error: "Venda não encontrada" });
    res.json(venda);
  } catch (error) {
    handleRouteError(res, error);
  }
});

function dataFreteReciboParaPrisma(v) {
  if (v === undefined) return undefined;
  if (v == null) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// PATCH /api/vendas/:id — frete / recibo (sincroniza com primeiro FreteMovimento)
router.patch("/:id", async (req, res) => {
  try {
    const id = parseIntField(req.params.id, "id", { min: 1 });
    const b = parseBody(vendaFretePatchSchema, req.body);
    const tenantId = req.tenantId;

    const venda = await prisma.venda.findFirst({ where: { id, ...tw(req) } });
    if (!venda) return res.status(404).json({ error: "Venda não encontrada" });

    const dataVenda = {};
    if (b.frete !== undefined) {
      dataVenda.frete = b.frete;
    }
    if (b.freteRecibo !== undefined) dataVenda.freteRecibo = !!b.freteRecibo;
    if (b.freteReciboNum !== undefined)
      dataVenda.freteReciboNum = b.freteReciboNum || null;

    const updated = await prisma.$transaction(async (tx) => {
      const v = await tx.venda.update({
        where: { id },
        data: dataVenda,
      });

      const fretes = await tx.freteMovimento.findMany({
        where: { vendaId: id, tenantId },
        orderBy: { id: "asc" },
      });

      if (fretes.length > 0) {
        const primeiro = fretes[0];
        const fmData = {};
        if (b.frete !== undefined) fmData.valor = b.frete;
        if (b.freteRecibo !== undefined) fmData.reciboEmitido = !!b.freteRecibo;
        if (b.freteReciboNum !== undefined)
          fmData.reciboNumero = b.freteReciboNum || null;
        if (b.freteReciboData !== undefined) {
          fmData.reciboData = dataFreteReciboParaPrisma(b.freteReciboData);
        }
        if (Object.keys(fmData).length > 0) {
          await tx.freteMovimento.update({
            where: { id: primeiro.id },
            data: fmData,
          });
        }
      } else if (parseFloat(String(v.frete)) > 0) {
        const valorFrete =
          dataVenda.frete != null
            ? parseFloat(String(dataVenda.frete))
            : parseFloat(String(v.frete));
        if (valorFrete > 0) {
          await tx.freteMovimento.create({
            data: {
              tenantId,
              vendaId: id,
              clienteId: v.clienteId,
              valor: valorFrete,
              reciboEmitido: !!v.freteRecibo,
              reciboNumero: v.freteReciboNum || null,
              reciboData:
                b.freteReciboData !== undefined
                  ? dataFreteReciboParaPrisma(b.freteReciboData)
                  : null,
              data: v.dataVenda,
              observacao: `Frete venda #${id} (edição)`,
            },
          });
        }
      }

      await registrarEventoFinanceiro(tx, {
        tenantId,
        tipo: "VENDA_FRETE_ATUALIZADO",
        entidade: "Venda",
        entidadeId: id,
        clienteId: v.clienteId,
        vendaId: id,
        payload: dataVenda,
      });

      return v;
    });

    const completa = await prisma.venda.findFirst({
      where: { id: updated.id, ...tw(req) },
      include: {
        cliente: true,
        vendedor: true,
        motorista: true,
        itens: { include: { produto: true } },
        pagamentos: { orderBy: { data: "desc" } },
        titulos: { orderBy: { vencimento: "asc" } },
        fretes: { orderBy: { data: "desc" } },
      },
    });
    res.json(completa);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// POST /api/vendas - criar venda
router.post("/", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const {
      clienteId,
      vendedorId,
      motoristaId,
      fretePorSaco,
      fretePorTonelada,
      freteRecibo,
      freteReciboNum,
      freteReciboData,
      dataVenda,
      observacoes,
      itens,
    } = req.body;

    const clienteIdNum = parseIntField(clienteId, "clienteId", { min: 1 });
    const vendedorIdNum = parseIntField(vendedorId, "vendedorId", { min: 1 });
    const motoristaIdNum = parseIntField(motoristaId, "motoristaId", {
      required: false,
      min: 1,
    });
    const fretePorSacoNum =
      parseNumberField(fretePorSaco, "fretePorSaco", { required: false, min: 0 }) ?? null;
    const fretePorTonNum =
      parseNumberField(fretePorTonelada, "fretePorTonelada", { required: false, min: 0 }) ?? null;
    const dataVendaDate = parseDateField(dataVenda, "dataVenda", { required: false });
    const itensValidos = ensureArray(itens, "itens", { minLength: 1 }).map((item) => ({
      produtoId: parseIntField(item?.produtoId, "item.produtoId", { min: 1 }),
      quantidade: parseNumberField(item?.quantidade, "item.quantidade", { min: 0.001 }),
      precoUnitario: parseNumberField(item?.precoUnitario, "item.precoUnitario", {
        min: 0,
      }),
    }));

    const valorTotal = itensValidos.reduce(
      (acc, item) => acc + item.quantidade * item.precoUnitario,
      0,
    );
    const produtos = await Promise.all(
      itensValidos.map((item) =>
        prisma.produto.findFirst({
          where: { id: item.produtoId, tenantId },
          select: { id: true, unidade: true },
        }),
      ),
    );
    const produtosPorId = new Map();
    for (let i = 0; i < itensValidos.length; i += 1) {
      const item = itensValidos[i];
      const produto = produtos[i];
      if (!produto)
        return res
          .status(400)
          .json({ error: `Produto ID ${item.produtoId} não encontrado` });
      produtosPorId.set(produto.id, produto);
    }

    const venda = await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findFirst({
        where: { id: clienteIdNum, tenantId },
      });
      if (!cliente) throw new Error("Cliente não encontrado");

      const vendedor = await tx.vendedor.findFirst({
        where: { id: vendedorIdNum, tenantId },
      });
      if (!vendedor) throw new Error("Vendedor não encontrado");

      if (motoristaIdNum != null) {
        const mot = await tx.motorista.findFirst({
          where: { id: motoristaIdNum, tenantId },
        });
        if (!mot) throw new Error("Motorista não encontrado");
      }

      const comissaoPercentualAplicado =
        cliente.comissaoFixaPercentual != null
          ? parseFloat(cliente.comissaoFixaPercentual)
          : parseFloat(vendedor.comissaoPercentual || 0);
      const comissaoValor = (valorTotal * comissaoPercentualAplicado) / 100;
      const dataEfetivaVenda = dataVendaDate || new Date();
      const fretePorSacoAplicado =
        fretePorSacoNum != null
          ? fretePorSacoNum
          : parseFloat(String(cliente.fretePadraoSaco ?? cliente.fretePadrao ?? 0));
      const fretePorTonAplicado =
        fretePorTonNum != null
          ? fretePorTonNum
          : parseFloat(String(cliente.fretePadraoTonelada ?? 0));
      const freteFinal = calcularFreteAutomatico(
        itensValidos,
        produtosPorId,
        fretePorSacoAplicado,
        fretePorTonAplicado,
      );

      const novaVenda = await tx.venda.create({
        data: {
          tenantId,
          clienteId: clienteIdNum,
          vendedorId: vendedorIdNum,
          motoristaId: motoristaIdNum,
          frete: freteFinal,
          freteTarifaSaco: fretePorSacoAplicado,
          freteTarifaTonelada: fretePorTonAplicado,
          freteRecibo: !!freteRecibo,
          freteReciboNum: freteReciboNum || null,
          comissaoPercentualAplicado,
          comissaoValor,
          valorTotal,
          dataVenda: dataEfetivaVenda,
          observacoes,
          itens: {
            create: itensValidos.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
              precoUnitario: item.precoUnitario,
              subtotal: item.quantidade * item.precoUnitario,
            })),
          },
        },
        include: { itens: true },
      });

      await tx.tituloReceber.create({
        data: {
          tenantId,
          clienteId: clienteIdNum,
          vendaId: novaVenda.id,
          numero: `VENDA-${novaVenda.id}`,
          vencimento: addDays(dataEfetivaVenda, 30),
          valorOriginal: valorTotal,
          status: "aberto",
          observacoes: `Titulo gerado automaticamente para venda #${novaVenda.id}`,
        },
      });

      if (freteFinal > 0) {
        const rd =
          freteReciboData != null && String(freteReciboData).trim() !== ""
            ? parseDateField(freteReciboData, "freteReciboData")
            : null;
        await tx.freteMovimento.create({
          data: {
            tenantId,
            vendaId: novaVenda.id,
            clienteId: clienteIdNum,
            valor: freteFinal,
            reciboEmitido: !!freteRecibo,
            reciboNumero: freteReciboNum || null,
            reciboData: rd,
            data: dataEfetivaVenda,
            observacao: `Frete da venda #${novaVenda.id}`,
          },
        });
      }

      await registrarEventoFinanceiro(tx, {
        tenantId,
        tipo: "VENDA_CRIADA",
        entidade: "Venda",
        entidadeId: novaVenda.id,
        clienteId: clienteIdNum,
        vendaId: novaVenda.id,
        valor: valorTotal,
        payload: {
          vendedorId: vendedorIdNum,
          comissaoPercentualAplicado,
          frete: freteFinal,
          fretePorSaco: fretePorSacoAplicado,
          fretePorTonelada: fretePorTonAplicado,
          itens: itensValidos.length,
        },
      });

      for (const item of itensValidos) {
        await tx.movimentacaoEstoque.create({
          data: {
            tenantId,
            produtoId: item.produtoId,
            tipo: "saida",
            quantidade: item.quantidade,
            vendaId: novaVenda.id,
            observacao: `Venda #${novaVenda.id}`,
          },
        });
      }

      return novaVenda;
    });

    const vendaCompleta = await prisma.venda.findFirst({
      where: { id: venda.id, ...tw(req) },
      include: {
        cliente: true,
        vendedor: true,
        motorista: true,
        itens: { include: { produto: true } },
        pagamentos: true,
        titulos: true,
        fretes: true,
      },
    });

    res.status(201).json(vendaCompleta);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// DELETE /api/vendas/:id - cancelar venda
router.delete("/:id", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const id = parseIntField(req.params.id, "id", { min: 1 });
    const vendaExistente = await prisma.venda.findFirst({
      where: { id, ...tw(req) },
      include: {
        pagamentos: true,
        cheques: { select: { id: true, status: true } },
      },
    });
    if (!vendaExistente)
      return res.status(404).json({ error: "Venda não encontrada" });

    if (vendaExistente.pagamentos.length > 0) {
      return res.status(400).json({
        error:
          "Venda com baixas registradas não pode ser cancelada. Estorne as baixas primeiro.",
      });
    }

    const temChequeVinculado = vendaExistente.cheques.length > 0;
    if (temChequeVinculado) {
      return res.status(400).json({
        error:
          "Venda com cheques vinculados não pode ser cancelada. Ajuste os cheques primeiro.",
      });
    }

    await prisma.$transaction(async (tx) => {
      const venda = await tx.venda.findFirst({
        where: { id, tenantId },
        include: { itens: true },
      });
      if (!venda) throw new Error("Venda não encontrada");
      await tx.cheque.deleteMany({ where: { vendaId: id, tenantId } });
      await tx.movimentacaoEstoque.deleteMany({ where: { vendaId: id, tenantId } });
      await tx.freteMovimento.deleteMany({ where: { vendaId: id, tenantId } });
      await tx.tituloReceber.deleteMany({ where: { vendaId: id, tenantId } });
      await tx.venda.delete({ where: { id } });
      await registrarEventoFinanceiro(tx, {
        tenantId,
        tipo: "VENDA_CANCELADA",
        entidade: "Venda",
        entidadeId: venda.id,
        clienteId: venda.clienteId,
        vendaId: venda.id,
        valor: parseFloat(venda.valorTotal),
      });
    });
    res.json({ success: true });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
