const { AppError } = require("../../shared/errors/appError");
const { registrarAuditoria } = require("../../services/financeiroEventos");
const {
  upsertFreteMovimentoFromVenda,
} = require("../../services/syncFreteMovimentoVenda");
const {
  syncClienteFromVenda,
  parseAtualizarCliente,
} = require("../../services/syncClienteFromVenda");
const {
  calcularComissaoParaVenda,
  loadComissaoMapPorCliente,
} = require("../../services/comissaoCadastro");
const { parseDateField } = require("../../utils/validation");
const {
  calcularFreteAutomatico,
} = require("../../domain/frete/calcularFrete");

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Cria venda completa: itens, comissão, título, frete, estoque, auditoria e sync de cliente.
 */
async function criarVenda(prisma, payload) {
  const {
    tenantId,
    clienteId,
    vendedorId,
    motoristaId = null,
    fretePorSaco = null,
    fretePorTonelada = null,
    freteRecibo = false,
    freteReciboNum = null,
    freteReciboData = null,
    dataVenda = null,
    observacoes = null,
    itens,
    freteEnabled = true,
    atualizarClienteBody = null,
    auditActor = null,
    req = null,
  } = payload;

  if (tenantId == null) {
    throw new AppError("tenantId ausente", { code: "TENANT_REQUIRED", httpStatus: 500 });
  }
  if (!Array.isArray(itens) || itens.length < 1) {
    throw new AppError("Informe ao menos um item", { code: "ITENS_REQUIRED", httpStatus: 400 });
  }

  const itensValidos = itens.map((item) => ({
    produtoId: Number(item.produtoId),
    quantidade: Number(item.quantidade),
    precoUnitario: Number(item.precoUnitario),
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
      throw new AppError(`Produto ID ${item.produtoId} não encontrado`, {
        code: "PRODUTO_NAO_ENCONTRADO",
        httpStatus: 400,
      });
    }
  }

  // YYYY-MM-DD / meia-noite UTC → meio-dia UTC (não virar dia anterior no Brasil).
  const dataVendaDate = dataVenda
    ? parseDateField(dataVenda, "dataVenda")
    : null;

  const venda = await prisma.$transaction(async (tx) => {
    const cliente = await tx.cliente.findFirst({
      where: { id: clienteId, tenantId },
    });
    if (!cliente) {
      throw new AppError("Cliente não encontrado", {
        code: "CLIENTE_NAO_ENCONTRADO",
        httpStatus: 404,
      });
    }

    const vendedor = await tx.vendedor.findFirst({
      where: { id: vendedorId, tenantId },
    });
    if (!vendedor) {
      throw new AppError("Vendedor não encontrado", {
        code: "VENDEDOR_NAO_ENCONTRADO",
        httpStatus: 404,
      });
    }

    if (motoristaId != null) {
      const mot = await tx.motorista.findFirst({
        where: { id: motoristaId, tenantId },
      });
      if (!mot) {
        throw new AppError("Motorista não encontrado", {
          code: "MOTORISTA_NAO_ENCONTRADO",
          httpStatus: 404,
        });
      }
    }

    const comissaoMap = await loadComissaoMapPorCliente(tx, clienteId, tenantId);
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

    const dataEfetivaVenda = dataVendaDate || new Date();
    const fretePorSacoAplicado = freteEnabled
      ? fretePorSaco != null
        ? fretePorSaco
        : parseFloat(String(cliente.fretePadraoSaco ?? cliente.fretePadrao ?? 0))
      : 0;
    const fretePorTonAplicado = freteEnabled
      ? fretePorTonelada != null
        ? fretePorTonelada
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
    const freteReciboAplicado = freteEnabled && !!freteRecibo;

    const ultimaNum = await tx.venda.findFirst({
      where: { tenantId },
      orderBy: { numeroVenda: "desc" },
      select: { numeroVenda: true },
    });
    const numeroVenda = (ultimaNum?.numeroVenda ?? 0) + 1;

    const novaVenda = await tx.venda.create({
      data: {
        tenantId,
        numeroVenda,
        clienteId,
        vendedorId,
        motoristaId,
        frete: freteFinal,
        freteTarifaSaco: fretePorSacoAplicado,
        freteTarifaTonelada: fretePorTonAplicado,
        freteRecibo: freteReciboAplicado,
        freteReciboNum: freteReciboAplicado ? freteReciboNum || null : null,
        comissaoPercentualAplicado,
        comissaoValor,
        valorTotal,
        dataVenda: dataEfetivaVenda,
        observacoes,
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
      include: { itens: true },
    });

    await tx.tituloReceber.create({
      data: {
        tenantId,
        clienteId,
        vendaId: novaVenda.id,
        numero: `VENDA-${numeroVenda}`,
        vencimento: addDays(dataEfetivaVenda, 30),
        valorOriginal: valorTotal,
        status: "aberto",
        observacoes: `Titulo gerado automaticamente para venda #${numeroVenda}`,
      },
    });

    if (freteFinal > 0) {
      await upsertFreteMovimentoFromVenda(tx, {
        tenantId,
        vendaId: novaVenda.id,
        clienteId,
        freteValor: freteFinal,
        freteRecibo: freteReciboAplicado,
        freteReciboNum: freteReciboAplicado ? freteReciboNum || null : null,
        freteReciboData: freteReciboData,
        dataVenda: dataEfetivaVenda,
        numeroVenda,
      });
    }

    await registrarAuditoria(tx, req || { authUser: auditActor }, {
      tenantId,
      tipo: "VENDA_CRIADA",
      entidade: "Venda",
      entidadeId: novaVenda.id,
      clienteId,
      vendaId: novaVenda.id,
      valor: valorTotal,
      payload: {
        vendedorId,
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
          observacao: `Venda #${numeroVenda}`,
        },
      });
    }

    const atualizarCliente =
      atualizarClienteBody != null
        ? parseAtualizarCliente({ atualizarCliente: atualizarClienteBody })
        : null;
    if (atualizarCliente) {
      if (!freteEnabled) {
        delete atualizarCliente.fretePadraoSaco;
        delete atualizarCliente.fretePadraoTonelada;
      }
      await syncClienteFromVenda(tx, {
        tenantId,
        clienteId,
        ...atualizarCliente,
      });
    }

    return novaVenda;
  });

  return prisma.venda.findFirst({
    where: { id: venda.id, tenantId },
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
}

module.exports = {
  criarVenda,
  calcularFreteAutomatico,
  addDays,
};
