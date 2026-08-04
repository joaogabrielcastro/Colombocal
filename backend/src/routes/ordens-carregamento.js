const express = require("express");
const router = express.Router();
const { prisma } = require("../lib/prisma");
const {
  parseIntField,
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");
const { quantidadeEmSacos } = require("../domain/frete/calcularFrete");

function tw(req) {
  return { tenantId: req.tenantId };
}

function toNum(v) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function strOrNull(v) {
  const s = String(v ?? "").trim();
  return s || null;
}

function normalizarItens(itensRaw) {
  if (!Array.isArray(itensRaw) || itensRaw.length === 0) {
    const err = new Error("Informe ao menos um item");
    err.status = 400;
    throw err;
  }
  const itens = [];
  for (const raw of itensRaw) {
    const descricao = String(raw?.descricao ?? "").trim();
    const quantidade = toNum(raw?.quantidade);
    const unidade = String(raw?.unidade || "SAC").trim().toUpperCase() || "SAC";
    if (!descricao || !(quantidade > 0)) {
      const err = new Error("Cada item precisa de descrição e quantidade > 0");
      err.status = 400;
      throw err;
    }
    itens.push({ descricao, quantidade, unidade });
  }
  return itens;
}

// GET /api/ordens-carregamento
router.get("/", async (req, res) => {
  try {
    const { cliente, pedido, numeroOc, dataInicio, dataFim } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 50,
      maxTake: 200,
    });
    const where = { ...tw(req) };
    if (cliente && String(cliente).trim()) {
      const term = String(cliente).trim();
      where.clienteNome = { contains: term, mode: "insensitive" };
    }
    if (pedido && String(pedido).trim()) {
      where.pedido = { contains: String(pedido).trim(), mode: "insensitive" };
    }
    if (numeroOc != null && String(numeroOc).trim()) {
      const n = parseInt(String(numeroOc).replace(/\D/g, ""), 10);
      if (Number.isFinite(n) && n > 0) where.numeroOc = n;
    }
    if (dataInicio || dataFim) {
      where.dataEmissao = {};
      if (dataInicio) where.dataEmissao.gte = new Date(dataInicio);
      if (dataFim) {
        const f = new Date(dataFim);
        f.setHours(23, 59, 59, 999);
        where.dataEmissao.lte = f;
      }
    }
    const [rows, total] = await Promise.all([
      prisma.ordemCarregamento.findMany({
        where,
        include: { itens: true },
        orderBy: [{ dataEmissao: "desc" }, { numeroOc: "desc" }],
        take,
        skip,
      }),
      prisma.ordemCarregamento.count({ where }),
    ]);
    setPaginationHeaders(res, { total, take, skip });
    res.json(rows);
  } catch (e) {
    handleRouteError(res, e);
  }
});

// GET /api/ordens-carregamento/:id
router.get("/:id", async (req, res) => {
  try {
    const id = parseIntField(req.params.id, "id", { min: 1 });
    const ordem = await prisma.ordemCarregamento.findFirst({
      where: { id, ...tw(req) },
      include: { itens: true },
    });
    if (!ordem) return res.status(404).json({ error: "Ordem não encontrada" });
    res.json(ordem);
  } catch (e) {
    handleRouteError(res, e);
  }
});

