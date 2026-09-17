const { STATUS, mapStatusFocus } = require("../../domain/mdfe/constants");
const { AppError } = require("../../shared/errors/appError");
const { INCONCLUSIVE_HTTP } = require("../../domain/nfe/refNfe");
const { focusBaseUrl } = require("../nfe/focusNfeProvider");

function authHeader(token) {
  return { Authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}` };
}

function mensagemFocus(data, fallback) {
  return data?.mensagem || data?.erro || data?.mensagem_sefaz || data?.codigo || fallback;
}

function normalizeFocusResponse(data) {
  const raw = data || {};
  return {
    status: mapStatusFocus(raw.status),
    serie: raw.serie ?? null,
    numero: raw.numero ?? null,
    chaveAcesso: raw.chave_mdfe || raw.chave || null,
    protocolo: raw.protocolo || null,
    motivoRejeicao: raw.mensagem_sefaz || raw.status_sefaz || null,
    xmlUrl: raw.caminho_xml || raw.caminho_xml_mdfe || null,
    damdfeUrl: raw.caminho_damdfe || raw.caminho_danfe || null,
    raw,
  };
}

function createFocusMdfeProvider({ token, ambiente }) {
  if (!token) {
    throw new AppError("Token Focus NFe não configurado para MDF-e.", {
      code: "MDFE_TOKEN_AUSENTE",
      httpStatus: 400,
    });
  }
  const axios = require("axios");
  const baseURL = focusBaseUrl(ambiente);
  const headers = { ...authHeader(token), "Content-Type": "application/json" };

  function throwFromFocusHttp(res, fallbackMsg) {
    const status = res.status;
    const msg = String(mensagemFocus(res.data, fallbackMsg));
    if (status === 404) {
      throw new AppError("MDF-e não encontrado no provedor.", {
        code: "MDFE_NAO_ENCONTRADO",
        httpStatus: 404,
      });
    }
    if (INCONCLUSIVE_HTTP.has(status)) {
      throw new AppError(msg, {
        code: "MDFE_PROVEDOR_INDISPONIVEL",
        httpStatus: status,
        details: { cause: `HTTP_${status}` },
      });
    }
    throw new AppError(msg, {
      code: "MDFE_PROVEDOR_ERRO",
      httpStatus: status === 401 ? 401 : 400,
      details: res.data,
    });
  }

  function throwFromNetwork(err, fallbackMsg) {
    if (err instanceof AppError) throw err;
    throw new AppError(err.message || fallbackMsg, {
      code: "MDFE_PROVEDOR_INDISPONIVEL",
      httpStatus: 502,
      details: { cause: err.code || "NETWORK" },
    });
  }

  return {
    name: "focusnfe",
    supports: {
      emitir: true,
      consultar: true,
      cancelar: true,
      encerrar: true,
      xml: true,
      damdfe: true,
    },
    async emitir({ ref, payload }) {
      try {
        const res = await axios.post(`${baseURL}/v2/mdfe`, payload, {
          params: { ref },
          headers,
          timeout: 45000,
          validateStatus: () => true,
        });
        if (res.status >= 400 && res.status !== 422) {
          throwFromFocusHttp(res, `Focus recusou MDF-e (HTTP ${res.status}).`);
        }
        return normalizeFocusResponse(res.data);
      } catch (err) {
        throwFromNetwork(err, "Falha ao emitir MDF-e.");
      }
    },
    async consultar({ ref }) {
      try {
        const res = await axios.get(`${baseURL}/v2/mdfe/${encodeURIComponent(ref)}`, {
          headers,
          timeout: 20000,
          validateStatus: () => true,
        });
        if (res.status >= 400) throwFromFocusHttp(res, `Consulta MDF-e falhou.`);
        return normalizeFocusResponse(res.data);
      } catch (err) {
        throwFromNetwork(err, "Falha ao consultar MDF-e.");
      }
    },
    async cancelar({ ref, justificativa }) {
      try {
        const res = await axios.delete(`${baseURL}/v2/mdfe/${encodeURIComponent(ref)}`, {
          headers,
          data: { justificativa },
          timeout: 30000,
          validateStatus: () => true,
        });
        if (res.status >= 400) throwFromFocusHttp(res, `Cancelamento MDF-e recusado.`);
        return normalizeFocusResponse({ ...res.data, status: res.data?.status || "cancelado" });
      } catch (err) {
        throwFromNetwork(err, "Falha ao cancelar MDF-e.");
      }
    },
    async encerrar({ ref, data, sigla_uf, nome_municipio }) {
      try {
        const res = await axios.post(
          `${baseURL}/v2/mdfe/${encodeURIComponent(ref)}/encerrar`,
          { data, sigla_uf, nome_municipio },
          { headers, timeout: 30000, validateStatus: () => true },
        );
        if (res.status >= 400) throwFromFocusHttp(res, `Encerramento MDF-e recusado.`);
        return normalizeFocusResponse({ ...res.data, status: res.data?.status || "encerrado" });
      } catch (err) {
        throwFromNetwork(err, "Falha ao encerrar MDF-e.");
      }
    },
    async baixarArquivo(caminhoRelativo) {
      if (!caminhoRelativo) return null;
      const url = caminhoRelativo.startsWith("http")
        ? caminhoRelativo
        : `${baseURL}${caminhoRelativo.startsWith("/") ? "" : "/"}${caminhoRelativo}`;
      const res = await axios.get(url, {
        headers: authHeader(token),
        responseType: "arraybuffer",
        timeout: 30000,
      });
      return {
        buffer: Buffer.from(res.data),
        contentType: res.headers["content-type"] || "application/octet-stream",
      };
    },
  };
}

function createMockMdfeProvider(overrides = {}) {
  const store = overrides.store || new Map();
  return {
    name: "mock",
    supports: {
      emitir: true,
      consultar: true,
      cancelar: true,
      encerrar: true,
      xml: true,
      damdfe: true,
    },
    store,
    async emitir({ ref, payload }) {
      if (overrides.emitir) return overrides.emitir({ ref, payload });
      const numero = store.size + 1;
      const result = {
        status: STATUS.AUTORIZADA,
        serie: 1,
        numero,
        chaveAcesso: String(ref || "0").replace(/\D/g, "").padEnd(44, "0").slice(0, 44),
        protocolo: `MOCK-MDFE-${numero}`,
        xmlUrl: null,
        damdfeUrl: null,
        raw: { mock: true, ref, status: "autorizado", demonstracao: true },
      };
      store.set(ref, { ...result, payload });
      return result;
    },
    async consultar({ ref }) {
      const found = store.get(ref);
      if (!found) {
        const err = new Error("MDF-e mock não encontrado");
        err.httpStatus = 404;
        err.code = "MDFE_NAO_ENCONTRADO";
        throw err;
      }
      return found;
    },
    async cancelar({ ref, justificativa }) {
      const found = store.get(ref) || {};
      const result = {
        ...found,
        status: STATUS.CANCELADA,
        raw: { mock: true, ref, status: "cancelado", justificativa },
      };
      store.set(ref, result);
      return result;
    },
    async encerrar({ ref, data, sigla_uf, nome_municipio }) {
      const found = store.get(ref) || {};
      const result = {
        ...found,
        status: STATUS.ENCERRADA,
        raw: {
          mock: true,
          ref,
          status: "encerrado",
          data,
          sigla_uf,
          nome_municipio,
        },
      };
      store.set(ref, result);
      return result;
    },
    async baixarArquivo() {
      return null;
    },
  };
}

function resolveMdfeProviderName() {
  const raw = String(process.env.MDFE_PROVIDER || process.env.NFE_PROVIDER || "")
    .trim()
    .toLowerCase();
  if (raw === "mock" || raw === "focusnfe") return raw;
  if (process.env.NODE_ENV === "test") return "mock";
  return "focusnfe";
}

function createMdfeProvider({ emitente } = {}) {
  const { resolveProvedorTokenPlain } = require("../crypto/fiscalTokenCrypto");
  const name = resolveMdfeProviderName();
  if (name === "mock") return createMockMdfeProvider();
  let tokenFromDb = null;
  try {
    tokenFromDb = resolveProvedorTokenPlain(emitente?.provedorToken);
  } catch {
    tokenFromDb = null;
  }
  const token =
    (tokenFromDb && String(tokenFromDb).trim()) ||
    String(process.env.FOCUS_NFE_TOKEN || "").trim() ||
    null;
  const ambiente =
    emitente?.ambiente || process.env.FOCUS_NFE_AMBIENTE || "homologacao";
  return createFocusMdfeProvider({ token, ambiente });
}

module.exports = {
  createMdfeProvider,
  createFocusMdfeProvider,
  createMockMdfeProvider,
  resolveMdfeProviderName,
};
