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

/** Meia-noite UTC → meio-dia UTC (evita dia anterior em America/Sao_Paulo). */
function calendarDateAtUtcNoon(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0, 0));
}

/** Soma dias em calendário UTC (compatível com datas à meia-noite/meio-dia UTC). */
function addDaysCalendar(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  // Normaliza para meio-dia UTC se veio de data de calendário.
  if (
    (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) ||
    (d.getUTCHours() === 12 && d.getUTCMinutes() === 0)
  ) {
    return calendarDateAtUtcNoon(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
    );
  }
  return d;
}

function isUtcMidnight(date) {
  return (
    date instanceof Date &&
    !Number.isNaN(date.getTime()) &&
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

function parseDateField(value, fieldName, { required = false } = {}) {
  if (value == null || value === "") {
    if (required) throw validationError(`${fieldName} é obrigatório`);
    return null;
  }

  // Date já coercido (ex.: Zod) com meia-noite UTC = data de calendário.
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw validationError(`${fieldName} inválida`);
    }
    if (isUtcMidnight(value)) {
      return calendarDateAtUtcNoon(
        value.getUTCFullYear(),
        value.getUTCMonth(),
        value.getUTCDate(),
      );
    }
    return value;
  }

  const raw = String(value).trim();
  // Apenas data (YYYY-MM-DD): evitar new Date("...") = meia-noite UTC, que no Brasil vira o dia anterior.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    const date = calendarDateAtUtcNoon(y, m - 1, d);
    if (Number.isNaN(date.getTime())) {
      throw validationError(`${fieldName} inválida`);
    }
    return date;
  }

  // ISO com T00:00:00.000Z (mesmo problema do coerce).
  const isoMidnight = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.000)?(?:Z)?$/,
  );
  if (isoMidnight) {
    const y = Number(isoMidnight[1]);
    const m = Number(isoMidnight[2]);
    const d = Number(isoMidnight[3]);
    return calendarDateAtUtcNoon(y, m - 1, d);
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw validationError(`${fieldName} inválida`);
  }
  if (isUtcMidnight(date)) {
    return calendarDateAtUtcNoon(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    );
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
  calendarDateAtUtcNoon,
  addDaysCalendar,
  ensureArray,
  ensureEnum,
};
