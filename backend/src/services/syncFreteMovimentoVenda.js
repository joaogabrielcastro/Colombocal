/**
 * Sincroniza FreteMovimento com os campos de frete da Venda (fonte única).
 * Usado na criação, edição e PATCH parcial de frete.
 */

function parseReciboDate(value) {
  if (value == null || String(value).trim() === "") return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Cria, atualiza ou remove o espelho de frete vinculado à venda.
 */
async function upsertFreteMovimentoFromVenda(
  tx,
  {
    tenantId,
    vendaId,
    clienteId,
    freteValor,
    freteRecibo = false,
    freteReciboNum = null,
    freteReciboData = undefined,
    dataVenda,
    observacaoPrefix = "Frete da venda",
    numeroVenda = null,
  },
) {
  const valor = parseFloat(String(freteValor ?? 0));
  const fretes = await tx.freteMovimento.findMany({
    where: { vendaId, tenantId },
    orderBy: { id: "asc" },
  });

  if (!Number.isFinite(valor) || valor <= 0) {
    if (fretes.length > 0) {
      await tx.freteMovimento.deleteMany({ where: { vendaId, tenantId } });
    }
    return;
  }

  const fmData = {
    clienteId,
    valor,
    reciboEmitido: !!freteRecibo,
    reciboNumero: freteRecibo ? freteReciboNum || null : null,
    data: dataVenda,
  };
  if (freteReciboData !== undefined) {
    fmData.reciboData = parseReciboDate(freteReciboData);
  }

  const ref = numeroVenda != null ? numeroVenda : vendaId;
  const observacao = `${observacaoPrefix} #${ref}`;

  if (fretes.length > 0) {
    await tx.freteMovimento.update({
      where: { id: fretes[0].id },
      data: fmData,
    });
  } else {
    await tx.freteMovimento.create({
      data: {
        tenantId,
        vendaId,
        observacao,
        ...fmData,
      },
    });
  }
}

module.exports = {
  upsertFreteMovimentoFromVenda,
  parseReciboDate,
};
