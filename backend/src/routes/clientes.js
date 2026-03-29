const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");
const prisma = new PrismaClient();

// GET /api/clientes - listar todos os clientes
router.get("/", async (req, res) => {
  try {
    const { busca, ativo } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 100,
      maxTake: 500,
    });
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
    const [clientes, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        orderBy: { razaoSocial: "asc" },
        take,
        skip,
        include: { vendedor: true },
      }),
      prisma.cliente.count({ where }),
    ]);
    setPaginationHeaders(res, { total, take, skip });
    res.json({ clientes, total });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/clientes/:id - buscar cliente por ID
router.get("/:id", async (req, res) => {
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        precosEspeciais: { include: { produto: true } },
        vendedor: true,
      },
    });
    if (!cliente)
      return res.status(404).json({ error: "Cliente não encontrado" });
    res.json(cliente);
  } catch (error) {
    handleRouteError(res, error);
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
      include: { cheque: true, venda: true },
      orderBy: { data: "desc" },
    });

    const titulos = await prisma.tituloReceber.findMany({
      where: { clienteId: id },
      include: { venda: true },
      orderBy: { vencimento: "asc" },
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
    const totalTitulosEmAberto = titulos.reduce((acc, t) => {
      const aberto = parseFloat(t.valorOriginal) - parseFloat(t.valorPago);
      return acc + Math.max(0, aberto);
    }, 0);

    res.json({
      cliente,
      saldo,
      totalDebitos,
      totalCreditos,
      totalTitulosEmAberto,
      vendas,
      pagamentos,
      titulos,
    });
  } catch (error) {
    handleRouteError(res, error);
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
      vendedorId,
      comissaoFixaPercentual,
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
        vendedorId:
          vendedorId != null && vendedorId !== ""
            ? parseInt(vendedorId, 10)
            : null,
        comissaoFixaPercentual:
          comissaoFixaPercentual != null && comissaoFixaPercentual !== ""
            ? parseFloat(comissaoFixaPercentual)
            : null,
      },
      include: { vendedor: true },
    });
    res.status(201).json(cliente);
  } catch (error) {
    if (error.code === "P2002")
      return res.status(400).json({ error: "CNPJ já cadastrado" });
    handleRouteError(res, error);
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
      vendedorId,
      comissaoFixaPercentual,
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
        vendedorId:
          vendedorId === null || vendedorId === ""
            ? null
            : parseInt(vendedorId, 10),
        comissaoFixaPercentual:
          comissaoFixaPercentual === null || comissaoFixaPercentual === ""
            ? null
            : parseFloat(comissaoFixaPercentual),
      },
      include: { vendedor: true },
    });
    res.json(cliente);
  } catch (error) {
    handleRouteError(res, error);
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
    handleRouteError(res, error);
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
    handleRouteError(res, error);
  }
});

module.exports = router;
