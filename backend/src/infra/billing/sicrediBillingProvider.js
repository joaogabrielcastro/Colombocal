const { BankBillingError, CODES } = require("./errors");

/**
 * Provider Sicredi — preparado para API Cobrança (portal Sicredi Developers).
 * Autenticação típica: OAuth2 + x-api-key (conforme manual oficial).
 * Sem credenciais: BANK_NOT_CONFIGURED.
 *
 * Base URLs públicas documentadas por integradores (validar no portal):
 * - Produção: https://api-parceiro.sicredi.com.br/cobranca/boleto/v1
 * - Sandbox:  https://api-parceiro.sicredi.com.br/sb/cobranca/boleto/v1
 * - Token:    https://api-parceiro.sicredi.com.br/auth/openapi/token
 *
 * HTTP real só com paths confirmados na documentation do portal do cliente.
 */
function createSicrediBillingProvider({ config, secrets } = {}) {
  const configured =
    config?.status === "CONFIGURADO" &&
    secrets &&
    (secrets.apiKey || secrets.username || secrets.password || secrets.token);

  return {
    name: "sicredi",
    banco: "SICREDI",

    async gerarCobranca(_input) {
      if (!configured) {
        throw new BankBillingError(
          "Sicredi não configurado. Configure credenciais no painel admin (portal Sicredi Developers).",
          { code: CODES.NOT_CONFIGURED, httpStatus: 503 },
        );
      }
      throw new BankBillingError(
        "Integração Sicredi API pendente de homologação com credenciais do portal oficial.",
        { code: CODES.NOT_CONFIGURED, httpStatus: 503 },
      );
    },

    async consultarCobranca() {
      throw new BankBillingError(
        "Sicredi não configurado ou pendente de homologação.",
        { code: CODES.NOT_CONFIGURED, httpStatus: 503 },
      );
    },

    async cancelarCobranca() {
      if (!configured) {
        throw new BankBillingError(
          "Sicredi não configurado.",
          { code: CODES.NOT_CONFIGURED, httpStatus: 503 },
        );
      }
      throw new BankBillingError(
        "Cancelamento Sicredi pendente de homologação.",
        { code: CODES.CANCEL_UNSUPPORTED, httpStatus: 501 },
      );
    },

    async baixarBoletoPdf() {
      if (!configured) {
        throw new BankBillingError(
          "Sicredi não configurado.",
          { code: CODES.NOT_CONFIGURED, httpStatus: 503 },
        );
      }
      throw new BankBillingError(
        "PDF Sicredi pendente de homologação.",
        { code: CODES.PDF_UNAVAILABLE, httpStatus: 404 },
      );
    },
  };
}

module.exports = { createSicrediBillingProvider };
