/**
 * Remove lançamentos de troco órfãos do mesmo recebimento (mesmo dia + mesma venda/cliente)
 * quando não resta nenhum pagamento positivo (cheque/dinheiro/PIX).
 * Assim o estorno de cheque/pagamento não deixa troco antigo acumulado.
 */
const EPS = 0.009;

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

/**
 * Remove trocos cujo valor não se justifica pelos pagamentos positivos da venda
 * (ex.: cheque estornado/refeito e o troco antigo ficou).
 * Mantém os trocos mais antigos até cobrir (positivos − valor da venda); apaga o restante.
 */
async function limparTrocosInjustificadosDoCliente(tx, clienteId) {
  const pags = await tx.pagamento.findMany({
    where: { clienteId },
    orderBy: [{ id: "asc" }],
  });

  /** @type {Map<number, { positivos: number, trocos: Array<{ id: number, valor: unknown }> }>} */
  const byVenda = new Map();
  for (const p of pags) {
    if (p.vendaId == null) continue;
    if (!byVenda.has(p.vendaId)) {
      byVenda.set(p.vendaId, { positivos: 0, trocos: [] });
    }
    const bucket = byVenda.get(p.vendaId);
    const valor = parseFloat(String(p.valor));
    const tipo = String(p.tipo || "");
    if (tipo.startsWith("troco_")) {
      bucket.trocos.push({ id: p.id, valor: p.valor });
    } else if (valor > EPS) {
      bucket.positivos += valor;
    }
  }

  let deleted = 0;
  for (const [vendaId, bucket] of byVenda) {
    if (bucket.trocos.length === 0) continue;

    const titulos = await tx.tituloReceber.findMany({
      where: { clienteId, vendaId },
      select: { valorOriginal: true },
    });
    let debito = titulos.reduce(
      (acc, t) => acc + parseFloat(String(t.valorOriginal)),
      0,
    );
    if (debito <= EPS) {
      const venda = await tx.venda.findFirst({
        where: { id: vendaId, clienteId },
        select: { valorTotal: true },
      });
      debito = venda ? parseFloat(String(venda.valorTotal)) : 0;
    }

    let justificado =
      Math.round(Math.max(0, bucket.positivos - debito) * 100) / 100;

    for (const t of bucket.trocos) {
      const abs = Math.abs(parseFloat(String(t.valor)));
      if (justificado + EPS >= abs) {
        justificado = Math.round((justificado - abs) * 100) / 100;
        continue;
      }
      await tx.pagamento.delete({ where: { id: t.id } });
      deleted += 1;
    }
  }
  return { deleted };
}

module.exports = {
  janelaDoDia,
  limparTrocosOrfaosDoRecebimento,
  limparTrocosInjustificadosDoCliente,
};
