const { dataReferenciaNota } = require("./dataReferencia");
const { resumoFiscalLinha } = require("./extrairFiscal");

const colunasExport = [
  "Número",
  "Série",
  "Data Emissão",
  "Cliente",
  "CNPJ/CPF",
  "Valor",
  "Status",
  "Chave NF-e",
  "CFOP",
  "NCM",
  "CST/CSOSN",
  "Venda",
  "Data Cancelamento",
  "Motivo Cancelamento",
];

function formatDatePt(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("pt-BR");
}

function nomeCliente(cliente) {
  if (!cliente) return "";
  return String(cliente.nomeFantasia || cliente.razaoSocial || "").trim();
}

function docCliente(cliente) {
  if (!cliente) return "";
  return String(cliente.cnpj || cliente.cpf || "").trim();
}

/**
 * @param {object} nota — NotaFiscal com venda.cliente e opcionalmente motivoCancelamento
 */
function montarLinhaExport(nota) {
  const fiscal = resumoFiscalLinha(nota.payloadEnviado);
  const dataRef = dataReferenciaNota(nota);
  const motivo =
    nota.motivoCancelamento ||
    (nota.status === "cancelada" || nota.status === "rejeitada"
      ? nota.motivoRejeicao
      : null) ||
    "";

  return {
    Número: nota.numero ?? "",
    Série: nota.serie ?? "",
    "Data Emissão": formatDatePt(dataRef),
    Cliente: nomeCliente(nota.venda?.cliente),
    "CNPJ/CPF": docCliente(nota.venda?.cliente),
    Valor: Number(nota.venda?.valorTotal ?? 0) || 0,
    Status: nota.status || "",
    "Chave NF-e": nota.chaveAcesso || "",
    CFOP: fiscal.cfop || "",
    NCM: fiscal.ncm || "",
    "CST/CSOSN": fiscal.cstCsosn || "",
    Venda: nota.venda?.numeroVenda ?? nota.vendaId ?? "",
    "Data Cancelamento": formatDatePt(nota.canceladaEm),
    "Motivo Cancelamento": motivo || "",
  };
}

module.exports = {
  colunasExport,
  montarLinhaExport,
  formatDatePt,
  nomeCliente,
  docCliente,
};
