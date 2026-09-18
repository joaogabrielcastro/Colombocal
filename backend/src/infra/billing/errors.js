/** Erros de cobrança bancária (sem secrets na mensagem). */
class BankBillingError extends Error {
  constructor(message, { code = "BANK_ERROR", httpStatus = 502, retryable = false } = {}) {
    super(message);
    this.name = "BankBillingError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
  }
}

const CODES = {
  NOT_CONFIGURED: "BANK_NOT_CONFIGURED",
  TIMEOUT: "BANK_TIMEOUT",
  UNAUTHORIZED: "BANK_UNAUTHORIZED",
  FORBIDDEN: "BANK_FORBIDDEN",
  RATE_LIMIT: "BANK_RATE_LIMIT",
  BAD_REQUEST: "BANK_BAD_REQUEST",
  SERVER_ERROR: "BANK_SERVER_ERROR",
  CANCEL_UNSUPPORTED: "BANK_CANCEL_UNSUPPORTED",
  PDF_UNAVAILABLE: "BANK_PDF_UNAVAILABLE",
};

function mapHttpStatusToBankError(status, bodyMessage) {
  const msg = bodyMessage || `Erro do banco (HTTP ${status})`;
  if (status === 400) {
    return new BankBillingError(msg, { code: CODES.BAD_REQUEST, httpStatus: 400 });
  }
  if (status === 401) {
    return new BankBillingError(msg, { code: CODES.UNAUTHORIZED, httpStatus: 401 });
  }
  if (status === 403) {
    return new BankBillingError(msg, { code: CODES.FORBIDDEN, httpStatus: 403 });
  }
  if (status === 429) {
    return new BankBillingError(msg, {
      code: CODES.RATE_LIMIT,
      httpStatus: 429,
      retryable: true,
    });
  }
  if (status >= 500) {
    return new BankBillingError(msg, {
      code: CODES.SERVER_ERROR,
      httpStatus: 502,
      retryable: true,
    });
  }
  return new BankBillingError(msg, { code: CODES.SERVER_ERROR, httpStatus: 502, retryable: true });
}

module.exports = {
  BankBillingError,
  CODES,
  mapHttpStatusToBankError,
};
