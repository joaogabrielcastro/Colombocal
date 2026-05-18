/**
 * Auditoria append-only de operações financeiras (pagamentos, cheques, frete, etc.).
 *
 * Política de retenção (operacional — não implementada no código):
 * - Manter no mínimo 24 meses para conciliação e suporte; após isso, truncar ou arquivar
 *   em cold storage conforme política interna (job agendado ou `DELETE` por `createdAt`).
 * - Índices em `tipo`, `clienteId`, `vendaId` já suportam consultas por período.
 */
function actorFromReq(req) {
  if (!req?.authUser) return { userId: null, userLabel: null };
  const u = req.authUser;
  const label = u.name?.trim() || u.email || `user#${u.id}`;
  return { userId: u.id, userLabel: label };
}

async function registrarEventoFinanceiro(tx, data) {
  const payload = data.payload || null;
  const tenantId = data.tenantId;
  if (tenantId == null) {
    throw new Error("registrarEventoFinanceiro: tenantId obrigatório");
  }
  await tx.financeiroEvento.create({
    data: {
      tenantId,
      userId: data.userId ?? null,
      userLabel: data.userLabel ?? null,
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

/** Mesmo registro de auditoria, preenchendo usuário a partir do request Express. */
async function registrarAuditoria(tx, req, data) {
  const actor = actorFromReq(req);
  return registrarEventoFinanceiro(tx, {
    ...data,
    userId: data.userId ?? actor.userId,
    userLabel: data.userLabel ?? actor.userLabel,
  });
}

module.exports = {
  actorFromReq,
  registrarEventoFinanceiro,
  registrarAuditoria,
};
