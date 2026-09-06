const { STATUS } = require("../../domain/nfe/constants");

function chaveMock(ref) {
  const digits = String(ref || "0").replace(/\D/g, "").padEnd(44, "0").slice(0, 44);
  return digits;
}

function createMockNfeProvider(overrides = {}) {
  const store = overrides.store || new Map();

  return {
    name: "mock",
    store,
    async emitir({ ref, payload }) {
      if (overrides.emitir) return overrides.emitir({ ref, payload });
      const numero = store.size + 1;
      const result = {
        status: STATUS.AUTORIZADA,
        serie: 1,
        numero,
        chaveAcesso: chaveMock(ref),
        protocolo: `MOCK-${Date.now()}`,
        motivoRejeicao: null,
        xmlUrl: null,
        danfeUrl: null,
        raw: { mock: true, ref, status: "autorizado" },
      };
      store.set(ref, { ...result, payload });
      return result;
    },
    async consultar({ ref }) {
      if (overrides.consultar) return overrides.consultar({ ref });
      const found = store.get(ref);
      if (!found) {
        const err = new Error("Nota mock não encontrada");
        err.httpStatus = 404;
        throw err;
      }
      return found;
    },
    async cancelar({ ref, justificativa }) {
      if (overrides.cancelar) return overrides.cancelar({ ref, justificativa });
      const found = store.get(ref) || {};
      const result = {
        ...found,
        status: STATUS.CANCELADA,
        raw: { mock: true, ref, status: "cancelado", justificativa },
      };
      store.set(ref, result);
      return result;
    },
    async baixarArquivo() {
      return null;
    },
  };
}

module.exports = { createMockNfeProvider };
