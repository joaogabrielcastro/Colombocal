const { AppError } = require("../../shared/errors/appError");

function allowedOrigins(baseURL) {
  const configured = String(process.env.FOCUS_NFE_DOWNLOAD_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([baseURL, ...configured].map((value) => new URL(value).origin));
}

function resolveFocusDownloadUrl(caminho, baseURL) {
  if (!caminho) return null;
  let url;
  try {
    url = new URL(String(caminho), `${baseURL}/`);
  } catch {
    throw new AppError("URL de arquivo fiscal invÃ¡lida.", {
      code: "FISCAL_ARQUIVO_URL_INVALIDA",
      httpStatus: 400,
    });
  }
  if (url.protocol !== "https:" || !allowedOrigins(baseURL).has(url.origin)) {
    throw new AppError("Origem do arquivo fiscal nÃ£o autorizada.", {
      code: "FISCAL_ARQUIVO_ORIGEM_INVALIDA",
      httpStatus: 400,
    });
  }
  url.username = "";
  url.password = "";
  return url.toString();
}

module.exports = { resolveFocusDownloadUrl };
