const STATUS = {
  RASCUNHO: "rascunho",
  PROCESSANDO: "processando",
  REGISTRADO: "registrado",
  REJEITADO: "rejeitado",
  CANCELADO: "cancelado",
  ENCERRADO: "encerrado",
  NAO_IMPLEMENTADO: "nao_implementado",
  INDISPONIVEL: "indisponivel",
};

function refCiotTentativa({ tenantId, docId, freteMovimentoId, tentativa }) {
  const n = Number(tentativa);
  const seq = Number.isFinite(n) && n > 1 ? n : 1;
  const base = freteMovimentoId
    ? `ciot-${tenantId}-frete-${freteMovimentoId}`
    : `ciot-${tenantId}-doc-${docId}`;
  return seq <= 1 ? base : `${base}-t${seq}`;
}

function sanitizarCiot(doc) {
  if (!doc) return null;
  const { payloadEnviado, payloadResposta, ...rest } = doc;
  return {
    ...rest,
    valorOperacao: doc.valorOperacao != null ? Number(doc.valorOperacao) : null,
    temPayload: Boolean(payloadEnviado || payloadResposta),
  };
}

function validarRegistroCiot(input) {
  const erros = [];
  if (!input?.transportadorNome) erros.push("Transportador é obrigatório.");
  if (!input?.contratanteNome) erros.push("Contratante é obrigatório.");
  if (!input?.origemMunicipio || !input?.origemUf) {
    erros.push("Origem é obrigatória.");
  }
  if (!input?.destinoMunicipio || !input?.destinoUf) {
    erros.push("Destino é obrigatório.");
  }
  if (input?.valorOperacao == null || Number(input.valorOperacao) < 0) {
    erros.push("Valor da operação é obrigatório.");
  }
  return { ok: erros.length === 0, erros };
}

module.exports = {
  STATUS,
  refCiotTentativa,
  sanitizarCiot,
  validarRegistroCiot,
};
