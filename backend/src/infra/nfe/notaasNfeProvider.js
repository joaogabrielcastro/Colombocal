const axios = require("axios");
const { AppError } = require("../../shared/errors/appError");
const { INCONCLUSIVE_HTTP } = require("../../domain/nfe/refNfe");

const BASE_URL = "https://platform.notaas.com.br/api/v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapStatusNotaas(value) {
  const status = String(value || "").toLowerCase();
  if (status === "issued") return "autorizada";
  if (status === "cancelled") return "cancelada";
  if (status === "error") return "rejeitada";
  if (status === "inutilized") return "inutilizada";
  return "processando";
}

function normalizeNotaasResponse(data) {
  const raw = data || {};
  const invoiceId = raw.invoiceId || null;
  return {
    status: mapStatusNotaas(raw.status),
    refProvedor: invoiceId,
    serie: raw.serie ?? null,
    numero: raw.numero ?? raw.nNf ?? null,
    chaveAcesso: raw.chaveAcesso || null,
    protocolo: raw.protocolo || raw.nProt || raw.cancelProt || null,
    motivoRejeicao:
      raw.status === "error"
        ? raw.errorMessage || raw.motivo || raw.xMotivo || raw.error || null
        : null,
    xmlUrl: raw.xmlUrl || (invoiceId ? `${BASE_URL}/nfe/invoices/${invoiceId}/xml` : null),
    danfeUrl: raw.pdfUrl || (invoiceId ? `${BASE_URL}/nfe/invoices/${invoiceId}/danfe` : null),
    raw,
  };
}

function messageFrom(data, fallback) {
  return String(data?.error || data?.message || data?.motivo || data?.xMotivo || fallback);
}

function throwFromHttp(res, fallback) {
  if (res.status === 404) {
    throw new AppError("Nota não encontrada no provedor.", {
      code: "NFE_NAO_ENCONTRADA",
      httpStatus: 404,
    });
  }
  const message = messageFrom(res.data, fallback);
  if (INCONCLUSIVE_HTTP.has(res.status)) {
    throw new AppError(message, {
      code: "NFE_PROVEDOR_INDISPONIVEL",
      httpStatus: res.status,
      details: { ...(typeof res.data === "object" ? res.data : {}), cause: `HTTP_${res.status}` },
    });
  }
  throw new AppError(message, {
    code: "NFE_PROVEDOR_ERRO",
    httpStatus: res.status === 401 || res.status === 403 ? 401 : 400,
    details: res.data,
  });
}

function throwFromNetwork(err, fallback) {
  if (err instanceof AppError) throw err;
  throw new AppError(err.response?.data?.error || err.message || fallback, {
    code: "NFE_PROVEDOR_INDISPONIVEL",
    httpStatus: 502,
    details: { cause: err.code || err.cause?.code || "NETWORK" },
  });
}

function safeDocumentUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new AppError("URL de documento fiscal inválida.", {
      code: "NFE_ARQUIVO_URL_INVALIDA",
      httpStatus: 400,
    });
  }
  const validPath = /^\/api\/v1\/nfe\/invoices\/[0-9a-f-]+\/(?:xml|danfe)$/i.test(url.pathname);
  if (url.protocol !== "https:" || url.hostname !== "platform.notaas.com.br" || !validPath || url.username || url.password) {
    throw new AppError("URL de documento fiscal não permitida.", {
      code: "NFE_ARQUIVO_URL_INVALIDA",
      httpStatus: 400,
    });
  }
  return url.toString();
}

function createNotaasNfeProvider({ token, http = axios } = {}) {
  if (!token) {
    throw new AppError(
      "Chave de API da Nôtaas não configurada. Cadastre a chave do projeto em Dados fiscais.",
      { code: "NFE_TOKEN_AUSENTE", httpStatus: 400 },
    );
  }
  const headers = { "x-api-key": token, "Content-Type": "application/json" };

  return {
    name: "notaas",
    async emitir({ payload }) {
      try {
        const res = await http.post(`${BASE_URL}/nfe/emitir`, payload, {
          headers,
          timeout: 45000,
          validateStatus: () => true,
        });
        if (res.status >= 400) throwFromHttp(res, `Nôtaas recusou a emissão (HTTP ${res.status}).`);
        if (!res.data?.invoiceId) {
          throw new AppError("A Nôtaas não retornou o identificador da NF-e.", {
            code: "NFE_PROVEDOR_INDISPONIVEL",
            httpStatus: 502,
            details: { cause: "MISSING_INVOICE_ID" },
          });
        }
        return normalizeNotaasResponse(res.data);
      } catch (err) {
        throwFromNetwork(err, "Falha ao falar com a Nôtaas.");
      }
    },
    async consultar({ ref }) {
      // A API não documenta consulta pela referência do cliente. Sem invoiceId,
      // tratar como incerto é mais seguro do que liberar uma segunda emissão.
      if (!UUID_RE.test(String(ref || ""))) {
        throw new AppError("A emissão pode ter sido aceita, mas o invoiceId da Nôtaas não foi confirmado.", {
          code: "NFE_PROVEDOR_INDISPONIVEL",
          httpStatus: 503,
          details: { cause: "NOTAAS_INVOICE_ID_PENDING" },
        });
      }
      try {
        const res = await http.get(`${BASE_URL}/nfe/invoices/${encodeURIComponent(ref)}/status`, {
          headers,
          timeout: 20000,
          validateStatus: () => true,
        });
        if (res.status >= 400) throwFromHttp(res, `Consulta NF-e falhou (HTTP ${res.status}).`);
        return normalizeNotaasResponse(res.data);
      } catch (err) {
        throwFromNetwork(err, "Falha ao consultar a NF-e na Nôtaas.");
      }
    },
    async cancelar({ ref, justificativa }) {
      try {
        const res = await http.post(`${BASE_URL}/nfe/cancelar`, {
          invoiceId: ref,
          motivo: justificativa,
        }, {
          headers,
          timeout: 30000,
          validateStatus: () => true,
        });
        if (res.status >= 400) throwFromHttp(res, `Cancelamento recusado (HTTP ${res.status}).`);
        return normalizeNotaasResponse({ ...res.data, invoiceId: res.data?.invoiceId || ref, status: res.data?.status || "processing" });
      } catch (err) {
        throwFromNetwork(err, "Falha ao cancelar a NF-e na Nôtaas.");
      }
    },
    async baixarArquivo(caminho) {
      if (!caminho) return null;
      const url = safeDocumentUrl(caminho);
      try {
        const res = await http.get(url, {
          headers: { "x-api-key": token },
          responseType: "arraybuffer",
          timeout: 30000,
          maxRedirects: 0,
          validateStatus: () => true,
        });
        if (res.status >= 400) throwFromHttp(res, `Download fiscal falhou (HTTP ${res.status}).`);
        return {
          buffer: Buffer.from(res.data),
          contentType: res.headers?.["content-type"] || "application/octet-stream",
        };
      } catch (err) {
        throwFromNetwork(err, "Falha ao baixar documento fiscal da Nôtaas.");
      }
    },
  };
}

module.exports = {
  BASE_URL,
  createNotaasNfeProvider,
  mapStatusNotaas,
  normalizeNotaasResponse,
  safeDocumentUrl,
};
