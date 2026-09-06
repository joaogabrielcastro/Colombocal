/** Rótulos amigáveis para tipos de evento na auditoria (valor técnico → texto na tela). */
const TIPO_LABEL = {
  VENDA_CRIADA: "Venda criada",
  VENDA_ATUALIZADA: "Venda editada",
  VENDA_CANCELADA: "Venda cancelada",
  VENDA_FRETE_ATUALIZADO: "Frete da venda",
  PAGAMENTO_CRIADO: "Pagamento registrado",
  PAGAMENTO_EXCLUIDO: "Pagamento excluído",
  CHEQUE_CRIADO: "Cheque registrado",
  CHEQUE_CRIADO_LOTE: "Cheques em lote",
  CHEQUE_EXCLUIDO: "Cheque excluído",
  CHEQUE_STATUS_ALTERADO: "Status do cheque",
  FRETE_ALTERADO: "Frete alterado",
  FRETE_EXCLUIDO: "Frete excluído",
  FRETE_AVULSO_CRIADO: "Frete avulso criado",
  FRETE_AVULSO_ATUALIZADO: "Frete avulso atualizado",
  FRETE_VALE_AVULSO_CRIADO: "Vale de frete avulso criado",
  FRETE_VALE_CRIADO: "Vale de frete criado",
  CLIENTE_CRIADO: "Cliente criado",
  CLIENTE_ATUALIZADO: "Cliente editado",
  CLIENTE_INATIVADO: "Cliente inativado",
  PRODUTO_CRIADO: "Produto criado",
  PRODUTO_ATUALIZADO: "Produto editado",
  PRODUTO_INATIVADO: "Produto inativado",
  NFE_EMITIDA: "NF-e emitida",
  NFE_CANCELADA: "NF-e cancelada",
  COMISSAO_AJUSTE_LOTE: "Ajuste de comissão (lote)",
  USER_NAV_PERMISSOES: "Permissões de menu",
};

function labelTipoAuditoria(tipo) {
  if (!tipo) return "";
  const key = String(tipo).trim();
  if (TIPO_LABEL[key]) return TIPO_LABEL[key];
  return key
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

module.exports = { TIPO_LABEL, labelTipoAuditoria };
