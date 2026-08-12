/**
 * Remove lançamentos de troco órfãos do mesmo recebimento (mesmo dia + mesma venda/cliente)
 * quando não resta nenhum pagamento positivo (cheque/dinheiro/PIX).
 * Assim o estorno de cheque/pagamento não deixa troco antigo acumulado.
 */
function janelaDoDia(dataRef) {
  const base = dataRef instanceof Date ? dataRef : new Date(dataRef || Date.now());
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function whereRecebimento({ tenantId, vendaId, clienteId, start, end }) {
  const where = {
    tenantId,
    data: { gte: start, lte: end },
  };
  if (vendaId != null) {
    where.vendaId = vendaId;
  } else if (clienteId != null) {
    where.clienteId = clienteId;
    where.vendaId = null;
  }
  return where;
}

async function limparTrocosOrfaosDoRecebimento(
  tx,
  { tenantId, vendaId = null, clienteId = null, dataRef },
) {
  if (tenantId == null) return { deleted: 0 };
  if (vendaId == null && clienteId == null) return { deleted: 0 };

  const { start, end } = janelaDoDia(dataRef);
  const whereBase = whereRecebimento({
    tenantId,
    vendaId,
    clienteId,
    start,
    end,
  });

  const outrosPositivos = await tx.pagamento.count({
    where: {
      ...whereBase,
      valor: { gt: 0 },
    },
  });
  if (outrosPositivos > 0) return { deleted: 0 };

  const del = await tx.pagamento.deleteMany({
    where: {
      ...whereBase,
      tipo: { startsWith: "troco_" },
    },
  });
  return { deleted: del.count };
}

module.exports = {
  janelaDoDia,
  limparTrocosOrfaosDoRecebimento,
};
