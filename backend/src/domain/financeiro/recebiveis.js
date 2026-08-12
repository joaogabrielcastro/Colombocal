const {
  limparTrocosInjustificadosDoCliente,
} = require("./limparTrocosOrfaos");

const EPS = 0.009;

/** Observação padrão ao pagar frete avulso pela tela do cliente / fretes. */
const RE_PAGAMENTO_FRETE_AVULSO = /Pagamento de frete avulso #(\d+)/i;

function parseFreteAvulsoIdFromObs(observacoes) {
  const m = String(observacoes || "").match(RE_PAGAMENTO_FRETE_AVULSO);
  if (!m) return null;
  const id = parseInt(m[1], 10);
  return Number.isFinite(id) ? id : null;
}

function numerosTituloFreteAvulso(freteId) {
  return [`FRETE-AVULSO-${freteId}`, `VALE-FRETE-${freteId}`];
}

async function baixarEmTitulo(tx, titulo, restante) {
  if (restante <= EPS) return restante;
  const valorOriginal = parseFloat(titulo.valorOriginal);
  const valorPagoAtual = parseFloat(titulo.valorPago);
  const saldoTitulo = Math.max(0, valorOriginal - valorPagoAtual);
  if (saldoTitulo <= EPS) return restante;

  const baixa = Math.min(saldoTitulo, restante);
  const novoPago = valorPagoAtual + baixa;
  const novoSaldo = valorOriginal - novoPago;

  await tx.tituloReceber.update({
    where: { id: titulo.id },
    data: {
      valorPago: novoPago,
      status: novoSaldo <= EPS ? "quitado" : "parcial",
    },
  });
  return restante - baixa;
}

/**
 * Aplica valor nos títulos em aberto.
 * Com vendaId: só nos títulos dessa venda (excedente vira troco físico, não quita outras ordens).
 * Pagamento de frete avulso (#N): só no título FRETE-AVULSO-N (não baixa venda).
 * Sem vendaId (avulso genérico): nos títulos abertos do cliente por vencimento.
 */
async function aplicarPagamentoNosTitulos(tx, { clienteId, vendaId, valor, observacoes }) {
  let restante = parseFloat(valor);
  if (restante <= EPS) return;

  const freteId = parseFreteAvulsoIdFromObs(observacoes);
  if (freteId != null) {
    const titulosFrete = await tx.tituloReceber.findMany({
      where: {
        clienteId,
        numero: { in: numerosTituloFreteAvulso(freteId) },
        status: { in: ["aberto", "parcial"] },
      },
      orderBy: [{ vencimento: "asc" }, { id: "asc" }],
    });
    for (const t of titulosFrete) {
      restante = await baixarEmTitulo(tx, t, restante);
      if (restante <= EPS) return;
    }
    // Sem título do frete (já pago/excluído): não vaza para venda.
    return;
  }

  if (vendaId) {
    const titulosDaVenda = await tx.tituloReceber.findMany({
      where: { clienteId, vendaId, status: { in: ["aberto", "parcial"] } },
      orderBy: [{ vencimento: "asc" }, { id: "asc" }],
    });
    for (const t of titulosDaVenda) {
      restante = await baixarEmTitulo(tx, t, restante);
      if (restante <= EPS) return;
    }
    // Excedente desta ordem não abate títulos de outras vendas.
    return;
  }

  const titulosDemais = await tx.tituloReceber.findMany({
    where: {
      clienteId,
      status: { in: ["aberto", "parcial"] },
    },
    orderBy: [{ vencimento: "asc" }, { id: "asc" }],
  });
  for (const t of titulosDemais) {
    restante = await baixarEmTitulo(tx, t, restante);
    if (restante <= EPS) return;
  }
}

function getWhereByClienteVenda(clienteId, vendaId) {
  return vendaId ? { clienteId, vendaId } : { clienteId };
}

/**
 * Remove títulos FRETE-AVULSO/VALE-FRETE de fretes já marcados como pagos.
 * Corrige legado em que o pagamento do frete baixou a venda e o título do frete ficou órfão.
 */
async function limparTitulosFreteAvulsoJaPagos(tx, clienteId) {
  const fretesPagos = await tx.freteMovimento.findMany({
    where: { clienteId, vendaId: null, reciboEmitido: true },
    select: { id: true },
  });
  if (fretesPagos.length === 0) return { deleted: 0 };
  const numeros = fretesPagos.flatMap((f) => numerosTituloFreteAvulso(f.id));
  const del = await tx.tituloReceber.deleteMany({
    where: { clienteId, numero: { in: numeros } },
  });
  return { deleted: del.count };
}

/**
 * Zera baixas nos títulos e reaplica todos os pagamentos do cliente (ordem data + id).
 * Cada pagamento com vendaId só baixa títulos dessa venda.
 * Pagamento de frete avulso só baixa o título do frete.
 * Fretes avulsos já pagos: títulos órfãos são removidos (não voltam a aparecer em aberto).
 */
async function recalcularTodosTitulosCliente(tx, clienteId) {
  // 1) Tira título de frete já pago — senão o pagamento “avulso” antigo baixa a venda de novo.
  await limparTitulosFreteAvulsoJaPagos(tx, clienteId);

  const titulos = await tx.tituloReceber.findMany({ where: { clienteId } });
  for (const t of titulos) {
    await tx.tituloReceber.update({
      where: { id: t.id },
      data: { valorPago: 0, status: "aberto" },
    });
  }
  const pagamentos = await tx.pagamento.findMany({
    where: { clienteId },
    orderBy: [{ data: "asc" }, { id: "asc" }],
  });
  for (const p of pagamentos) {
    await aplicarPagamentoNosTitulos(tx, {
      clienteId: p.clienteId,
      vendaId: p.vendaId,
      valor: parseFloat(p.valor),
      observacoes: p.observacoes,
    });
  }

  // Trocos sem pagamento a maior correspondente (legado / estorno incompleto).
  await limparTrocosInjustificadosDoCliente(tx, clienteId);
}

/** @deprecated Preferir recalcularTodosTitulosCliente; mantido por compatibilidade de assinatura */
async function recalcularTitulos(tx, { clienteId, vendaId }) {
  void vendaId;
  await recalcularTodosTitulosCliente(tx, clienteId);
}

module.exports = {
  EPS,
  RE_PAGAMENTO_FRETE_AVULSO,
  parseFreteAvulsoIdFromObs,
  numerosTituloFreteAvulso,
  limparTitulosFreteAvulsoJaPagos,
  aplicarPagamentoNosTitulos,
  recalcularTitulos,
  recalcularTodosTitulosCliente,
  getWhereByClienteVenda,
};
