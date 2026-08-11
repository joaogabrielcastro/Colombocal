const EPS = 0.009;

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
 * Sem vendaId: nos títulos abertos do cliente por vencimento (pagamento avulso).
 */
async function aplicarPagamentoNosTitulos(tx, { clienteId, vendaId, valor }) {
  let restante = parseFloat(valor);
  if (restante <= EPS) return;

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
 * Zera baixas nos títulos e reaplica todos os pagamentos do cliente (ordem data + id).
 * Cada pagamento com vendaId só baixa títulos dessa venda.
 */
async function recalcularTodosTitulosCliente(tx, clienteId) {
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
    });
  }
}

/** @deprecated Preferir recalcularTodosTitulosCliente; mantido por compatibilidade de assinatura */
async function recalcularTitulos(tx, { clienteId, vendaId }) {
  void vendaId;
  await recalcularTodosTitulosCliente(tx, clienteId);
}

module.exports = {
  EPS,
  aplicarPagamentoNosTitulos,
  recalcularTitulos,
  recalcularTodosTitulosCliente,
  getWhereByClienteVenda,
};
