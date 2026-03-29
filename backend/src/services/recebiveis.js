function getWhereByClienteVenda(clienteId, vendaId) {
  return vendaId ? { clienteId, vendaId } : { clienteId };
}

async function aplicarPagamentoNosTitulos(tx, { clienteId, vendaId, valor }) {
  let restante = parseFloat(valor);
  if (restante <= 0) return;

  const where = vendaId
    ? { clienteId, vendaId, status: { in: ["aberto", "parcial"] } }
    : { clienteId, status: { in: ["aberto", "parcial"] } };

  const titulos = await tx.tituloReceber.findMany({
    where,
    orderBy: [{ vencimento: "asc" }, { id: "asc" }],
  });

  for (const titulo of titulos) {
    if (restante <= 0) break;
    const valorOriginal = parseFloat(titulo.valorOriginal);
    const valorPagoAtual = parseFloat(titulo.valorPago);
    const saldoTitulo = Math.max(0, valorOriginal - valorPagoAtual);
    if (saldoTitulo <= 0) continue;

    const baixa = Math.min(saldoTitulo, restante);
    const novoPago = valorPagoAtual + baixa;
    const novoSaldo = valorOriginal - novoPago;

    await tx.tituloReceber.update({
      where: { id: titulo.id },
      data: {
        valorPago: novoPago,
        status: novoSaldo <= 0.009 ? "quitado" : "parcial",
      },
    });
    restante -= baixa;
  }
}

async function recalcularTitulos(tx, { clienteId, vendaId }) {
  const where = getWhereByClienteVenda(clienteId, vendaId);
  const titulos = await tx.tituloReceber.findMany({ where });
  for (const t of titulos) {
    await tx.tituloReceber.update({
      where: { id: t.id },
      data: { valorPago: 0, status: "aberto" },
    });
  }

  const pagamentosRestantes = await tx.pagamento.findMany({
    where,
    orderBy: { data: "asc" },
  });
  for (const p of pagamentosRestantes) {
    await aplicarPagamentoNosTitulos(tx, {
      clienteId: p.clienteId,
      vendaId: p.vendaId,
      valor: parseFloat(p.valor),
    });
  }
}

module.exports = {
  aplicarPagamentoNosTitulos,
  recalcularTitulos,
  getWhereByClienteVenda,
};
