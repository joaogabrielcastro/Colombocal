function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function parseIntField(value, fieldName, { required = true, min = null } = {}) {
  if (value == null || value === "") {
    if (!required) return null;
    throw validationError(`${fieldName} é obrigatório`);
  }
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw validationError(`${fieldName} inválido`);
  }
  if (min != null && parsed < min) {
    throw validationError(`${fieldName} deve ser >= ${min}`);
  }
  return parsed;
}

function parseNumberField(
  value,
  fieldName,
  { required = true, min = null } = {},
) {
  if (value == null || value === "") {
    if (!required) return null;
    throw validationError(`${fieldName} é obrigatório`);
  }
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed)) {
    throw validationError(`${fieldName} inválido`);
  }
  if (min != null && parsed < min) {
    throw validationError(`${fieldName} deve ser >= ${min}`);
  }
  return parsed;
}

function parseDateField(value, fieldName, { required = false } = {}) {
  if (!value) {
    if (required) throw validationError(`${fieldName} é obrigatório`);
    return null;
  }
  const raw = String(value).trim();
  // Apenas data (YYYY-MM-DD): evitar new Date("...") = meia-noite UTC, que no Brasil vira o dia anterior.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
    if (Number.isNaN(date.getTime())) {
      throw validationError(`${fieldName} inválida`);
    }
    return date;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw validationError(`${fieldName} inválida`);
  }
  return date;
}

function ensureArray(value, fieldName, { minLength = 0 } = {}) {
  if (!Array.isArray(value)) {
    throw validationError(`${fieldName} deve ser uma lista`);
  }
  if (value.length < minLength) {
    throw validationError(`${fieldName} deve ter ao menos ${minLength} item(ns)`);
  }
  return value;
}

function ensureEnum(value, fieldName, allowedValues) {
  if (!allowedValues.includes(value)) {
    throw validationError(`${fieldName} inválido`);
  }
  return value;
}

module.exports = {
  validationError,
  parseIntField,
  parseNumberField,
  parseDateField,
  ensureArray,
  ensureEnum,
};
