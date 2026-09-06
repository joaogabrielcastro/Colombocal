const {
  onlyDigits,
  normalizeIe,
  inferIndIEDest,
  cfopParaUf,
} = require("./constants");

function money(n) {
  return Number(n || 0).toFixed(2);
}

function qty(n) {
  return Number(n || 0).toFixed(4);
}

function unit(n) {
  return Number(n || 0).toFixed(10);
}

function splitEndereco(cliente) {
  const logradouro =
    String(cliente.logradouro || "").trim() ||
    String(cliente.endereco || "")
      .split(",")[0]
      ?.trim() ||
    "SN";
  const numero = String(cliente.numero || "").trim() || "SN";
  const bairro = String(cliente.bairro || "").trim() || "CENTRO";
  return { logradouro, numero, bairro };
}

/**
 * Monta o JSON da Focus NFe (modelo 55) só com produtos — sem valor de frete.
 */
function montarPayloadFocus({ emitente, cliente, venda, itens, produtosPorId, motorista }) {
  const { logradouro, numero, bairro } = splitEndereco(cliente);
  const tipo = String(cliente.tipoPessoa || "PJ").toUpperCase();
  const destDoc = {};
  if (tipo === "PF") {
    destDoc.cpf_destinatario = onlyDigits(cliente.cpf);
  } else {
    destDoc.cnpj_destinatario = onlyDigits(cliente.cnpj);
  }

  const ie = normalizeIe(cliente.inscricaoEstadual);
  const indIEDest = inferIndIEDest(cliente);
  if (ie && ie !== "ISENTO") destDoc.inscricao_estadual_destinatario = ie;
  destDoc.indicador_inscricao_estadual_destinatario = String(indIEDest);

  const crt = Number(emitente.crt);
  const items = itens.map((item, idx) => {
    const produto = produtosPorId.get(item.produtoId);
    const cfop = cfopParaUf(produto, cliente.estado, emitente.uf);
    const qtd = Number(item.quantidade);
    const vu = Number(item.precoUnitario);
    const bruto = qtd * vu;
    const unidade = String(produto.unidade || "ton").toUpperCase().slice(0, 6);
    const row = {
      numero_item: String(idx + 1),
      codigo_produto: produto.codigo,
      descricao: produto.nome,
      cfop: onlyDigits(cfop),
      unidade_comercial: unidade,
      quantidade_comercial: qty(qtd),
      valor_unitario_comercial: unit(vu),
      valor_bruto: money(bruto),
      unidade_tributavel: unidade,
      quantidade_tributavel: qty(qtd),
      valor_unitario_tributavel: unit(vu),
      codigo_ncm: onlyDigits(produto.ncm),
      inclui_no_total: "1",
      icms_origem: String(produto.origem ?? 0),
    };
    if (crt === 1 || crt === 2) {
      row.icms_situacao_tributaria = onlyDigits(produto.csosn);
    } else {
      row.icms_situacao_tributaria = onlyDigits(produto.cst);
    }
    return row;
  });

  const valorTotal = items.reduce((acc, it) => acc + Number(it.valor_bruto), 0);

  const payload = {
    natureza_operacao: emitente.naturezaOperacao || "Venda de mercadoria",
    data_emissao: new Date(venda.dataVenda || Date.now()).toISOString(),
    tipo_documento: 1,
    finalidade_emissao: 1,
    cnpj_emitente: onlyDigits(emitente.cnpj),
    inscricao_estadual_emitente: normalizeIe(emitente.inscricaoEstadual),
    nome_destinatario: cliente.razaoSocial,
    ...destDoc,
    logradouro_destinatario: logradouro,
    numero_destinatario: numero,
    bairro_destinatario: bairro,
    municipio_destinatario: cliente.cidade,
    uf_destinatario: String(cliente.estado || "").toUpperCase(),
    cep_destinatario: onlyDigits(cliente.cep),
    codigo_municipio_destinatario: onlyDigits(cliente.codigoMunicipio),
    modalidade_frete: Number(emitente.modalidadeFrete ?? 9),
    local_destino: String(cliente.estado || "").toUpperCase() === String(emitente.uf || "").toUpperCase() ? 1 : 2,
    items,
    formas_pagamento: [
      {
        forma_pagamento: "99",
        valor_pagamento: money(valorTotal),
      },
    ],
    informacoes_adicionais_contribuinte: `Pedido interno #${venda.numeroVenda}. Frete cobrado à parte, não incluso nesta NF-e.`,
  };

  if (motorista?.nome) {
    payload.nome_transportador = motorista.nome;
  }
  if (motorista?.placa) {
    payload.veiculo_placa = String(motorista.placa).replace(/\s/g, "").toUpperCase();
    payload.veiculo_uf = String(cliente.estado || emitente.uf || "").toUpperCase();
  }

  return payload;
}

function mapStatusFocus(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  if (s === "autorizado") return "autorizada";
  if (s === "cancelado") return "cancelada";
  if (s === "denegado") return "denegada";
  if (
    s === "erro_autorizacao" ||
    s === "erro_cancelamento" ||
    s.includes("rejeit")
  ) {
    return "rejeitada";
  }
  if (s.includes("processando") || s === "autorizando") return "processando";
  return "processando";
}

function aplicarRespostaProvedor(resposta) {
  if (!resposta) return {};
  return {
    status: resposta.status,
    serie: resposta.serie != null ? Number(resposta.serie) : undefined,
    numero: resposta.numero != null ? Number(resposta.numero) : undefined,
    chaveAcesso: resposta.chaveAcesso || undefined,
    protocolo: resposta.protocolo || undefined,
    motivoRejeicao: resposta.motivoRejeicao || undefined,
    xmlUrl: resposta.xmlUrl || undefined,
    danfeUrl: resposta.danfeUrl || undefined,
    payloadResposta: resposta.raw != null ? resposta.raw : undefined,
    autorizadaEm: resposta.status === "autorizada" ? new Date() : undefined,
    canceladaEm: resposta.status === "cancelada" ? new Date() : undefined,
  };
}

module.exports = {
  montarPayloadFocus,
  mapStatusFocus,
  aplicarRespostaProvedor,
};
