const STATUS = {
  RASCUNHO: "rascunho",
  PROCESSANDO: "processando",
  AUTORIZADA: "autorizada",
  REJEITADA: "rejeitada",
  CANCELADA: "cancelada",
  DENEGADA: "denegada",
};

const STATUS_BLOQUEIA_VENDA = new Set([STATUS.PROCESSANDO, STATUS.AUTORIZADA]);

const STATUS_PERMITE_REEMISSAO = new Set([
  STATUS.REJEITADA,
  STATUS.CANCELADA,
  STATUS.DENEGADA,
]);

function statusBloqueiaVenda(status) {
  return STATUS_BLOQUEIA_VENDA.has(String(status || ""));
}

function statusPermiteReemissao(status) {
  if (!status) return true;
  return STATUS_PERMITE_REEMISSAO.has(String(status));
}

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeIe(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.toUpperCase() === "ISENTO") return "ISENTO";
  return onlyDigits(raw) || null;
}

function inferIndIEDest({ tipoPessoa, inscricaoEstadual, indIEDest }) {
  if (indIEDest === 1 || indIEDest === 2 || indIEDest === 9) return indIEDest;
  if (String(tipoPessoa || "").toUpperCase() === "PF") return 9;
  const ie = normalizeIe(inscricaoEstadual);
  if (ie === "ISENTO") return 2;
  if (ie) return 1;
  return 9;
}

function cfopParaUf(produto, ufDestino, ufEmitente) {
  const intra = onlyDigits(produto?.cfopPadraoDentro);
  const inter = onlyDigits(produto?.cfopPadraoFora);
  const mesmaUf =
    String(ufDestino || "").toUpperCase() === String(ufEmitente || "").toUpperCase();
  return mesmaUf ? intra : inter;
}

module.exports = {
  STATUS,
  STATUS_BLOQUEIA_VENDA,
  STATUS_PERMITE_REEMISSAO,
  statusBloqueiaVenda,
  statusPermiteReemissao,
  onlyDigits,
  normalizeIe,
  inferIndIEDest,
  cfopParaUf,
};
