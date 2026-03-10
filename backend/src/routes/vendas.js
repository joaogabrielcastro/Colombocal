const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET /api/vendas
router.get("/", async (req, res) => {
  try {
    const { clienteId, vendedorId, dataInicio, dataFim, take, skip } =
      req.query;
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
    const vendas = await prisma.venda.findMany({
      where,
      include: {
        cliente: true,
        vendedor: true,
        motorista: true,
        itens: { include: { produto: true } },
      },
      orderBy: { dataVenda: "desc" },
      take: take ? parseInt(take) : undefined,
      skip: skip ? parseInt(skip) : undefined,
    });
    res.json(vendas);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      },
    });
    if (!venda) return res.status(404).json({ error: "Venda não encontrada" });
    res.json(venda);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      dataVenda,
      observacoes,
      itens,
    } = req.body;

    // Calcular valor total
    const subtotalProdutos = itens.reduce((acc, item) => {
      return acc + parseFloat(item.quantidade) * parseFloat(item.precoUnitario);
    }, 0);
    const valorTotal = subtotalProdutos + parseFloat(frete || 0);

    // Criar venda e itens em transação
    const venda = await prisma.$transaction(async (tx) => {
      const novaVenda = await tx.venda.create({
        data: {
          clienteId: parseInt(clienteId),
          vendedorId: parseInt(vendedorId),
          motoristaId: motoristaId ? parseInt(motoristaId) : null,
          frete: frete || 0,
          valorTotal,
          dataVenda: dataVenda ? new Date(dataVenda) : new Date(),
          observacoes,
          itens: {
            create: itens.map((item) => ({
              produtoId: parseInt(item.produtoId),
              quantidade: parseFloat(item.quantidade),
              precoUnitario: parseFloat(item.precoUnitario),
              subtotal:
                parseFloat(item.quantidade) * parseFloat(item.precoUnitario),
            })),
          },
        },
        include: { itens: true },
      });

      // Atualizar estoque e registrar movimentação para cada item
      for (const item of itens) {
        await tx.produto.update({
          where: { id: parseInt(item.produtoId) },
          data: { estoqueAtual: { decrement: parseFloat(item.quantidade) } },
        });
        await tx.movimentacaoEstoque.create({
          data: {
            produtoId: parseInt(item.produtoId),
            tipo: "saida",
            quantidade: parseFloat(item.quantidade),
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
      },
    });

    res.status(201).json(vendaCompleta);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/vendas/:id - cancelar venda (estorna estoque)
router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.$transaction(async (tx) => {
      const venda = await tx.venda.findUnique({
        where: { id },
        include: { itens: true },
      });
      if (!venda) throw new Error("Venda não encontrada");
      // Estornar estoque
      for (const item of venda.itens) {
        await tx.produto.update({
          where: { id: item.produtoId },
          data: { estoqueAtual: { increment: parseFloat(item.quantidade) } },
        });
      }
      // Remover movimentações desta venda
      await tx.movimentacaoEstoque.deleteMany({ where: { vendaId: id } });
      await tx.venda.delete({ where: { id } });
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
