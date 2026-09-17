const { STATUS } = require("./constants");
const { NETWORK_CODES, INCONCLUSIVE_HTTP } = require("../nfe/refNfe");

/**
 * Ref estável no provedor.
 * Com frete: cte-{tenantId}-frete-{freteId}[-tN]
 * Independente: cte-{tenantId}-doc-{docId}[-tN]
 * Sem Date.now().
 */
function refCteTentativa({ tenantId, freteMovimentoId, docId, tentativa }) {
  const n = Number(tentativa);
  const seq = Number.isFinite(n) && n > 1 ? n : 1;
  let base;
  if (freteMovimentoId) {
    base = `cte-${tenantId}-frete-${freteMovimentoId}`;
  } else {
    base = `cte-${tenantId}-doc-${docId}`;
  }
  return seq <= 1 ? base : `${base}-t${seq}`;
}

function isCteNaoEncontradoNoProvedor(err) {
  if (!err) return false;
  if (err.code === "CTE_NAO_ENCONTRADO") return true;
  const status = err.httpStatus || err.status || err.statusCode;
  return status === 404;
}

function isErroInconclusivoCte(err) {
  if (!err) return false;
  if (err.code === "CTE_PROVEDOR_INDISPONIVEL" || err.code === "CTE_STATUS_INCERTO") {
    return true;
  }
  const http = err.httpStatus || err.status || err.statusCode;
  if (INCONCLUSIVE_HTTP.has(http)) return true;
  const cause = err.details?.cause || err.code || err.cause?.code || err.errno;
  if (NETWORK_CODES.has(String(cause || ""))) return true;
  const msg = String(err.message || "").toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("econnreset") ||
    msg.includes("network")
  );
}

function statusPermiteReutilizarRef(status) {
  return status === STATUS.PROCESSANDO || status === STATUS.RASCUNHO;
}

module.exports = {
  refCteTentativa,
  isCteNaoEncontradoNoProvedor,
  isErroInconclusivoCte,
  statusPermiteReutilizarRef,
};
