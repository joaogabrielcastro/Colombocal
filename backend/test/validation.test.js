const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseIntField,
  parseNumberField,
  parseDateField,
  parseRequiredString,
  parseOptionalString,
  ensureArray,
  ensureEnum,
  validationError,
} = require("../src/utils/validation");

// parseIntField
test("parseIntField: retorna número inteiro válido", () => {
  assert.equal(parseIntField("42", "campo"), 42);
  assert.equal(parseIntField(7, "campo"), 7);
});

test("parseIntField: lança 400 para valor inválido", () => {
  assert.throws(
    () => parseIntField("abc", "campo"),
    (err) => err.statusCode === 400,
  );
});

test("parseIntField: lança 400 para valor vazio quando obrigatório", () => {
  assert.throws(
    () => parseIntField("", "campo"),
    (err) => err.statusCode === 400,
  );
  assert.throws(
    () => parseIntField(null, "campo"),
    (err) => err.statusCode === 400,
  );
});

test("parseIntField: retorna null quando não obrigatório e vazio", () => {
  assert.equal(parseIntField("", "campo", { required: false }), null);
  assert.equal(parseIntField(null, "campo", { required: false }), null);
});

test("parseIntField: lança 400 quando valor abaixo do mínimo", () => {
  assert.throws(
    () => parseIntField("0", "id", { min: 1 }),
    (err) => err.statusCode === 400,
  );
});

test("parseIntField: aceita valor igual ao mínimo", () => {
  assert.equal(parseIntField("1", "id", { min: 1 }), 1);
});

// parseNumberField
test("parseNumberField: retorna número de ponto flutuante", () => {
  assert.equal(parseNumberField("3.14", "campo"), 3.14);
  assert.equal(parseNumberField(0, "campo", { min: 0 }), 0);
});

test("parseNumberField: lança 400 para valor inválido", () => {
  assert.throws(
    () => parseNumberField("xyz", "campo"),
    (err) => err.statusCode === 400,
  );
});

test("parseNumberField: retorna null quando não obrigatório e vazio", () => {
  assert.equal(parseNumberField("", "campo", { required: false }), null);
});

test("parseNumberField: lança 400 quando abaixo do mínimo", () => {
  assert.throws(
    () => parseNumberField("-1", "valor", { min: 0 }),
    (err) => err.statusCode === 400,
  );
});

// parseDateField
test("parseDateField: retorna Date para string válida", () => {
  const d = parseDateField("2024-01-15", "data");
  assert.ok(d instanceof Date);
  assert.equal(d.toISOString(), "2024-01-15T12:00:00.000Z");
});

test("parseDateField: YYYY-MM-DD no fim do mês não vira dia anterior (UTC-3)", () => {
  const d = parseDateField("2026-06-29", "dataVenda");
  assert.equal(d.toISOString(), "2026-06-29T12:00:00.000Z");
  // Em America/Sao_Paulo (UTC-3) o dia civil continua 29.
  const br = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  assert.equal(br, "2026-06-29");
});

test("parseDateField: Date em meia-noite UTC vira meio-dia UTC", () => {
  const midnight = new Date("2026-06-29T00:00:00.000Z");
  const d = parseDateField(midnight, "dataVenda");
  assert.equal(d.toISOString(), "2026-06-29T12:00:00.000Z");
});

test("parseDateField: ISO meia-noite UTC vira meio-dia UTC", () => {
  const d = parseDateField("2026-06-29T00:00:00.000Z", "dataVenda");
  assert.equal(d.toISOString(), "2026-06-29T12:00:00.000Z");
});

test("parseDateField: lança 400 para data inválida", () => {
  assert.throws(
    () => parseDateField("not-a-date", "data"),
    (err) => err.statusCode === 400,
  );
});

test("parseDateField: retorna null quando não obrigatório e ausente", () => {
  assert.equal(parseDateField(null, "data"), null);
  assert.equal(parseDateField("", "data"), null);
});

test("parseDateField: lança 400 quando obrigatório e ausente", () => {
  assert.throws(
    () => parseDateField("", "data", { required: true }),
    (err) => err.statusCode === 400,
  );
});

test("parseDateField: aceita data-hora ISO completa", () => {
  const d = parseDateField("2024-03-10T08:30:00.000Z", "data");
  assert.ok(d instanceof Date);
  assert.equal(d.toISOString(), "2024-03-10T08:30:00.000Z");
});

// ensureEnum
test("ensureEnum: aceita valor permitido", () => {
  assert.equal(ensureEnum("a", "campo", ["a", "b"]), "a");
});

test("ensureEnum: lança 400 para valor não permitido", () => {
  assert.throws(
    () => ensureEnum("c", "campo", ["a", "b"]),
    (err) => err.statusCode === 400,
  );
});

test("validationError: cria erro com statusCode 400", () => {
  const err = validationError("falhou");
  assert.equal(err.statusCode, 400);
  assert.equal(err.message, "falhou");
});

// ensureArray
test("ensureArray: aceita array com tamanho mínimo", () => {
  const arr = ensureArray([1, 2, 3], "lista", { minLength: 1 });
  assert.deepEqual(arr, [1, 2, 3]);
});

test("ensureArray: lança 400 para não-array", () => {
  assert.throws(
    () => ensureArray("string", "lista"),
    (err) => err.statusCode === 400,
  );
});

test("ensureArray: lança 400 quando abaixo do mínimo", () => {
  assert.throws(
    () => ensureArray([], "itens", { minLength: 1 }),
    (err) => err.statusCode === 400,
  );
});

test("parseRequiredString: recusa vazio e não-string", () => {
  assert.equal(parseRequiredString("  João  ", "nome"), "João");
  assert.throws(
    () => parseRequiredString("", "nome"),
    (err) => err.statusCode === 400,
  );
  assert.throws(
    () => parseRequiredString({ x: 1 }, "nome"),
    (err) => err.statusCode === 400,
  );
});

test("parseOptionalString: aceita vazio e recusa tipo inválido", () => {
  assert.equal(parseOptionalString(null, "tel"), null);
  assert.equal(parseOptionalString("  41  ", "tel"), "41");
  assert.throws(
    () => parseOptionalString(12, "tel"),
    (err) => err.statusCode === 400,
  );
});
