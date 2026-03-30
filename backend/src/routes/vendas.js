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

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// GET /api/vendas
router.get("/", async (req, res) => {
  try {
    const { clienteId, vendedorId, dataInicio, dataFim, busca } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 100,
      maxTake: 500,
    });
    const where = {};
    if (clienteId) where.clienteId = parseInt(clienteId);
    if (vendedorId) where.vendedorId = parseInt(vendedorId);
    if (dataInicio || dataFim) {
      where.dataVenda = {};
      if (dataInicio) where.dataVenda.gte = new Date(dataInicio);
      if (dataFim) {
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59, 999);
        where.dataVenda.lte = fim;
      }
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
    const [vendas, total] = await Promise.all([
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
    ]);
    setPaginationHeaders(res, { total, take, skip });
    res.json(vendas);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/vendas/:id
router.get("/:id", async (req, res) => {
  try {
    const venda = await prisma.venda.findUnique({
      where: { id: parseInt(req.params.id) },
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
    res.status(500).json({ error: error.message });
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

    const venda = await prisma.venda.findUnique({ where: { id } });
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
        where: { vendaId: id },
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
        tipo: "VENDA_FRETE_ATUALIZADO",
        entidade: "Venda",
        entidadeId: id,
        clienteId: v.clienteId,
        vendaId: id,
        payload: dataVenda,
      });

      return v;
    });

    const completa = await prisma.venda.findUnique({
      where: { id: updated.id },
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
    const {
      clienteId,
      vendedorId,
      motoristaId,
      frete,
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
    const freteNum = parseNumberField(frete, "frete", { required: false, min: 0 }) || 0;
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

    for (const item of itensValidos) {
      const produto = await prisma.produto.findUnique({
        where: { id: item.produtoId },
      });
      if (!produto)
        return res
          .status(400)
          .json({ error: `Produto ID ${item.produtoId} não encontrado` });
    }

    const venda = await prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.findUnique({
        where: { id: clienteIdNum },
      });
      if (!cliente) throw new Error("Cliente não encontrado");

      const vendedor = await tx.vendedor.findUnique({
        where: { id: vendedorIdNum },
      });
      if (!vendedor) throw new Error("Vendedor não encontrado");

      const comissaoPercentualAplicado =
        cliente.comissaoFixaPercentual != null
          ? parseFloat(cliente.comissaoFixaPercentual)
          : parseFloat(vendedor.comissaoPercentual || 0);
      const comissaoValor = (valorTotal * comissaoPercentualAplicado) / 100;
      const dataEfetivaVenda = dataVendaDate || new Date();

      const novaVenda = await tx.venda.create({
        data: {
          clienteId: clienteIdNum,
          vendedorId: vendedorIdNum,
          motoristaId: motoristaIdNum,
          frete: freteNum,
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
          clienteId: clienteIdNum,
          vendaId: novaVenda.id,
          numero: `VENDA-${novaVenda.id}`,
          vencimento: addDays(dataEfetivaVenda, 30),
          valorOriginal: valorTotal,
          status: "aberto",
          observacoes: `Titulo gerado automaticamente para venda #${novaVenda.id}`,
        },
      });

      if (freteNum > 0) {
        const rd =
          freteReciboData != null && String(freteReciboData).trim() !== ""
            ? parseDateField(freteReciboData, "freteReciboData")
            : null;
        await tx.freteMovimento.create({
          data: {
            vendaId: novaVenda.id,
            clienteId: clienteIdNum,
            valor: freteNum,
            reciboEmitido: !!freteRecibo,
            reciboNumero: freteReciboNum || null,
            reciboData: rd,
            data: dataEfetivaVenda,
            observacao: `Frete da venda #${novaVenda.id}`,
          },
        });
      }

      await registrarEventoFinanceiro(tx, {
        tipo: "VENDA_CRIADA",
        entidade: "Venda",
        entidadeId: novaVenda.id,
        clienteId: clienteIdNum,
        vendaId: novaVenda.id,
        valor: valorTotal,
        payload: {
          vendedorId: vendedorIdNum,
          comissaoPercentualAplicado,
          frete: freteNum,
          itens: itensValidos.length,
        },
      });

      for (const item of itensValidos) {
        await tx.movimentacaoEstoque.create({
          data: {
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

    const vendaCompleta = await prisma.venda.findUnique({
      where: { id: venda.id },
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
    const id = parseInt(req.params.id);
    const vendaExistente = await prisma.venda.findUnique({
      where: { id },
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

    const chequeRecebido = vendaExistente.cheques.some(
      (c) => c.status === "recebido" || c.status === "depositado",
    );
    if (chequeRecebido) {
      return res.status(400).json({
        error:
          "Venda com cheque recebido/depositado não pode ser cancelada. Ajuste os cheques primeiro.",
      });
    }

    await prisma.$transaction(async (tx) => {
      const venda = await tx.venda.findUnique({
        where: { id },
        include: { itens: true },
      });
      if (!venda) throw new Error("Venda não encontrada");
      await tx.cheque.deleteMany({ where: { vendaId: id } });
      await tx.movimentacaoEstoque.deleteMany({ where: { vendaId: id } });
      await tx.freteMovimento.deleteMany({ where: { vendaId: id } });
      await tx.tituloReceber.deleteMany({ where: { vendaId: id } });
      await tx.venda.delete({ where: { id } });
      await registrarEventoFinanceiro(tx, {
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
