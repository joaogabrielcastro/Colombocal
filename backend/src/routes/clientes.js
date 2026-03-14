const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// GET /api/clientes - listar todos os clientes
router.get("/", async (req, res) => {
  try {
    const { busca, ativo, take, skip } = req.query;
    const where = {};
    if (ativo !== undefined) where.ativo = ativo === "true";
    if (busca) {
      where.OR = [
        { razaoSocial: { contains: busca, mode: "insensitive" } },
        { nomeFantasia: { contains: busca, mode: "insensitive" } },
        { cnpj: { contains: busca } },
        { cidade: { contains: busca, mode: "insensitive" } },
      ];
    }
    const takeNum = take ? parseInt(take) : undefined;
    const skipNum = skip ? parseInt(skip) : undefined;
    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        orderBy: { razaoSocial: "asc" },
        take: takeNum,
        skip: skipNum,
      }),
      prisma.cliente.count({ where }),
    ]);
    res.json({ clientes, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/clientes/:id - buscar cliente por ID
router.get("/:id", async (req, res) => {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        precosEspeciais: { include: { produto: true } },
      },
    });
    if (!cliente)
      return res.status(404).json({ error: "Cliente não encontrado" });
    res.json(cliente);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/clientes/:id/conta - conta corrente do cliente
router.get("/:id/conta", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const cliente = await prisma.cliente.findUnique({ where: { id } });
    if (!cliente)
      return res.status(404).json({ error: "Cliente não encontrado" });

    const vendas = await prisma.venda.findMany({
      where: { clienteId: id },
      include: {
        itens: { include: { produto: true } },
        vendedor: true,
        motorista: true,
      },
      orderBy: { dataVenda: "desc" },
    });

    const pagamentos = await prisma.pagamento.findMany({
      where: { clienteId: id },
      include: { cheque: true },
      orderBy: { data: "desc" },
    });

    const totalDebitos = vendas.reduce(
      (acc, v) => acc + parseFloat(v.valorTotal),
      0,
    );
    const totalCreditos = pagamentos.reduce(
      (acc, p) => acc + parseFloat(p.valor),
      0,
    );
    const saldo = totalCreditos - totalDebitos; // negativo = devendo

    res.json({
      cliente,
      saldo,
      totalDebitos,
      totalCreditos,
      vendas,
      pagamentos,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/clientes/:id/precos - preços especiais do cliente
router.get("/:id/precos", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const produtos = await prisma.produto.findMany({ where: { ativo: true } });
    const precosEspeciais = await prisma.precoClienteProduto.findMany({
      where: { clienteId: id },
    });
    const precoMap = Object.fromEntries(
      precosEspeciais.map((p) => [p.produtoId, p.preco]),
    );
    const result = produtos.map((p) => ({
      ...p,
      precoEspecial: precoMap[p.id] || null,
      precoAplicado: precoMap[p.id] || p.precoPadrao,
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/clientes - criar cliente
router.post("/", async (req, res) => {
  try {
    const {
      cnpj,
      razaoSocial,
      nomeFantasia,
      telefone,
      cidade,
      estado,
      endereco,
      observacoes,
      fretePadrao,
    } = req.body;
    const cnpjLimpo = cnpj.replace(/\D/g, "");
    const cliente = await prisma.cliente.create({
      data: {
        cnpj: cnpjLimpo,
        razaoSocial,
        nomeFantasia,
        telefone,
        cidade,
        estado,
        endereco,
        observacoes,
        fretePadrao: fretePadrao || 0,
      },
    });
    res.status(201).json(cliente);
  } catch (error) {
    if (error.code === "P2002")
      return res.status(400).json({ error: "CNPJ já cadastrado" });
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/clientes/:id - atualizar cliente
router.put("/:id", async (req, res) => {
  try {
    const {
      razaoSocial,
      nomeFantasia,
      telefone,
      cidade,
      estado,
      endereco,
      observacoes,
      fretePadrao,
      ativo,
    } = req.body;
    const cliente = await prisma.cliente.update({
      where: { id: parseInt(req.params.id) },
      data: {
        razaoSocial,
        nomeFantasia,
        telefone,
        cidade,
        estado,
        endereco,
        observacoes,
        fretePadrao,
        ativo,
      },
    });
    res.json(cliente);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/clientes/:id/precos - atualizar preços especiais
router.put("/:id/precos", async (req, res) => {
  try {
    const clienteId = parseInt(req.params.id);
    const { precos } = req.body; // [{ produtoId, preco }]
    // Upsert each price
    for (const p of precos) {
      if (p.preco === null || p.preco === "") {
        await prisma.precoClienteProduto.deleteMany({
          where: { clienteId, produtoId: p.produtoId },
        });
      } else {
        await prisma.precoClienteProduto.upsert({
          where: { clienteId_produtoId: { clienteId, produtoId: p.produtoId } },
          update: { preco: p.preco },
          create: { clienteId, produtoId: p.produtoId, preco: p.preco },
        });
      }
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/clientes/:id - inativar cliente
router.delete("/:id", async (req, res) => {
  try {
    await prisma.cliente.update({
      where: { id: parseInt(req.params.id) },
      data: { ativo: false },
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
