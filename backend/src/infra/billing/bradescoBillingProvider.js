const { BankBillingError, CODES } = require("./errors");

/**
 * Provider Bradesco — preparado para API real via portal Bradesco Developers.
 * Sem credenciais: BANK_NOT_CONFIGURED (não inventa registro).
 *
 * HTTP real só deve ser ligado com collection/manual oficial do portal do cliente.
 * Endpoints não são inventados aqui.
 */
function createBradescoBillingProvider({ config, secrets } = {}) {
  const configured =
    config?.status === "CONFIGURADO" &&
    secrets &&
    (secrets.clientId || secrets.apiKey || secrets.token || secrets.certificatePem);

  return {
    name: "bradesco",
    banco: "BRADESCO",

    async gerarCobranca(_input) {
      if (!configured) {
        throw new BankBillingError(
          "Bradesco não configurado. Configure credenciais no painel admin (portal Bradesco Developers).",
          { code: CODES.NOT_CONFIGURED, httpStatus: 503 },
        );
      }
      // Integração HTTP real depende da collection oficial do portal — não inventar endpoints.
      throw new BankBillingError(
        "Integração Bradesco API pendente de homologação com credenciais do portal oficial.",
        { code: CODES.NOT_CONFIGURED, httpStatus: 503 },
      );
    },

    async consultarCobranca() {
      throw new BankBillingError(
        "Bradesco não configurado ou pendente de homologação.",
        { code: CODES.NOT_CONFIGURED, httpStatus: 503 },
      );
    },

    async cancelarCobranca() {
      throw new BankBillingError(
        "Cancelamento Bradesco via API não disponível nesta fase.",
        { code: CODES.CANCEL_UNSUPPORTED, httpStatus: 501 },
      );
    },

    async baixarBoletoPdf() {
      throw new BankBillingError(
        "PDF Bradesco não disponível via API nesta fase (use linha digitável/código de barras).",
        { code: CODES.PDF_UNAVAILABLE, httpStatus: 404 },
      );
    },
  };
}

module.exports = { createBradescoBillingProvider };
