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
const { parseDateField, addDaysCalendar } = require("../../utils/validation");
const {
  calcularFreteAutomatico,
} = require("../../domain/frete/calcularFrete");
const { tenantFretePagoDefault } = require("../../constants/tenantFeatures");

function addDays(date, days) {
  return addDaysCalendar(date, days);
}

/** Classe de advisory lock só para numeração de venda (não colide com outros locks da app). */
const LOCK_NUMERO_VENDA = 872351;
const MAX_NUMERO_TENTATIVAS = 8;

function isNumeroVendaConflict(error) {
  if (error?.code !== "P2002") return false;
  const target = error.meta?.target;
  if (target === "numeroVenda") return true;
  if (Array.isArray(target) && target.includes("numeroVenda")) return true;
  if (typeof target === "string" && target.includes("numeroVenda")) return true;
  return false;
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

  let venda;
  for (let attempt = 0; attempt < MAX_NUMERO_TENTATIVAS; attempt++) {
    try {
      venda = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(
            "SELECT pg_advisory_xact_lock($1::int, $2::int)",
            LOCK_NUMERO_VENDA,
            Number(tenantId),
          );
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
    const tenantRow = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true },
    });
    const fretePagoDefault = tenantFretePagoDefault(tenantRow?.slug);
    const freteReciboAplicado =
      freteEnabled && (fretePagoDefault || !!freteRecibo);
    const freteReciboDataAplicado = freteReciboAplicado
      ? freteReciboData
        ? parseDateField(freteReciboData, "freteReciboData")
        : dataEfetivaVenda
      : null;

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

    // SSOT de cobrança: título = conta a receber da venda (produtos / valorTotal).
    // Frete da venda NÃO entra no título — fica só em Venda.frete / FreteMovimento.
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
        freteReciboData: freteReciboDataAplicado,
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
        },
        { timeout: 20000, maxWait: 20000 },
      );
      break;
    } catch (error) {
      if (isNumeroVendaConflict(error) && attempt < MAX_NUMERO_TENTATIVAS - 1) {
        continue;
      }
      throw error;
    }
  }

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
  isNumeroVendaConflict,
};
