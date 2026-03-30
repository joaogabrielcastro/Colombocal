/**
 * Auditoria append-only de operações financeiras (pagamentos, cheques, frete, etc.).
 *
 * Política de retenção (operacional — não implementada no código):
 * - Manter no mínimo 24 meses para conciliação e suporte; após isso, truncar ou arquivar
 *   em cold storage conforme política interna (job agendado ou `DELETE` por `createdAt`).
 * - Índices em `tipo`, `clienteId`, `vendaId` já suportam consultas por período.
 */
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
