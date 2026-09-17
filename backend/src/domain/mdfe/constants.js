const STATUS = {
  RASCUNHO: "rascunho",
  PROCESSANDO: "processando",
  AUTORIZADA: "autorizada",
  REJEITADA: "rejeitada",
  CANCELADA: "cancelada",
  ENCERRADA: "encerrada",
  DENEGADA: "denegada",
  INDISPONIVEL: "indisponivel",
};

const STATUS_PERMITE_REEMISSAO = new Set([
  STATUS.REJEITADA,
  STATUS.CANCELADA,
  STATUS.DENEGADA,
  STATUS.INDISPONIVEL,
]);

function statusPermiteReemissao(status) {
  if (!status) return true;
  return STATUS_PERMITE_REEMISSAO.has(String(status));
}

function statusPermiteEncerramento(status) {
  return String(status) === STATUS.AUTORIZADA;
}

function mapStatusFocus(raw) {
  const s = String(raw || "").toLowerCase();
  if (s === "autorizado" || s === "autorizada") return STATUS.AUTORIZADA;
  if (s === "cancelado" || s === "cancelada") return STATUS.CANCELADA;
  if (s === "encerrado" || s === "encerrada") return STATUS.ENCERRADA;
  if (s === "erro_autorizacao" || s === "rejeitado" || s === "rejeitada") {
    return STATUS.REJEITADA;
  }
  if (s === "denegado" || s === "denegada") return STATUS.DENEGADA;
  if (
    s === "processando_autorizacao" ||
    s === "processando" ||
    s === "processando_cancelamento" ||
    s === "processando_encerramento"
  ) {
    return STATUS.PROCESSANDO;
  }
  return STATUS.PROCESSANDO;
}

module.exports = {
  STATUS,
  STATUS_PERMITE_REEMISSAO,
  statusPermiteReemissao,
  statusPermiteEncerramento,
  mapStatusFocus,
};