// POST /api/ordens-carregamento
router.post("/", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const body = req.body || {};
    let itens = Array.isArray(body.itens) ? body.itens : null;
    let clienteNome = strOrNull(body.clienteNome);
    let clienteEndereco = strOrNull(body.clienteEndereco);
    let clienteCidade = strOrNull(body.clienteCidade);
    let clienteUf = strOrNull(body.clienteUf);
    let clienteId = body.clienteId != null ? parseInt(body.clienteId, 10) : null;
    let motoristaNome = strOrNull(body.motoristaNome);
    let motoristaPlaca = strOrNull(body.motoristaPlaca);
    let motoristaCidade = strOrNull(body.motoristaCidade);
    let motoristaUf = strOrNull(body.motoristaUf);
    let motoristaId =
      body.motoristaId != null ? parseInt(body.motoristaId, 10) : null;
    let vendaId = body.vendaId != null ? parseInt(body.vendaId, 10) : null;
    let pedido = strOrNull(body.pedido);
    const doct = strOrNull(body.doct);
    const observacoes = strOrNull(body.observacoes);
    const dataEmissao = body.dataEmissao
      ? new Date(body.dataEmissao)
      : new Date();

    // Opcional: preencher a partir de uma venda (sem gerar financeiro)
    if (Number.isFinite(vendaId) && vendaId > 0) {
      const venda = await prisma.venda.findFirst({
        where: { id: vendaId, tenantId },
        include: {
          cliente: true,
          motorista: true,
          itens: { include: { produto: true } },
        },
      });
      if (!venda) {
        return res.status(404).json({ error: "Venda não encontrada" });
      }
      if (!clienteNome) {
        clienteNome =
          venda.cliente.nomeFantasia?.trim() || venda.cliente.razaoSocial;
        clienteId = venda.clienteId;
        clienteEndereco = clienteEndereco || venda.cliente.endereco || null;
        clienteCidade = clienteCidade || venda.cliente.cidade || null;
        clienteUf = clienteUf || venda.cliente.estado || null;
      }
      if (!motoristaNome && venda.motorista) {
        motoristaNome = venda.motorista.nome;
        motoristaId = venda.motoristaId;
        motoristaPlaca = motoristaPlaca || venda.motorista.placa || null;
      }
      if (!pedido) {
        pedido = String(venda.numeroVenda ?? venda.id).padStart(6, "0");
      }
      if (!itens || itens.length === 0) {
        itens = venda.itens.map((it) => {
          const sacos = quantidadeEmSacos({
            produto: it.produto,
            quantidade: it.quantidade,
          });
          return {
            descricao: it.produto.nome,
            quantidade: sacos,
            unidade: "SAC",
          };
        });
      }
    }

    if (!clienteNome) {
      return res.status(400).json({ error: "Informe o nome do cliente" });
    }
    const itensNorm = normalizarItens(itens);

    if (Number.isFinite(clienteId) && clienteId > 0) {
      const c = await prisma.cliente.findFirst({
        where: { id: clienteId, tenantId },
      });
      if (!c) return res.status(404).json({ error: "Cliente não encontrado" });
    } else {
      clienteId = null;
    }

    if (Number.isFinite(motoristaId) && motoristaId > 0) {
      const m = await prisma.motorista.findFirst({
        where: { id: motoristaId, tenantId },
      });
      if (!m) return res.status(404).json({ error: "Motorista não encontrado" });
      if (!motoristaNome) motoristaNome = m.nome;
      if (!motoristaPlaca) motoristaPlaca = m.placa || null;
    } else {
      motoristaId = null;
    }

    if (!(Number.isFinite(vendaId) && vendaId > 0)) vendaId = null;

    const ordem = await prisma.$transaction(async (tx) => {
      const ultima = await tx.ordemCarregamento.findFirst({
        where: { tenantId },
        orderBy: { numeroOc: "desc" },
        select: { numeroOc: true },
      });
      const numeroOc = (ultima?.numeroOc ?? 0) + 1;
      return tx.ordemCarregamento.create({
        data: {
          tenantId,
          numeroOc,
          dataEmissao,
          doct,
          pedido,
          vendaId,
          clienteId,
          clienteNome,
          clienteEndereco,
          clienteCidade,
          clienteUf,
          motoristaId,
          motoristaNome,
          motoristaPlaca,
          motoristaCidade,
          motoristaUf,
          observacoes,
          itens: {
            create: itensNorm.map((i) => ({
              descricao: i.descricao,
              quantidade: i.quantidade,
              unidade: i.unidade,
            })),
          },
        },
        include: { itens: true },
      });
    });

    res.status(201).json(ordem);
  } catch (e) {
    handleRouteError(res, e);
  }
});

