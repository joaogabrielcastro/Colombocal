const { STATUS } = require("./constants");
const { NETWORK_CODES, INCONCLUSIVE_HTTP } = require("../nfe/refNfe");

function refMdfeTentativa({ tenantId, docId, tentativa }) {
  const n = Number(tentativa);
  const seq = Number.isFinite(n) && n > 1 ? n : 1;
  const base = `mdfe-${tenantId}-doc-${docId}`;
  return seq <= 1 ? base : `${base}-t${seq}`;
}

function isMdfeNaoEncontradoNoProvedor(err) {
  if (!err) return false;
  if (err.code === "MDFE_NAO_ENCONTRADO") return true;
  const status = err.httpStatus || err.status || err.statusCode;
  return status === 404;
}

function isErroInconclusivoMdfe(err) {
  if (!err) return false;
  if (
    err.code === "MDFE_PROVEDOR_INDISPONIVEL" ||
    err.code === "MDFE_STATUS_INCERTO"
  ) {
    return true;
  }
  const http = err.httpStatus || err.status || err.statusCode;
  if (INCONCLUSIVE_HTTP.has(http)) return true;
  const cause = err.details?.cause || err.code || err.cause?.code || err.errno;
  if (NETWORK_CODES.has(String(cause || ""))) return true;
  const msg = String(err.message || "").toLowerCase();
  return msg.includes("timeout") || msg.includes("network") || msg.includes("econnreset");
}

function statusPermiteReutilizarRef(status) {
  return status === STATUS.PROCESSANDO || status === STATUS.RASCUNHO;
}

module.exports = {
  refMdfeTentativa,
  isMdfeNaoEncontradoNoProvedor,
  isErroInconclusivoMdfe,
  statusPermiteReutilizarRef,
};
