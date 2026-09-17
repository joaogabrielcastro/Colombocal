const { onlyDigits } = require("../nfe/constants");
const { mapStatusFocus, STATUS } = require("./constants");

function montarPayloadFocusMdfe({ emitente, input, documentos = [] }) {
  const docsCte = documentos.filter((d) => d.tipo === "cte");
  const docsNfe = documentos.filter((d) => d.tipo === "nfe");
  return {
    cnpj_emitente: onlyDigits(emitente?.cnpj),
    inscricao_estadual_emitente: emitente?.inscricaoEstadual,
    nome_emitente: emitente?.razaoSocial,
    uf_inicio: input.ufInicio,
    uf_fim: input.ufFim,
    data_emissao: input.dataEmissao || new Date().toISOString(),
    veiculo_placa: input.veiculoPlaca,
    veiculo_uf: input.veiculoUf || input.ufInicio,
    motorista_nome: input.motoristaNome,
    motorista_cpf: onlyDigits(input.motoristaDoc) || undefined,
    ctes: docsCte.length
      ? docsCte.map((d) => ({ chave_cte: d.chaveAcesso }))
      : undefined,
    nfes: docsNfe.length
      ? docsNfe.map((d) => ({ chave_nfe: d.chaveAcesso }))
      : undefined,
  };
}

function resolveStatus(resposta) {
  if (
    typeof resposta?.status === "string" &&
    Object.values(STATUS).includes(resposta.status)
  ) {
    return resposta.status;
  }
  return mapStatusFocus(resposta?.raw?.status || resposta?.status);
}

function aplicarRespostaProvedorMdfe(resposta) {
  const status = resolveStatus(resposta);
  return {
    status,
    serie: resposta?.serie ?? null,
    numero: resposta?.numero ?? null,
    chaveAcesso: resposta?.chaveAcesso ?? null,
    protocolo: resposta?.protocolo ?? null,
    motivoRejeicao: resposta?.motivoRejeicao ?? null,
    xmlUrl: resposta?.xmlUrl ?? null,
    damdfeUrl: resposta?.damdfeUrl ?? resposta?.danfeUrl ?? null,
    payloadResposta: resposta?.raw ?? resposta ?? null,
    autorizadaEm: status === STATUS.AUTORIZADA ? new Date() : undefined,
    canceladaEm: status === STATUS.CANCELADA ? new Date() : undefined,
    encerradaEm: status === STATUS.ENCERRADA ? new Date() : undefined,
  };
}

function sanitizarMdfe(doc) {
  if (!doc) return null;
  const { payloadEnviado, payloadResposta, ...rest } = doc;
  return {
    ...rest,
    temPayload: Boolean(payloadEnviado || payloadResposta),
    documentos: Array.isArray(doc.documentos) ? doc.documentos : undefined,
  };
}

function validarPreEmissaoMdfe({ emitente, input, documentos }) {
  const erros = [];
  if (!emitente) erros.push("Emitente fiscal não cadastrado.");
  if (!input?.ufInicio || !input?.ufFim) {
    erros.push("UF de início e fim são obrigatórias.");
  }
  if (!input?.veiculoPlaca) erros.push("Placa do veículo é obrigatória.");
  if (!Array.isArray(documentos) || documentos.length === 0) {
    erros.push("Informe ao menos um documento vinculado (CT-e ou NF-e).");
  }
  return { ok: erros.length === 0, erros };
}

module.exports = {
  montarPayloadFocusMdfe,
  aplicarRespostaProvedorMdfe,
  sanitizarMdfe,
  validarPreEmissaoMdfe,
  mapStatusFocus,
};
