class AppError extends Error {
  constructor(message, { code = "APP_ERROR", httpStatus = 400 } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

module.exports = { AppError };
