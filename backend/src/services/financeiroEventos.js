async function registrarEventoFinanceiro(tx, data) {
  const payload = data.payload || null;
  await tx.financeiroEvento.create({
    data: {
      tipo: data.tipo,
      entidade: data.entidade,
      entidadeId: data.entidadeId ?? null,
      clienteId: data.clienteId ?? null,
      vendaId: data.vendaId ?? null,
      chequeId: data.chequeId ?? null,
      pagamentoId: data.pagamentoId ?? null,
      tituloId: data.tituloId ?? null,
      valor: data.valor ?? null,
      payload,
    },
  });
}

module.exports = {
  registrarEventoFinanceiro,
};
