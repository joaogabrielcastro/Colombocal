class AppError extends Error {
  constructor(message, { code = "APP_ERROR", httpStatus = 400, details } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus;
    if (details !== undefined) this.details = details;
  }
}

module.exports = { AppError };
