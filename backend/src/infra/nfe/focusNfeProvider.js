const axios = require("axios");
const { mapStatusFocus } = require("../../domain/nfe/montarPayload");
const { AppError } = require("../../shared/errors/appError");

function focusBaseUrl(ambiente) {
  if (String(ambiente).toLowerCase() === "producao") {
    return "https://api.focusnfe.com.br";
  }
  return "https://homologacao.focusnfe.com.br";
}

function authHeader(token) {
  const encoded = Buffer.from(`${token}:`).toString("base64");
  return { Authorization: `Basic ${encoded}` };
}

function normalizeFocusResponse(data) {
  const raw = data || {};
  return {
    status: mapStatusFocus(raw.status),
    serie: raw.serie ?? raw.serie_nfe ?? null,
    numero: raw.numero ?? raw.numero_nfe ?? null,
    chaveAcesso: raw.chave_nfe || raw.chave_nfe_completa || null,
    protocolo: raw.protocolo_nfe || raw.protocolo || null,
    motivoRejeicao: raw.mensagem_sefaz || raw.status_sefaz || raw.erros?.[0]?.mensagem || null,
    xmlUrl: raw.caminho_xml_nota_fiscal || raw.caminho_xml || null,
    danfeUrl: raw.caminho_danfe || null,
    raw,
  };
}

function createFocusNfeProvider({ token, ambiente }) {
  if (!token) {
    throw new AppError(
      "Token do provedor Focus NFe não configurado. Cadastre em Dados fiscais ou defina FOCUS_NFE_TOKEN.",
      { code: "NFE_TOKEN_AUSENTE", httpStatus: 400 },
    );
  }
  const baseURL = focusBaseUrl(ambiente);
  const headers = { ...authHeader(token), "Content-Type": "application/json" };

  return {
    name: "focusnfe",
    async emitir({ ref, payload }) {
      try {
        const res = await axios.post(`${baseURL}/v2/nfe`, payload, {
          params: { ref },
          headers,
          timeout: 45000,
          validateStatus: () => true,
        });
        if (res.status >= 400 && res.status !== 422) {
          const msg =
            res.data?.mensagem ||
            res.data?.erro ||
            res.data?.codigo ||
            `Focus NFe recusou a emissão (HTTP ${res.status}).`;
          throw new AppError(String(msg), {
            code: "NFE_PROVEDOR_ERRO",
            httpStatus: res.status === 401 ? 401 : 400,
            details: res.data,
          });
        }
        return normalizeFocusResponse(res.data);
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(
          err.response?.data?.mensagem || err.message || "Falha ao falar com o provedor NF-e.",
          { code: "NFE_PROVEDOR_ERRO", httpStatus: 502 },
        );
      }
    },
    async consultar({ ref }) {
      try {
        const res = await axios.get(`${baseURL}/v2/nfe/${encodeURIComponent(ref)}`, {
          headers,
          timeout: 20000,
          validateStatus: () => true,
        });
        if (res.status === 404) {
          throw new AppError("Nota não encontrada no provedor.", {
            code: "NFE_NAO_ENCONTRADA",
            httpStatus: 404,
          });
        }
        if (res.status >= 400) {
          throw new AppError(
            res.data?.mensagem || `Consulta NF-e falhou (HTTP ${res.status}).`,
            { code: "NFE_PROVEDOR_ERRO", httpStatus: 400, details: res.data },
          );
        }
        return normalizeFocusResponse(res.data);
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err.message || "Falha ao consultar o provedor NF-e.", {
          code: "NFE_PROVEDOR_ERRO",
          httpStatus: 502,
        });
      }
    },
    async cancelar({ ref, justificativa }) {
      try {
        const res = await axios.delete(`${baseURL}/v2/nfe/${encodeURIComponent(ref)}`, {
          headers,
          data: { justificativa },
          timeout: 30000,
          validateStatus: () => true,
        });
        if (res.status >= 400) {
          throw new AppError(
            res.data?.mensagem_sefaz ||
              res.data?.mensagem ||
              `Cancelamento recusado (HTTP ${res.status}).`,
            { code: "NFE_CANCELAMENTO_ERRO", httpStatus: 400, details: res.data },
          );
        }
        return normalizeFocusResponse({ ...res.data, status: res.data?.status || "cancelado" });
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(err.message || "Falha ao cancelar NF-e no provedor.", {
          code: "NFE_PROVEDOR_ERRO",
          httpStatus: 502,
        });
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

module.exports = { createFocusNfeProvider, focusBaseUrl };
