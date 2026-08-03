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
const { vendaFretePatchSchema, vendaPutSchema, vendaPostSchema } = require("../schemas/venda");
const { registrarAuditoria } = require("../services/financeiroEventos");
const {
  syncClienteFromVenda,
  parseAtualizarCliente,
} = require("../services/syncClienteFromVenda");
const {
  calcularComissaoParaVenda,
  loadComissaoMapPorCliente,
} = require("../services/comissaoCadastro");
const { criarVenda } = require("../application/use-cases/criarVenda");
const { requestAllowsFrete } = require("../utils/tenantRequest");
const {
  upsertFreteMovimentoFromVenda,
} = require("../services/syncFreteMovimentoVenda");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../utils/api");
const { getDateRange } = require("../utils/dateRangeQuery");
const {
  calcularFreteAutomatico,
} = require("../domain/frete/calcularFrete");

function tw(req) {
  return { tenantId: req.tenantId };
}

function calcSaldoEmAbertoTitulos(venda) {
  let saldo = 0;
  for (const t of venda.titulos || []) {
    const vo = parseFloat(String(t.valorOriginal ?? 0));
    const vp = parseFloat(String(t.valorPago ?? 0));
    if (!Number.isNaN(vo) && !Number.isNaN(vp)) {
      saldo += Math.max(0, vo - vp);
    }
  }
  return saldo;
}

function parseOrdemNumero(raw) {
  const s = String(raw ?? "")
    .trim()
    .replace(/^#/, "");
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return { n, exact: String(n) === s };
}

function wherePorOrdem(ordemRaw, tenantId) {
  const parsed = parseOrdemNumero(ordemRaw);
  if (!parsed) return null;
  const or = [{ numeroVenda: parsed.n }];
  if (parsed.exact) or.push({ id: parsed.n });
  return { tenantId, OR: or };
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
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
      ordem,
    } = req.query;
    const { take, skip } = parsePagination(req.query, {
      defaultTake: 100,
      maxTake: 500,
    });
    const where = { ...tw(req), cliente: { tenantId: req.tenantId } };
    if (clienteId) where.clienteId = parseInt(clienteId, 10);
    if (vendedorId) where.vendedorId = parseInt(vendedorId, 10);
    if (motoristaId !== undefined && motoristaId !== "") {
      const mid = parseInt(motoristaId, 10);
      if (!Number.isNaN(mid)) where.motoristaId = mid;
    }
    if (dataInicio || dataFim) {
      const dr = getDateRange(dataInicio, dataFim);
      if (Object.keys(dr).length) where.dataVenda = dr;
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
    if (ordem) {
      const ordemWhere = wherePorOrdem(ordem, req.tenantId);
      if (ordemWhere) {
        Object.assign(where, ordemWhere);
      }
    }
    if (busca) {
      const buscaTrim = String(busca).trim();
      // Digitar só "#7" ou "7" na busca geral também filtra pela ordem
      if (/^#?\d+$/.test(buscaTrim) && !ordem) {
        const ordemWhere = wherePorOrdem(buscaTrim, req.tenantId);
        if (ordemWhere) {
          Object.assign(where, ordemWhere);
        }
      } else {
        where.cliente = {
          tenantId: req.tenantId,
          OR: [
            { razaoSocial: { contains: buscaTrim, mode: "insensitive" } },
            { nomeFantasia: { contains: buscaTrim, mode: "insensitive" } },
            { cnpj: { contains: buscaTrim } },
            { telefone: { contains: buscaTrim } },
            { cidade: { contains: buscaTrim, mode: "insensitive" } },
          ],
        };
      }
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
        orderBy: [
          { dataVenda: "desc" },
          { numeroVenda: "desc" },
          { id: "desc" },
        ],
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
    res.set("X-Tenant-Id", String(req.tenantId));
    const comSaldo = vendas.map((v) => ({
      ...v,
      saldoEmAbertoTitulos: calcSaldoEmAbertoTitulos(v),
    }));
    res.json(comSaldo);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// GET /api/vendas/por-ordem/:numero — busca venda pelo nº da ordem (#278 ou 278)
router.get("/por-ordem/:numero", async (req, res) => {
  try {
    const ordemWhere = wherePorOrdem(req.params.numero, req.tenantId);
    if (!ordemWhere) {
      return res.status(400).json({ error: "Número da ordem inválido" });
    }
    const venda = await prisma.venda.findFirst({
      where: ordemWhere,
      include: {
        cliente: true,
        vendedor: true,
        titulos: true,
        pagamentos: { select: { valor: true } },
      },
      orderBy: { dataVenda: "desc" },
    });
    if (!venda) {
      return res.status(404).json({ error: "Venda não encontrada para esta ordem" });
    }
    res.json({
      ...venda,
      saldoEmAbertoTitulos: calcSaldoEmAbertoTitulos(venda),
    });
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
        pagamentos: {
          orderBy: { data: "desc" },
          include: {
            cheque: {
              select: { id: true, numeroOrdem: true, banco: true, numero: true, valor: true },
            },
          },
        },
        titulos: { orderBy: { vencimento: "asc" } },
        fretes: { orderBy: { data: "desc" } },
        cheques: {
          select: {
            id: true,
            numeroOrdem: true,
            banco: true,
            numero: true,
            valor: true,
          },
        },
      },
    });
    if (!venda) return res.status(404).json({ error: "Venda não encontrada" });
    const tituloComPagamento = (venda.titulos || []).some(
      (t) => parseFloat(String(t.valorPago ?? 0)) > 0,
    );
    const podeEditar =
      venda.pagamentos.length === 0 &&
      venda.cheques.length === 0 &&
      !tituloComPagamento;
    res.json({
      ...venda,
      podeEditar,
      saldoEmAbertoTitulos: calcSaldoEmAbertoTitulos(venda),
    });
  } catch (error) {
    handleRouteError(res, error);
  }
});

