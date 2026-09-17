const { AppError } = require("../../shared/errors/appError");
const { STATUS } = require("../../domain/ciot/constants");

/**
 * Adapter abstrato IPEF — contrato preparado, sem credenciais reais.
 * Não amarra a eFrete/Extratta; implementação futura pluga aqui.
 */
function createIpefCiotProvider() {
  const fail = (op) => {
    throw new AppError(
      `CIOT via IPEF ainda não configurado (${op}). Defina provedor e credenciais quando disponíveis.`,
      { code: "CIOT_NAO_IMPLEMENTADO", httpStatus: 501 },
    );
  };
  return {
    name: "ipef",
    supports: {
      registrar: false,
      consultar: false,
      cancelar: false,
      encerrar: false,
    },
    async registrar() {
      fail("registrar");
    },
    async consultar() {
      fail("consultar");
    },
    async cancelar() {
      fail("cancelar");
    },
    async encerrar() {
      fail("encerrar");
    },
  };
}

function createNaoImplementadoCiotProvider() {
  const fail = (op) => {
    throw new AppError(
      `Operação CIOT não disponível neste ambiente (${op}). Integração IPEF/ANTT pendente.`,
      { code: "CIOT_NAO_IMPLEMENTADO", httpStatus: 501 },
    );
  };
  return {
    name: "nao_implementado",
    supports: {
      registrar: false,
      consultar: false,
      cancelar: false,
      encerrar: false,
    },
    async registrar() {
      fail("registrar");
    },
    async consultar() {
      fail("consultar");
    },
    async cancelar() {
      fail("cancelar");
    },
    async encerrar() {
      fail("encerrar");
    },
  };
}

function createMockCiotProvider(overrides = {}) {
  const store = overrides.store || new Map();
  let seq = 0;
  return {
    name: "mock",
    supports: {
      registrar: true,
      consultar: true,
      cancelar: true,
      encerrar: true,
    },
    store,
    async registrar({ ref, payload }) {
      if (overrides.registrar) return overrides.registrar({ ref, payload });
      seq += 1;
      const codigoCiot = `DEMO${String(seq).padStart(10, "0")}`;
      const result = {
        status: STATUS.REGISTRADO,
        codigoCiot,
        codigoVerificador: `V${seq}`,
        demonstracao: true,
        raw: { mock: true, ref, status: "registrado", demonstracao: true },
      };
      store.set(ref, { ...result, payload });
      return result;
    },
    async consultar({ ref }) {
      const found = store.get(ref);
      if (!found) {
        const err = new Error("CIOT mock não encontrado");
        err.httpStatus = 404;
        err.code = "CIOT_NAO_ENCONTRADO";
        throw err;
      }
      return found;
    },
    async cancelar({ ref }) {
      const found = store.get(ref) || {};
      const result = {
        ...found,
        status: STATUS.CANCELADO,
        raw: { mock: true, ref, status: "cancelado" },
      };
      store.set(ref, result);
      return result;
    },
    async encerrar({ ref }) {
      const found = store.get(ref) || {};
      const result = {
        ...found,
        status: STATUS.ENCERRADO,
        raw: { mock: true, ref, status: "encerrado" },
      };
      store.set(ref, result);
      return result;
    },
  };
}

function resolveCiotProviderName() {
  const raw = String(process.env.CIOT_PROVIDER || "")
    .trim()
    .toLowerCase();
  if (raw === "mock" || raw === "ipef" || raw === "nao_implementado") return raw;
  if (process.env.NODE_ENV === "test") return "mock";
  if (process.env.NODE_ENV === "production") return "nao_implementado";
  return "nao_implementado";
}

function createCiotProvider() {
  const name = resolveCiotProviderName();
  if (process.env.NODE_ENV === "production" && name === "mock") {
    throw new AppError(
      "CIOT_PROVIDER=mock não é permitido em produção.",
      { code: "CIOT_MOCK_PROIBIDO", httpStatus: 500 },
    );
  }
  if (name === "mock") return createMockCiotProvider();
  if (name === "ipef") return createIpefCiotProvider();
  return createNaoImplementadoCiotProvider();
}

module.exports = {
  createCiotProvider,
  createMockCiotProvider,
  createNaoImplementadoCiotProvider,
  createIpefCiotProvider,
  resolveCiotProviderName,
};
