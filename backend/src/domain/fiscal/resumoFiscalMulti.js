const { STATUS: NFE_STATUS } = require("../nfe/constants");
const { STATUS: CTE_STATUS } = require("../cte/constants");
const { STATUS: MDFE_STATUS } = require("../mdfe/constants");
const { STATUS: CIOT_STATUS } = require("../ciot/constants");
const { resumoFiscal } = require("./resumoFiscal");

function countBy(items, statusField, map) {
  const out = { ...map };
  for (const it of items) {
    const st = String(it[statusField] || "");
    if (out[st] != null) out[st] += 1;
    else if (out._outros != null) out._outros += 1;
  }
  out.total = items.length;
  return out;
}

function resumoCte(docs = []) {
  const counts = {
    total: 0,
    autorizadas: 0,
    canceladas: 0,
    rejeitadas: 0,
    processando: 0,
    denegadas: 0,
    indisponivel: 0,
    rascunho: 0,
  };
  let valorServicoAutorizado = 0;
  for (const d of docs) {
    const st = String(d.status || "");
    counts.total += 1;
    if (st === CTE_STATUS.AUTORIZADA) {
      counts.autorizadas += 1;
      valorServicoAutorizado += Number(d.valorServico ?? 0) || 0;
    } else if (st === CTE_STATUS.CANCELADA) counts.canceladas += 1;
    else if (st === CTE_STATUS.REJEITADA) counts.rejeitadas += 1;
    else if (st === CTE_STATUS.PROCESSANDO) counts.processando += 1;
    else if (st === CTE_STATUS.DENEGADA) counts.denegadas += 1;
    else if (st === CTE_STATUS.INDISPONIVEL) counts.indisponivel += 1;
    else if (st === CTE_STATUS.RASCUNHO) counts.rascunho += 1;
  }
  return {
    ...counts,
    valorServicoAutorizado: Math.round(valorServicoAutorizado * 100) / 100,
  };
}

function resumoMdfe(docs = []) {
  const counts = {
    total: 0,
    autorizadas: 0,
    canceladas: 0,
    encerradas: 0,
    rejeitadas: 0,
    processando: 0,
    denegadas: 0,
    indisponivel: 0,
  };
  for (const d of docs) {
    const st = String(d.status || "");
    counts.total += 1;
    if (st === MDFE_STATUS.AUTORIZADA) counts.autorizadas += 1;
    else if (st === MDFE_STATUS.CANCELADA) counts.canceladas += 1;
    else if (st === MDFE_STATUS.ENCERRADA) counts.encerradas += 1;
    else if (st === MDFE_STATUS.REJEITADA) counts.rejeitadas += 1;
    else if (st === MDFE_STATUS.PROCESSANDO) counts.processando += 1;
    else if (st === MDFE_STATUS.DENEGADA) counts.denegadas += 1;
    else if (st === MDFE_STATUS.INDISPONIVEL) counts.indisponivel += 1;
  }
  return counts;
}

function resumoCiot(docs = []) {
  const counts = {
    total: 0,
    registrados: 0,
    cancelados: 0,
    encerrados: 0,
    rejeitados: 0,
    processando: 0,
    naoImplementado: 0,
    indisponivel: 0,
  };
  let valorRegistrado = 0;
  for (const d of docs) {
    const st = String(d.status || "");
    counts.total += 1;
    if (st === CIOT_STATUS.REGISTRADO) {
      counts.registrados += 1;
      valorRegistrado += Number(d.valorOperacao ?? 0) || 0;
    } else if (st === CIOT_STATUS.CANCELADO) counts.cancelados += 1;
    else if (st === CIOT_STATUS.ENCERRADO) counts.encerrados += 1;
    else if (st === CIOT_STATUS.REJEITADO) counts.rejeitados += 1;
    else if (st === CIOT_STATUS.PROCESSANDO) counts.processando += 1;
    else if (st === CIOT_STATUS.NAO_IMPLEMENTADO) counts.naoImplementado += 1;
    else if (st === CIOT_STATUS.INDISPONIVEL) counts.indisponivel += 1;
  }
  return {
    ...counts,
    valorRegistrado: Math.round(valorRegistrado * 100) / 100,
  };
}

/**
 * Resumo multi-tipo. Valores NÃO são somados entre tipos.
 */
function resumoFiscalMulti({ notas = [], ctes = [], mdfes = [], ciots = [] } = {}) {
  return {
    nfe: resumoFiscal(notas),
    cte: resumoCte(ctes),
    mdfe: resumoMdfe(mdfes),
    ciot: resumoCiot(ciots),
  };
}

module.exports = {
  resumoFiscalMulti,
  resumoCte,
  resumoMdfe,
  resumoCiot,
  countBy,
  NFE_STATUS,
};