// PUT /api/ordens-carregamento/:id
router.put("/:id", async (req, res) => {
  try {
    const id = parseIntField(req.params.id, "id", { min: 1 });
    const tenantId = req.tenantId;
    const existing = await prisma.ordemCarregamento.findFirst({
      where: { id, tenantId },
    });
    if (!existing) return res.status(404).json({ error: "Ordem não encontrada" });

    const body = req.body || {};
    const clienteNome = strOrNull(body.clienteNome) || existing.clienteNome;
    const clienteEndereco =
      body.clienteEndereco !== undefined
        ? strOrNull(body.clienteEndereco)
        : existing.clienteEndereco;
    const clienteCidade =
      body.clienteCidade !== undefined
        ? strOrNull(body.clienteCidade)
        : existing.clienteCidade;
    const clienteUf =
      body.clienteUf !== undefined ? strOrNull(body.clienteUf) : existing.clienteUf;
    let clienteId =
      body.clienteId != null ? parseInt(body.clienteId, 10) : existing.clienteId;
    let motoristaId =
      body.motoristaId != null
        ? parseInt(body.motoristaId, 10)
        : existing.motoristaId;
    const motoristaNome =
      body.motoristaNome !== undefined
        ? strOrNull(body.motoristaNome)
        : existing.motoristaNome;
    const motoristaPlaca =
      body.motoristaPlaca !== undefined
        ? strOrNull(body.motoristaPlaca)
        : existing.motoristaPlaca;
    const motoristaCidade =
      body.motoristaCidade !== undefined
        ? strOrNull(body.motoristaCidade)
        : existing.motoristaCidade;
    const motoristaUf =
      body.motoristaUf !== undefined
        ? strOrNull(body.motoristaUf)
        : existing.motoristaUf;
    const doct =
      body.doct !== undefined ? strOrNull(body.doct) : existing.doct;
    const pedido =
      body.pedido !== undefined ? strOrNull(body.pedido) : existing.pedido;
    const observacoes =
      body.observacoes !== undefined
        ? strOrNull(body.observacoes)
        : existing.observacoes;
    const dataEmissao = body.dataEmissao
      ? new Date(body.dataEmissao)
      : existing.dataEmissao;

    if (!clienteNome) {
      return res.status(400).json({ error: "Informe o nome do cliente" });
    }

    const itensNorm =
      body.itens !== undefined ? normalizarItens(body.itens) : null;

    if (Number.isFinite(clienteId) && clienteId > 0) {
      const c = await prisma.cliente.findFirst({
        where: { id: clienteId, tenantId },
      });
      if (!c) return res.status(404).json({ error: "Cliente não encontrado" });
    } else {
      clienteId = null;
    }

    if (Number.isFinite(motoristaId) && motoristaId > 0) {
      const m = await prisma.motorista.findFirst({
        where: { id: motoristaId, tenantId },
      });
      if (!m) return res.status(404).json({ error: "Motorista não encontrado" });
    } else {
      motoristaId = null;
    }

    const ordem = await prisma.$transaction(async (tx) => {
      if (itensNorm) {
        await tx.ordemCarregamentoItem.deleteMany({ where: { ordemId: id } });
        await tx.ordemCarregamentoItem.createMany({
          data: itensNorm.map((i) => ({
            ordemId: id,
            descricao: i.descricao,
            quantidade: i.quantidade,
            unidade: i.unidade,
          })),
        });
      }
      return tx.ordemCarregamento.update({
        where: { id },
        data: {
          dataEmissao,
          doct,
          pedido,
          clienteId,
          clienteNome,
          clienteEndereco,
          clienteCidade,
          clienteUf,
          motoristaId,
          motoristaNome,
          motoristaPlaca,
          motoristaCidade,
          motoristaUf,
          observacoes,
        },
        include: { itens: true },
      });
    });

    res.json(ordem);
  } catch (e) {
    handleRouteError(res, e);
  }
});

// DELETE /api/ordens-carregamento/:id
router.delete("/:id", async (req, res) => {
  try {
    const id = parseIntField(req.params.id, "id", { min: 1 });
    const existing = await prisma.ordemCarregamento.findFirst({
      where: { id, ...tw(req) },
    });
    if (!existing) return res.status(404).json({ error: "Ordem não encontrada" });
    await prisma.ordemCarregamento.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    handleRouteError(res, e);
  }
});

module.exports = router;
