/**
 * Auditoria append-only de operações financeiras (pagamentos, cheques, frete, etc.).
 */

function actorFromReq(req) {
  if (!req?.authUser) return { userId: null, userLabel: null };
  const u = req.authUser;
  const name = u.name != null ? String(u.name).trim() : "";
  return {
    userId: u.id != null && u.id > 0 ? u.id : null,
    userLabel: name || null,
  };
}

function looksLikeEmail(s) {
  return typeof s === "string" && s.includes("@");
}

function mergeAuditIntoPayload(payload, actor) {
  const base =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? { ...payload }
      : {};
  if (actor?.userId) base.auditUserId = actor.userId;
  if (actor?.userLabel) base.auditBy = actor.userLabel;
  return Object.keys(base).length ? base : null;
}

function withAuditActor(data, actor) {
  if (!actor?.userId && !actor?.userLabel) return data;
  return {
    ...data,
    userId: data.userId ?? actor.userId ?? null,
    userLabel: data.userLabel ?? actor.userLabel ?? null,
    payload: mergeAuditIntoPayload(data.payload, actor),
  };
}

/** Nome exibido na auditoria (sem e-mail). */
function resolveUsuarioExibicao(evento, userById) {
  if (evento.userId && userById?.has(evento.userId)) {
    const u = userById.get(evento.userId);
    const name = u.name != null ? String(u.name).trim() : "";
    if (name) return name;
  }
  if (evento.userLabel) {
    const l = String(evento.userLabel).trim();
    if (l && !looksLikeEmail(l)) return l;
  }
  const pl = evento.payload;
  if (pl && typeof pl === "object" && pl.auditBy) {
    const by = String(pl.auditBy).trim();
    if (by && !looksLikeEmail(by)) return by;
  }
  return null;
}

async function registrarEventoFinanceiro(tx, data) {
  const tenantId = data.tenantId;
  if (tenantId == null) {
    throw new Error("registrarEventoFinanceiro: tenantId obrigatório");
  }
  const merged = data.auditActor ? withAuditActor(data, data.auditActor) : data;
  const { auditActor: _drop, ...row } = merged;
  await tx.financeiroEvento.create({
    data: {
      tenantId,
      userId: row.userId ?? null,
      userLabel: row.userLabel ?? null,
      tipo: row.tipo,
      entidade: row.entidade,
      entidadeId: row.entidadeId ?? null,
      clienteId: row.clienteId ?? null,
      vendaId: row.vendaId ?? null,
      chequeId: row.chequeId ?? null,
      pagamentoId: row.pagamentoId ?? null,
      tituloId: row.tituloId ?? null,
      valor: row.valor ?? null,
      payload: row.payload ?? null,
    },
  });
}

async function registrarAuditoria(tx, req, data) {
  const actor = actorFromReq(req);
  return registrarEventoFinanceiro(tx, {
    ...data,
    auditActor: actor,
  });
}

module.exports = {
  actorFromReq,
  mergeAuditIntoPayload,
  withAuditActor,
  resolveUsuarioExibicao,
  registrarEventoFinanceiro,
  registrarAuditoria,
};
