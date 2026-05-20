/** Rótulos de tipos de auditoria (espelha backend/src/constants/auditoriaTipos.js). */
export const TIPO_AUDITORIA_LABEL: Record<string, string> = {
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
  FRETE_AVULSO_CRIADO: "Frete avulso criado",
  FRETE_VALE_AVULSO_CRIADO: "Vale de frete avulso criado",
  FRETE_VALE_CRIADO: "Vale de frete criado",
  USER_NAV_PERMISSOES: "Permissões de menu",
};

export function labelTipoAuditoria(tipo: string): string {
  const key = String(tipo || "").trim();
  if (!key) return "";
  if (TIPO_AUDITORIA_LABEL[key]) return TIPO_AUDITORIA_LABEL[key];
  return key
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
