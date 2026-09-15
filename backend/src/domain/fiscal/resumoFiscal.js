const { STATUS } = require("../nfe/constants");

/**
 * Contagens e valor autorizado a partir de notas já carregadas (com venda.valorTotal).
 * Emissão incerta não é status persistido — permanece em processando (contagem 0 própria).
 */
function resumoFiscal(notas = []) {
  const counts = {
    total: notas.length,
    autorizadas: 0,
    canceladas: 0,
    rejeitadas: 0,
    processando: 0,
    denegadas: 0,
    rascunho: 0,
    emissaoIncerta: 0,
  };
  let valorAutorizado = 0;

  for (const nota of notas) {
    const st = String(nota.status || "");
    if (st === STATUS.AUTORIZADA) {
      counts.autorizadas += 1;
      valorAutorizado += Number(nota.venda?.valorTotal ?? nota.valorTotal ?? 0) || 0;
    } else if (st === STATUS.CANCELADA) {
      counts.canceladas += 1;
    } else if (st === STATUS.REJEITADA) {
      counts.rejeitadas += 1;
    } else if (st === STATUS.PROCESSANDO) {
      counts.processando += 1;
    } else if (st === STATUS.DENEGADA) {
      counts.denegadas += 1;
    } else if (st === STATUS.RASCUNHO) {
      counts.rascunho += 1;
    }
  }

  return {
    ...counts,
    valorAutorizado: Math.round(valorAutorizado * 100) / 100,
  };
}

module.exports = { resumoFiscal };
