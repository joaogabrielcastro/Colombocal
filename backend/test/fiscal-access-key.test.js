const test = require("node:test");
const assert = require("node:assert/strict");
const { isValidFiscalAccessKey } = require("../src/utils/fiscalAccessKey");
const { mdfeEmitirSchema } = require("../src/schemas/mdfe");

const VALID_KEY = "35260911222333000181550010000001251000001251";

test("valida chave fiscal de 44 dígitos e seu dígito verificador", () => {
  assert.equal(isValidFiscalAccessKey(VALID_KEY), true);
  assert.equal(isValidFiscalAccessKey(`${VALID_KEY.slice(0, 43)}0`), false);
  assert.equal(isValidFiscalAccessKey(VALID_KEY.slice(0, 43)), false);
  assert.equal(isValidFiscalAccessKey(`A${VALID_KEY.slice(1)}`), false);
});

test("schema do MDF-e rejeita chave inventada e aceita chave válida", () => {
  const base = {
    emitenteFiscalId: 1,
    ufInicio: "PR",
    ufFim: "SC",
    veiculoPlaca: "ABC1D23",
  };
  assert.equal(
    mdfeEmitirSchema.safeParse({
      ...base,
      documentos: [{ tipo: "nfe", chaveAcesso: VALID_KEY }],
    }).success,
    true,
  );
  assert.equal(
    mdfeEmitirSchema.safeParse({
      ...base,
      documentos: [{ tipo: "nfe", chaveAcesso: "1".repeat(44) }],
    }).success,
    false,
  );
});
