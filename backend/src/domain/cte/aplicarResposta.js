const { mapStatusFocus, STATUS } = require("./constants");

function aplicarRespostaProvedorCte(resposta) {
  let status = resposta?.status;
  if (!status || !Object.values(STATUS).includes(status)) {
    status = mapStatusFocus(resposta?.raw?.status || resposta?.status);
  }
  return {
    status,
    serie: resposta?.serie ?? null,
    numero: resposta?.numero ?? null,
    chaveAcesso: resposta?.chaveAcesso ?? null,
    protocolo: resposta?.protocolo ?? null,
    motivoRejeicao: resposta?.motivoRejeicao ?? null,
    xmlUrl: resposta?.xmlUrl ?? null,
    dacteUrl: resposta?.dacteUrl ?? resposta?.danfeUrl ?? null,
    payloadResposta: resposta?.raw ?? resposta ?? null,
    autorizadaEm: status === STATUS.AUTORIZADA ? new Date() : undefined,
    canceladaEm: status === STATUS.CANCELADA ? new Date() : undefined,
  };
}

module.exports = {
  ...require("./montarPayload"),
  aplicarRespostaProvedorCte,
};
