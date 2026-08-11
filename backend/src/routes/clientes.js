const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");
const { parseBody } = require("../utils/zodParse");
const {
  getClienteCreateSchema,
  clienteUpdateSchema,
  clientePrecosSchema,
  clienteComissoesSchema,
} = require("../schemas/cliente");
const { percentualPadraoCliente } = require("../services/comissaoCadastro");
const { tenantAllowsClienteCpf } = require("../constants/tenantFeatures");
const { resumoFinanceiroCliente } = require("../domain/financeiro/saldoCliente");
const { recalcularTodosTitulosCliente } = require("../services/recebiveis");

/** Converte Decimal/string do Prisma em número JSON seguro para o front */
function toMoneyNumber(v) {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function tenant(req) {
  return { tenantId: req.tenantId };
}

// GET /api/clientes - listar todos os clientes
router.get("/", async (req, res) => {
  try {
    const { busca, ativo } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 100,
      maxTake: 500,
    });
    const where = { ...tenant(req) };
    if (ativo !== undefined) where.ativo = ativo === "true";
    if (busca) {
      where.OR = [
        { razaoSocial: { contains: busca, mode: "insensitive" } },
        { nomeFantasia: { contains: busca, mode: "insensitive" } },
        { cnpj: { contains: busca } },
        { cpf: { contains: busca } },
        { cidade: { contains: busca, mode: "insensitive" } },
        { telefone: { contains: busca } },
        { vendedor: { nome: { contains: busca, mode: "insensitive" } } },
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
    res.set("X-Tenant-Id", String(req.tenantId));
    res.json({ clientes, total });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/clientes/:id/precos — antes de /:id para não haver ambiguidade com o router
// Query opcional: busca, take — para telas com live search (sem = lista completa)
router.get("/:id/precos", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "ID de cliente inválido" });
    }
    const cli = await prisma.cliente.findFirst({
      where: { id, ...tenant(req) },
      select: { id: true },
    });
    if (!cli) return res.status(404).json({ error: "Cliente não encontrado" });

    const busca = (req.query.busca || "").trim();
    const takeRaw = req.query.take;
    const take =
      takeRaw !== undefined && takeRaw !== ""
        ? Math.min(500, Math.max(1, parseInt(String(takeRaw), 10) || 80))
        : null;

    const produtoWhere = { ...tenant(req) };
    const produtoIdOne = req.query.produtoId;
    if (produtoIdOne) {
      const pid = parseInt(String(produtoIdOne), 10);
      if (!Number.isFinite(pid)) {
        return res.status(400).json({ error: "produtoId inválido" });
      }
      produtoWhere.id = pid;
    } else {
      produtoWhere.ativo = true;
      if (busca) {
        produtoWhere.OR = [
          { nome: { contains: busca, mode: "insensitive" } },
          { codigo: { contains: busca, mode: "insensitive" } },
        ];
      }
    }

    const produtos = await prisma.produto.findMany({
      where: produtoWhere,
      orderBy: { nome: "asc" },
      ...(take != null ? { take } : {}),
    });
    const precosEspeciais = await prisma.precoClienteProduto.findMany({
      where: { tenantId: req.tenantId, clienteId: id },
    });
    const precoMap = new Map(
      precosEspeciais.map((row) => [row.produtoId, row.preco]),
    );

    const result = produtos.map((p) => {
      const rawEsp = precoMap.get(p.id);
      const padrao = toMoneyNumber(p.precoPadrao) ?? 0;
      const espNum = rawEsp != null ? toMoneyNumber(rawEsp) : null;
      const aplicado = espNum != null ? espNum : padrao;
      return {
        ...p,
        precoEspecial: espNum,
        precoAplicado: aplicado,
      };
    });
    res.json(result);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/clientes/:id/comissoes — comissão por produto (específica ou padrão)
router.get("/:id/comissoes", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "ID de cliente inválido" });
    }
    const cli = await prisma.cliente.findFirst({
      where: { id, ...tenant(req) },
      include: { vendedor: { select: { id: true, nome: true, comissaoPercentual: true } } },
    });
    if (!cli) return res.status(404).json({ error: "Cliente não encontrado" });

    const produtos = await prisma.produto.findMany({
      where: { ...tenant(req), ativo: true },
      orderBy: { nome: "asc" },
    });
    const comissoesEspeciais = await prisma.comissaoClienteProduto.findMany({
      where: { tenantId: req.tenantId, clienteId: id },
    });
    const comissaoMap = new Map(
      comissoesEspeciais.map((row) => [row.produtoId, row.comissaoPercentual]),
    );
    const padrao = percentualPadraoCliente(cli, cli.vendedor);

    const result = produtos.map((p) => {
      const rawEsp = comissaoMap.get(p.id);
      const espNum = rawEsp != null ? toMoneyNumber(rawEsp) : null;
      const aplicado = espNum != null ? espNum : padrao;
      return {
        ...p,
        comissaoEspecial: espNum,
        comissaoPadrao: padrao,
        comissaoAplicada: aplicado,
      };
    });

    res.json({
      comissaoPadrao: padrao,
      vendedor: cli.vendedor,
      comissaoFixaPercentual:
        cli.comissaoFixaPercentual != null
          ? toMoneyNumber(cli.comissaoFixaPercentual)
          : null,
      produtos: result,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/clientes/:id/conta - conta corrente do cliente
router.get("/:id/conta", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const cliente = await prisma.cliente.findFirst({
      where: { id, ...tenant(req) },
    });
    if (!cliente)
      return res.status(404).json({ error: "Cliente não encontrado" });

    const tw = tenant(req);
    const vendas = await prisma.venda.findMany({
      where: { clienteId: id, ...tw },
      include: {
        itens: { include: { produto: true } },
        vendedor: true,
        motorista: true,
      },
      orderBy: { dataVenda: "desc" },
    });

    const pagamentos = await prisma.pagamento.findMany({
      where: { clienteId: id, ...tw },
      include: { cheque: true, venda: true },
      orderBy: { data: "desc" },
    });

    const titulos = await prisma.tituloReceber.findMany({
      where: { clienteId: id, ...tw },
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
    const saldo = Math.max(0, totalDebitos - totalCreditos);
    const resumoFinanceiro = resumoFinanceiroCliente({
      totalDebitos,
      totalCreditos,
      titulos,
    });
    const totalTitulosEmAberto =
      resumoFinanceiro.titulosReceber.emAberto;

    res.json({
      cliente,
      saldo,
      totalDebitos,
      totalCreditos,
      totalTitulosEmAberto,
      resumoFinanceiro,
      vendas,
      pagamentos,
      titulos,
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/clientes/:id - buscar cliente por ID
router.get("/:id", async (req, res) => {
  try {
    const cliente = await prisma.cliente.findFirst({
      where: { id: parseInt(req.params.id), ...tenant(req) },
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

// POST /api/clientes/:id/reconciliar-recebiveis — reaplica pagamentos nos títulos (sem spill entre vendas)
router.post("/:id/reconciliar-recebiveis", async (req, res) => {
  try {
    const clienteId = parseInt(req.params.id, 10);
    if (!Number.isFinite(clienteId)) {
      return res.status(400).json({ error: "ID de cliente inválido" });
    }
    const existe = await prisma.cliente.findFirst({
      where: { id: clienteId, ...tenant(req) },
      select: { id: true },
    });
    if (!existe) return res.status(404).json({ error: "Cliente não encontrado" });
    await prisma.$transaction((tx) =>
      recalcularTodosTitulosCliente(tx, clienteId),
    );
    res.json({
      success: true,
      message:
        "Títulos reconciliados: cada pagamento só baixa títulos da própria ordem (excedente = troco).",
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// POST /api/clientes - criar cliente
router.post("/", async (req, res) => {
  try {
    const tenantRow = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { slug: true },
    });
    const allowsClienteCpf = tenantAllowsClienteCpf(tenantRow?.slug);
    const b = parseBody(
      getClienteCreateSchema({ allowsClienteCpf }),
      req.body,
    );

    const data = {
      ...tenant(req),
      tipoPessoa: b.tipoPessoa,
      cnpj: b.cnpj,
      cpf: b.cpf,
      razaoSocial: b.razaoSocial,
      nomeFantasia: b.nomeFantasia,
      telefone: b.telefone,
      cidade: b.cidade,
      estado: b.estado,
      endereco: b.endereco,
      observacoes: b.observacoes,
      fretePadrao: b.fretePadraoSaco ?? 0, // legado
      fretePadraoSaco: b.fretePadraoSaco ?? 0,
      fretePadraoTonelada: b.fretePadraoTonelada ?? 0,
      vendedorId: b.vendedorId ?? null,
      comissaoFixaPercentual:
        b.comissaoFixaPercentual === undefined ||
        b.comissaoFixaPercentual === null
          ? null
          : parseFloat(String(b.comissaoFixaPercentual)),
    };

    const docWhere =
      b.tipoPessoa === "PF"
        ? { cpf: b.cpf, ...tenant(req) }
        : { cnpj: b.cnpj, ...tenant(req) };

    const existente = await prisma.cliente.findFirst({
      where: docWhere,
      select: { id: true, ativo: true },
    });

    if (existente?.ativo) {
      return res.status(400).json({
        error: b.tipoPessoa === "PF" ? "CPF já cadastrado" : "CNPJ já cadastrado",
      });
    }

    if (existente && !existente.ativo) {
      const reativado = await prisma.cliente.update({
        where: { id: existente.id },
        data: { ...data, ativo: true },
        include: { vendedor: true },
      });
      return res.status(200).json(reativado);
    }

    const cliente = await prisma.cliente.create({
      data,
      include: { vendedor: true },
    });
    res.status(201).json(cliente);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({ error: "Documento já cadastrado" });
    }
    handleRouteError(res, error);
  }
});

// PUT /api/clientes/:id - atualizar cliente
router.put("/:id", async (req, res) => {
  try {
    const b = parseBody(clienteUpdateSchema, req.body);
    const id = parseInt(req.params.id);
    const atual = await prisma.cliente.findFirst({
      where: { id, ...tenant(req) },
      select: { id: true },
    });
    if (!atual) return res.status(404).json({ error: "Cliente não encontrado" });

    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        razaoSocial: b.razaoSocial,
        nomeFantasia: b.nomeFantasia,
        telefone: b.telefone,
        cidade: b.cidade,
        estado: b.estado,
        endereco: b.endereco,
        observacoes: b.observacoes,
        fretePadrao: b.fretePadraoSaco, // legado
        fretePadraoSaco: b.fretePadraoSaco,
        fretePadraoTonelada: b.fretePadraoTonelada,
        ativo: b.ativo,
        vendedorId:
          b.vendedorId === undefined
            ? undefined
            : b.vendedorId === null
              ? null
              : b.vendedorId,
        comissaoFixaPercentual:
          b.comissaoFixaPercentual === undefined
            ? undefined
            : b.comissaoFixaPercentual === null
              ? null
              : parseFloat(String(b.comissaoFixaPercentual)),
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
    const cli = await prisma.cliente.findFirst({
      where: { id: clienteId, ...tenant(req) },
      select: { id: true },
    });
    if (!cli) return res.status(404).json({ error: "Cliente não encontrado" });

    const { precos } = parseBody(clientePrecosSchema, req.body);
    for (const p of precos) {
      if (p.preco === null || p.preco === "") {
        await prisma.precoClienteProduto.deleteMany({
          where: { tenantId: req.tenantId, clienteId, produtoId: p.produtoId },
        });
      } else {
        await prisma.precoClienteProduto.upsert({
          where: { clienteId_produtoId: { clienteId, produtoId: p.produtoId } },
          update: { preco: p.preco, tenantId: req.tenantId },
          create: {
            tenantId: req.tenantId,
            clienteId,
            produtoId: p.produtoId,
            preco: p.preco,
          },
        });
      }
    }
    res.json({ success: true });
  } catch (error) {
    handleRouteError(res, error);
  }
});

// PUT /api/clientes/:id/comissoes - comissão específica por produto
router.put("/:id/comissoes", async (req, res) => {
  try {
    const clienteId = parseInt(req.params.id);
    const cli = await prisma.cliente.findFirst({
      where: { id: clienteId, ...tenant(req) },
      select: { id: true },
    });
    if (!cli) return res.status(404).json({ error: "Cliente não encontrado" });

    const { comissoes } = parseBody(clienteComissoesSchema, req.body);
    for (const c of comissoes) {
      if (c.comissaoPercentual === null || c.comissaoPercentual === "") {
        await prisma.comissaoClienteProduto.deleteMany({
          where: { tenantId: req.tenantId, clienteId, produtoId: c.produtoId },
        });
      } else {
        await prisma.comissaoClienteProduto.upsert({
          where: {
            clienteId_produtoId: { clienteId, produtoId: c.produtoId },
          },
          update: { comissaoPercentual: c.comissaoPercentual, tenantId: req.tenantId },
          create: {
            tenantId: req.tenantId,
            clienteId,
            produtoId: c.produtoId,
            comissaoPercentual: c.comissaoPercentual,
          },
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
    const id = parseInt(req.params.id);
    const atual = await prisma.cliente.findFirst({
      where: { id, ...tenant(req) },
      select: { id: true },
    });
    if (!atual) return res.status(404).json({ error: "Cliente não encontrado" });

    await prisma.cliente.update({
      where: { id },
      data: { ativo: false },
    });
    res.json({ success: true });
  } catch (error) {
    handleRouteError(res, error);
  }
});

module.exports = router;
