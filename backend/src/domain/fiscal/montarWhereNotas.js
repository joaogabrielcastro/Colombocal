const { onlyDigits } = require("../nfe/constants");
const { getDateRange } = require("../../utils/dateRangeQuery");
const { whereDataReferenciaNoPeriodo } = require("./dataReferencia");

/**
 * Filtros de listagem/fechamento de NF-e. Sempre exige tenantId autenticado.
 */
function montarWhereNotas({
  tenantId,
  dataInicio,
  dataFim,
  status,
  numero,
  serie,
  clienteId,
  documento,
  vendaId,
  numeroVenda,
  chave,
} = {}) {
  const tid = Number(tenantId);
  if (!Number.isFinite(tid) || tid < 1) {
    throw new Error("tenantId inválido em montarWhereNotas");
  }

  const where = { tenantId: tid };
  const range = getDateRange(dataInicio, dataFim);
  Object.assign(where, whereDataReferenciaNoPeriodo(range));

  if (status) {
    const st = String(status).trim().toLowerCase();
    if (st) where.status = st;
  }

  if (numero != null && String(numero).trim() !== "") {
    const n = parseInt(String(numero), 10);
    if (Number.isFinite(n)) where.numero = n;
  }

  if (serie != null && String(serie).trim() !== "") {
    const s = parseInt(String(serie), 10);
    if (Number.isFinite(s)) where.serie = s;
  }

  if (vendaId != null && String(vendaId).trim() !== "") {
    const vid = parseInt(String(vendaId), 10);
    if (Number.isFinite(vid) && vid > 0) where.vendaId = vid;
  }

  if (chave) {
    const ch = onlyDigits(chave);
    if (ch) where.chaveAcesso = { contains: ch };
  }

  const vendaWhere = {};
  if (clienteId != null && String(clienteId).trim() !== "") {
    const cid = parseInt(String(clienteId), 10);
    if (Number.isFinite(cid) && cid > 0) vendaWhere.clienteId = cid;
  }
  if (numeroVenda != null && String(numeroVenda).trim() !== "") {
    const nv = parseInt(String(numeroVenda), 10);
    if (Number.isFinite(nv) && nv > 0) vendaWhere.numeroVenda = nv;
  }
  if (documento) {
    const dig = onlyDigits(documento);
    if (dig) {
      vendaWhere.cliente = {
        OR: [
          { cnpj: { contains: dig } },
          { cpf: { contains: dig } },
        ],
      };
    }
  }

  if (Object.keys(vendaWhere).length) {
    where.venda = vendaWhere;
  }

  return where;
}

module.exports = { montarWhereNotas };
