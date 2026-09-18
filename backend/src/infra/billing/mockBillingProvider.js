const { BankBillingError, CODES } = require("./errors");

/**
 * Mock de cobrança bancária para testes/dev.
 * overrides: { gerarCobranca, consultarCobranca, cancelarCobranca, baixarBoletoPdf }
 */
function createMockBillingProvider({ banco = "MOCK", store, overrides } = {}) {
  const mem = store || new Map();
  const o = overrides || {};

  return {
    name: "mock",
    banco,

    async gerarCobranca(input) {
      if (typeof o.gerarCobranca === "function") return o.gerarCobranca(input);
      const ref = `MOCK-${banco}-${input.idempotencyKey || input.tituloId}`;
      const result = {
        refExterna: ref,
        nossoNumero: String(input.tituloId).padStart(11, "0"),
        linhaDigitavel: "23793.38128 60000.000003 00000.000400 1 84340000010000",
        codigoBarras: "23791843400000100003381260000000000000000000",
        status: "DISPONIVEL",
        pdfRef: `mock-pdf://${ref}`,
        raw: { mock: true, banco, ref },
      };
      mem.set(ref, result);
      return result;
    },

    async consultarCobranca({ refExterna }) {
      if (typeof o.consultarCobranca === "function") {
        return o.consultarCobranca({ refExterna });
      }
      const found = mem.get(refExterna);
      if (!found) {
        throw new BankBillingError("Cobrança mock não encontrada", {
          code: CODES.BAD_REQUEST,
          httpStatus: 404,
        });
      }
      return found;
    },

    async cancelarCobranca({ refExterna }) {
      if (typeof o.cancelarCobranca === "function") {
        return o.cancelarCobranca({ refExterna });
      }
      const found = mem.get(refExterna);
      if (found) {
        found.status = "CANCELADA";
        mem.set(refExterna, found);
      }
      return { status: "CANCELADA", refExterna };
    },

    async baixarBoletoPdf({ refExterna, pdfRef }) {
      if (typeof o.baixarBoletoPdf === "function") {
        return o.baixarBoletoPdf({ refExterna, pdfRef });
      }
      const text = `Boleto mock ${banco} ${refExterna || pdfRef || ""}`;
      return {
        contentType: "application/pdf",
        buffer: Buffer.from(`%PDF-1.4\n% mock\n${text}\n%%EOF`),
      };
    },
  };
}

module.exports = { createMockBillingProvider };
