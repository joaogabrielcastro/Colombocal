const {
  onlyDigits,
  normalizeIe,
  inferIndIEDest,
  cfopParaUf,
} = require("./constants");

function campo(erros, condicao, mensagem) {
  if (condicao) erros.push(mensagem);
}

function validarEmitente(emitente, erros) {
  if (!emitente) {
    erros.push("Cadastre os dados fiscais do emitente em Configurações.");
    return;
  }
  campo(erros, onlyDigits(emitente.cnpj).length !== 14, "Emitente: CNPJ inválido.");
  campo(
    erros,
    !normalizeIe(emitente.inscricaoEstadual),
    "Emitente: inscrição estadual é obrigatória.",
  );
  campo(erros, !String(emitente.razaoSocial || "").trim(), "Emitente: razão social é obrigatória.");
  campo(erros, !String(emitente.logradouro || "").trim(), "Emitente: logradouro é obrigatório.");
  campo(erros, !String(emitente.numero || "").trim(), "Emitente: número do endereço é obrigatório.");
  campo(erros, !String(emitente.bairro || "").trim(), "Emitente: bairro é obrigatório.");
  campo(erros, !String(emitente.municipio || "").trim(), "Emitente: município é obrigatório.");
  campo(
    erros,
    onlyDigits(emitente.codigoMunicipio).length !== 7,
    "Emitente: código IBGE do município (7 dígitos) é obrigatório.",
  );
  campo(erros, String(emitente.uf || "").trim().length !== 2, "Emitente: UF é obrigatória.");
  campo(erros, onlyDigits(emitente.cep).length !== 8, "Emitente: CEP é obrigatório.");
  const crt = Number(emitente.crt);
  campo(erros, ![1, 2, 3].includes(crt), "Emitente: CRT inválido (use 1, 2 ou 3).");
}

function validarCliente(cliente, erros) {
  if (!cliente) {
    erros.push("Cliente da venda não encontrado.");
    return;
  }
  const tipo = String(cliente.tipoPessoa || "PJ").toUpperCase();
  if (tipo === "PF") {
    campo(erros, onlyDigits(cliente.cpf).length !== 11, "Cliente: CPF inválido.");
  } else {
    campo(erros, onlyDigits(cliente.cnpj).length !== 14, "Cliente: CNPJ inválido.");
    const ie = normalizeIe(cliente.inscricaoEstadual);
    const ind = inferIndIEDest(cliente);
    if (ind === 1 && !ie) {
      erros.push("Cliente contribuinte ICMS precisa de inscrição estadual.");
    }
  }
  campo(erros, !String(cliente.razaoSocial || "").trim(), "Cliente: razão social é obrigatória.");
  campo(
    erros,
    !String(cliente.endereco || cliente.logradouro || "").trim() &&
      !String(cliente.numero || "").trim(),
    "Cliente: endereço (logradouro e número) é obrigatório.",
  );
  campo(erros, !String(cliente.cidade || "").trim(), "Cliente: cidade é obrigatória.");
  campo(erros, String(cliente.estado || "").trim().length !== 2, "Cliente: UF é obrigatória.");
  campo(erros, onlyDigits(cliente.cep).length !== 8, "Cliente: CEP é obrigatório.");
  campo(
    erros,
    onlyDigits(cliente.codigoMunicipio).length !== 7,
    "Cliente: código IBGE do município (7 dígitos) é obrigatório.",
  );
}

function validarProdutoItem(item, produto, emitente, ufDestino, erros) {
  const nome = produto?.nome || `produto #${item?.produtoId}`;
  if (!produto) {
    erros.push(`Item: ${nome} não encontrado.`);
    return;
  }
  campo(
    erros,
    onlyDigits(produto.ncm).length !== 8,
    `${nome}: NCM (8 dígitos) é obrigatório. Confirme com o contador.`,
  );
  const mesmaUf =
    String(ufDestino || "").toUpperCase() === String(emitente?.uf || "").toUpperCase();
  const cfop = cfopParaUf(produto, ufDestino, emitente?.uf);
  campo(
    erros,
    onlyDigits(cfop).length !== 4,
    `${nome}: CFOP padrão ${mesmaUf ? "dentro do estado" : "interestadual"} é obrigatório.`,
  );
  const crt = Number(emitente?.crt);
  if (crt === 1 || crt === 2) {
    campo(
      erros,
      onlyDigits(produto.csosn).length < 3,
      `${nome}: CSOSN (Simples Nacional) é obrigatório.`,
    );
  } else if (crt === 3) {
    campo(
      erros,
      onlyDigits(produto.cst).length < 2,
      `${nome}: CST (regime normal) é obrigatório.`,
    );
  }
}

/**
 * Valida cadastros fiscais antes de enviar ao provedor.
 * @returns {{ ok: boolean, erros: string[] }}
 */
function validarPreEmissaoNfe({ emitente, cliente, itens, produtosPorId }) {
  const erros = [];
  validarEmitente(emitente, erros);
  validarCliente(cliente, erros);

  if (!Array.isArray(itens) || itens.length < 1) {
    erros.push("A venda precisa de ao menos um item para emitir NF-e.");
  } else {
    for (const item of itens) {
      const produto = produtosPorId?.get
        ? produtosPorId.get(item.produtoId)
        : produtosPorId?.[item.produtoId];
      validarProdutoItem(item, produto, emitente, cliente?.estado, erros);
    }
  }

  return { ok: erros.length === 0, erros };
}

module.exports = { validarPreEmissaoNfe };