function dataFreteReciboParaPrisma(v) {
  if (v === undefined) return undefined;
  if (v == null || v === "") return null;
  try {
    return parseDateField(v, "freteReciboData");
  } catch {
    return null;
  }
}

// PATCH /api/vendas/:id — frete / recibo (sincroniza com primeiro FreteMovimento)
router.patch("/:id", async (req, res) => {
  try {
    if (!(await requestAllowsFrete(req))) {
      return res.status(403).json({ error: "Frete não disponível para esta organização" });
    }
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

      const freteValor =
        b.frete !== undefined ? parseFloat(String(b.frete)) : parseFloat(String(v.frete));
      const freteReciboVal =
        b.freteRecibo !== undefined ? !!b.freteRecibo : !!v.freteRecibo;
      const freteReciboNumVal =
        b.freteReciboNum !== undefined ? b.freteReciboNum || null : v.freteReciboNum;
      const freteReciboDataVal =
        b.freteReciboData !== undefined
          ? dataFreteReciboParaPrisma(b.freteReciboData)
          : undefined;

      await upsertFreteMovimentoFromVenda(tx, {
        tenantId,
        vendaId: id,
        clienteId: v.clienteId,
        freteValor,
        freteRecibo: freteReciboVal,
        freteReciboNum: freteReciboNumVal,
        freteReciboData: freteReciboDataVal,
        dataVenda: v.dataVenda,
        observacaoPrefix: "Frete venda",
      });

      await registrarAuditoria(tx, req, {
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
    const body = parseBody(vendaPostSchema, req.body);
    const freteEnabled = await requestAllowsFrete(req);

    const vendaCompleta = await criarVenda(prisma, {
      tenantId: req.tenantId,
      clienteId: body.clienteId,
      vendedorId: body.vendedorId,
      motoristaId: body.motoristaId ?? null,
      fretePorSaco: body.fretePorSaco ?? null,
      fretePorTonelada: body.fretePorTonelada ?? null,
      freteRecibo: body.freteRecibo,
      freteReciboNum: body.freteReciboNum,
      freteReciboData: body.freteReciboData,
      dataVenda: body.dataVenda,
      observacoes: body.observacoes,
      itens: body.itens,
      freteEnabled,
      atualizarClienteBody: body.atualizarCliente ?? null,
      req,
    });

    res.status(201).json(vendaCompleta);
  } catch (error) {
    handleRouteError(res, error);
  }
});

// PUT /api/vendas/:id — editar venda (sem pagamentos nem cheques vinculados)
router.put("/:id", async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const id = parseIntField(req.params.id, "id", { min: 1 });
    const body = parseBody(vendaPutSchema, req.body);

    const existente = await prisma.venda.findFirst({
      where: { id, ...tw(req) },
      include: {
        pagamentos: true,
        cheques: { select: { id: true } },
        titulos: true,
        itens: true,
      },
    });
    if (!existente) return res.status(404).json({ error: "Venda não encontrada" });

    if (existente.pagamentos.length > 0) {
      return res.status(400).json({
        error:
          "Venda com baixas registradas não pode ser editada. Estorne as baixas primeiro.",
      });
    }
    if (existente.cheques.length > 0) {
      return res.status(400).json({
        error:
          "Venda com cheques vinculados não pode ser editada. Ajuste os cheques primeiro.",
      });
    }

    const clienteIdNum = body.clienteId;
    const vendedorIdNum = body.vendedorId;
    const motoristaIdNum = body.motoristaId ?? null;
    const fretePorSacoNum = body.fretePorSaco ?? null;
    const fretePorTonNum = body.fretePorTonelada ?? null;
    const dataVendaDate = body.dataVenda
      ? parseDateField(body.dataVenda, "dataVenda")
      : existente.dataVenda;
    const itensValidos = body.itens.map((item) => ({
      produtoId: item.produtoId,
      quantidade: item.quantidade,
      precoUnitario: item.precoUnitario,
    }));

    const valorTotal = itensValidos.reduce(
      (acc, item) => acc + item.quantidade * item.precoUnitario,
      0,
    );

    const produtoIds = [...new Set(itensValidos.map((i) => i.produtoId))];
    const produtos = await prisma.produto.findMany({
      where: { tenantId, id: { in: produtoIds } },
      select: { id: true, unidade: true, pesoKg: true },
    });
    const produtosPorId = new Map(produtos.map((p) => [p.id, p]));
    for (const item of itensValidos) {
      if (!produtosPorId.has(item.produtoId)) {
        return res
          .status(400)
          .json({ error: `Produto ID ${item.produtoId} não encontrado` });
      }
    }

    const snapshotAntes = {
      clienteId: existente.clienteId,
      vendedorId: existente.vendedorId,
      motoristaId: existente.motoristaId,
      valorTotal: parseFloat(String(existente.valorTotal)),
      dataVenda: existente.dataVenda,
      itens: existente.itens.length,
    };

    const freteEnabled = await requestAllowsFrete(req);

    await prisma.$transaction(async (tx) => {
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

      const comissaoMap = await loadComissaoMapPorCliente(tx, clienteIdNum, tenantId);
      const {
        comissaoValor,
        comissaoPercentualAplicado,
        itensComComissao,
      } = calcularComissaoParaVenda({
        itens: itensValidos,
        cliente,
        vendedor,
        comissaoPorProdutoMap: comissaoMap,
      });
      const dataEfetivaVenda = dataVendaDate || existente.dataVenda;

      const fretePorSacoAplicado = freteEnabled
        ? fretePorSacoNum != null
          ? fretePorSacoNum
          : parseFloat(String(cliente.fretePadraoSaco ?? cliente.fretePadrao ?? 0))
        : 0;
      const fretePorTonAplicado = freteEnabled
        ? fretePorTonNum != null
          ? fretePorTonNum
          : parseFloat(String(cliente.fretePadraoTonelada ?? 0))
        : 0;
      const freteFinal = freteEnabled
        ? calcularFreteAutomatico(
            itensValidos,
            produtosPorId,
            fretePorSacoAplicado,
            fretePorTonAplicado,
          )
        : 0;
      const freteReciboBody =
        body.freteRecibo !== undefined ? !!body.freteRecibo : existente.freteRecibo;
      const freteReciboAplicado = freteEnabled && freteReciboBody;
      const freteReciboNum = freteEnabled
        ? body.freteReciboNum !== undefined
          ? body.freteReciboNum || null
          : existente.freteReciboNum
        : null;

      await tx.itemVenda.deleteMany({ where: { vendaId: id } });
      await tx.movimentacaoEstoque.deleteMany({
        where: { vendaId: id, tenantId },
      });

      const vendaAtualizada = await tx.venda.update({
        where: { id },
        data: {
          clienteId: clienteIdNum,
          vendedorId: vendedorIdNum,
          motoristaId: motoristaIdNum,
          frete: freteFinal,
          freteTarifaSaco: fretePorSacoAplicado,
          freteTarifaTonelada: fretePorTonAplicado,
          freteRecibo: freteReciboAplicado,
          freteReciboNum,
          comissaoPercentualAplicado,
          comissaoValor,
          valorTotal,
          dataVenda: dataEfetivaVenda,
          observacoes:
            body.observacoes !== undefined
              ? body.observacoes
              : existente.observacoes,
          itens: {
            create: itensComComissao.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
              precoUnitario: item.precoUnitario,
              subtotal: item.subtotal,
              comissaoPercentualAplicado: item.comissaoPercentualAplicado,
              comissaoValor: item.comissaoValor,
            })),
          },
        },
      });

      const numeroVenda = existente.numeroVenda;
      for (const item of itensValidos) {
        await tx.movimentacaoEstoque.create({
          data: {
            tenantId,
            produtoId: item.produtoId,
            tipo: "saida",
            quantidade: item.quantidade,
            vendaId: id,
            observacao: `Venda #${numeroVenda} (edição)`,
          },
        });
      }

      for (const titulo of existente.titulos) {
        const vp = parseFloat(String(titulo.valorPago ?? 0));
        if (vp > 0) {
          throw new Error(
            "Título com pagamento parcial impede edição da venda",
          );
        }
        await tx.tituloReceber.update({
          where: { id: titulo.id },
          data: {
            clienteId: clienteIdNum,
            valorOriginal: valorTotal,
            vencimento: addDays(dataEfetivaVenda, 30),
          },
        });
      }

      const rd =
        body.freteReciboData !== undefined
          ? body.freteReciboData != null && String(body.freteReciboData).trim() !== ""
            ? parseDateField(body.freteReciboData, "freteReciboData")
            : null
          : undefined;

      await upsertFreteMovimentoFromVenda(tx, {
        tenantId,
        vendaId: id,
        clienteId: clienteIdNum,
        freteValor: freteFinal,
        freteRecibo: freteReciboAplicado,
        freteReciboNum: freteReciboNum,
        freteReciboData: rd,
        dataVenda: dataEfetivaVenda,
        numeroVenda,
      });

      await registrarAuditoria(tx, req, {
        tenantId,
        tipo: "VENDA_ATUALIZADA",
        entidade: "Venda",
        entidadeId: id,
        clienteId: clienteIdNum,
        vendaId: id,
        valor: valorTotal,
        payload: {
          antes: snapshotAntes,
          depois: {
            clienteId: clienteIdNum,
            vendedorId: vendedorIdNum,
            motoristaId: motoristaIdNum,
            valorTotal,
            dataVenda: dataEfetivaVenda,
            itens: itensValidos.length,
          },
        },
      });

      const atualizarCliente = parseAtualizarCliente({
        atualizarCliente: body.atualizarCliente,
      });
      if (atualizarCliente) {
        if (!freteEnabled) {
          delete atualizarCliente.fretePadraoSaco;
          delete atualizarCliente.fretePadraoTonelada;
        }
        await syncClienteFromVenda(tx, {
          tenantId: req.tenantId,
          clienteId: clienteIdNum,
          ...atualizarCliente,
        });
      }

      return vendaAtualizada;
    });

    const vendaCompleta = await prisma.venda.findFirst({
      where: { id, ...tw(req) },
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
    res.json(vendaCompleta);
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
      await registrarAuditoria(tx, req, {
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
