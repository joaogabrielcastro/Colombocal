const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseIntField,
  parseNumberField,
  parseDateField,
  ensureArray,
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

// parseDateField
test("parseDateField: retorna Date para string válida", () => {
  const d = parseDateField("2024-01-15", "data");
  assert.ok(d instanceof Date);
  assert.ok(!Number.isNaN(d.getTime()));
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
