const { onlyDigits } = require("../nfe/constants");
const { mapStatusFocus } = require("./constants");

function montarPayloadFocusCte({ emitente, input }) {
  const rntrc = onlyDigits(emitente?.rntrc || input.rntrc);
  return {
    cfop: String(input.cfop || "5353"),
    natureza_operacao:
      input.naturezaOperacao || "PRESTACAO DE SERVICO DE TRANSPORTE",
    data_emissao: input.dataEmissao || new Date().toISOString(),
    tipo_documento: String(input.tipoDocumento ?? "0"),
    modal: String(input.modal || "01"),
    tipo_servico: String(input.tipoServico ?? "0"),
    codigo_municipio_envio: input.origemCodigoMunicipio || emitente?.codigoMunicipio,
    municipio_envio: input.origemMunicipio || emitente?.municipio,
    uf_envio: input.origemUf || emitente?.uf,
    codigo_municipio_inicio: input.origemCodigoMunicipio,
    municipio_inicio: input.origemMunicipio,
    uf_inicio: input.origemUf,
    codigo_municipio_fim: input.destinoCodigoMunicipio,
    municipio_fim: input.destinoMunicipio,
    uf_fim: input.destinoUf,
    municipio_destino: input.destinoMunicipio,
    observacao: input.observacoes || undefined,
    cnpj_emitente: onlyDigits(emitente?.cnpj),
    inscricao_estadual_emitente: emitente?.inscricaoEstadual,
    nome_emitente: emitente?.razaoSocial,
    nome_fantasia_emitente: emitente?.nomeFantasia || undefined,
    logradouro_emitente: emitente?.logradouro,
    numero_emitente: emitente?.numero,
    complemento_emitente: emitente?.complemento || undefined,
    bairro_emitente: emitente?.bairro,
    municipio_emitente: emitente?.municipio,
    cep_emitente: onlyDigits(emitente?.cep),
    uf_emitente: emitente?.uf,
    telefone_emitente: emitente?.telefone || undefined,
    cnpj_remetente: onlyDigits(input.remetenteDoc),
    nome_remetente: input.remetenteNome,
    cnpj_destinatario: onlyDigits(input.destinatarioDoc),
    nome_destinatario: input.destinatarioNome,
    valor_total: String(input.valorServico ?? "0"),
    valor_receber: String(input.valorServico ?? "0"),
    valor_total_carga: String(input.valorCarga ?? "0"),
    produto_predominante: input.produtoPredominante || "Carga geral",
    quantidades: input.pesoKg
      ? [
          {
            codigo_unidade_medida: "01",
            tipo_medida: "peso bruto",
            quantidade: String(Number(input.pesoKg).toFixed(4)),
          },
        ]
      : undefined,
    nfes: Array.isArray(input.chavesNfe)
      ? input.chavesNfe.map((chave_nfe) => ({ chave_nfe }))
      : undefined,
    icms_situacao_tributaria: String(input.icmsSituacaoTributaria || "00"),
    modal_rodoviario: rntrc ? { rntrc } : undefined,
  };
}

function aplicarRespostaProvedorCte(resposta) {
  // re-export from aplicarResposta — kept for backward imports
  return require("./aplicarResposta").aplicarRespostaProvedorCte(resposta);
}

function sanitizarCte(doc) {
  if (!doc) return null;
  const { payloadEnviado, payloadResposta, ...rest } = doc;
  return {
    ...rest,
    valorServico: doc.valorServico != null ? Number(doc.valorServico) : null,
    valorCarga: doc.valorCarga != null ? Number(doc.valorCarga) : null,
    pesoKg: doc.pesoKg != null ? Number(doc.pesoKg) : null,
    temPayload: Boolean(payloadEnviado || payloadResposta),
  };
}

function validarPreEmissaoCte({ emitente, input }) {
  const erros = [];
  if (!emitente) erros.push("Emitente fiscal não cadastrado.");
  if (emitente && !onlyDigits(emitente.cnpj)) erros.push("CNPJ do emitente inválido.");
  if (emitente && !onlyDigits(emitente.rntrc || input?.rntrc)) {
    erros.push("RNTRC do emitente é obrigatório para CT-e.");
  }
  if (!input?.origemMunicipio || !input?.origemUf) {
    erros.push("Origem (município/UF) é obrigatória.");
  }
  if (!input?.destinoMunicipio || !input?.destinoUf) {
    erros.push("Destino (município/UF) é obrigatório.");
  }
  if (!input?.remetenteNome || !input?.destinatarioNome) {
    erros.push("Remetente e destinatário são obrigatórios.");
  }
  return { ok: erros.length === 0, erros };
}

module.exports = {
  montarPayloadFocusCte,
  aplicarRespostaProvedorCte,
  sanitizarCte,
  validarPreEmissaoCte,
  mapStatusFocus,
};
