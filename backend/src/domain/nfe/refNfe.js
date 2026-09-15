const { STATUS } = require("./constants");

const NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNABORTED",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ERR_CANCELED",
]);

const INCONCLUSIVE_HTTP = new Set([408, 409, 429, 502, 503, 504]);

/**
 * Ref estável no provedor (Focus usa `ref` como chave de idempotência).
 * Tentativa 1: venda-{tenantId}-{vendaId}
 * Reemissão após cancelar/rejeitar: venda-{tenantId}-{vendaId}-t2, -t3, …
 * Não usa Date.now() — retries da mesma emissão reutilizam a mesma ref.
 */
function refNfeTentativa(tenantId, vendaId, tentativa) {
  const n = Number(tentativa);
  const seq = Number.isFinite(n) && n > 1 ? n : 1;
  const base = `venda-${tenantId}-${vendaId}`;
  return seq <= 1 ? base : `${base}-t${seq}`;
}

function isNfeNaoEncontradaNoProvedor(err) {
  if (!err) return false;
  if (err.code === "NFE_NAO_ENCONTRADA") return true;
  const status = err.httpStatus || err.status || err.statusCode;
  return status === 404;
}

function isErroInconclusivoNfe(err) {
  if (!err) return false;
  if (err.code === "NFE_PROVEDOR_INDISPONIVEL" || err.code === "NFE_STATUS_INCERTO") {
    return true;
  }
  const http = err.httpStatus || err.status || err.statusCode;
  if (INCONCLUSIVE_HTTP.has(http)) return true;
  const cause =
    err.details?.cause ||
    err.code ||
    err.cause?.code ||
    err.errno;
  if (NETWORK_CODES.has(String(cause || ""))) return true;
  const msg = String(err.message || "").toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("econnreset") ||
    msg.includes("econnaborted") ||
    msg.includes("socket hang up") ||
    msg.includes("network")
  );
}

function statusPermiteReutilizarRef(status) {
  return status === STATUS.PROCESSANDO || status === STATUS.RASCUNHO;
}

module.exports = {
  refNfeTentativa,
  isNfeNaoEncontradaNoProvedor,
  isErroInconclusivoNfe,
  statusPermiteReutilizarRef,
  NETWORK_CODES,
  INCONCLUSIVE_HTTP,
};
