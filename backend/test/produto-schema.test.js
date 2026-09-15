const test = require("node:test");
const assert = require("node:assert/strict");
const {
  produtoCreateSchema,
  produtoUpdateSchema,
} = require("../src/schemas/produto");

test("produtoCreateSchema exige nome e preço >= 0", () => {
  const ok = produtoCreateSchema.safeParse({
    nome: "Cal",
    precoPadrao: 10,
  });
  assert.equal(ok.success, true);
  assert.equal(ok.data.unidade, "ton");

  const semNome = produtoCreateSchema.safeParse({ precoPadrao: 10 });
  assert.equal(semNome.success, false);

  const precoNeg = produtoCreateSchema.safeParse({
    nome: "Cal",
    precoPadrao: -1,
  });
  assert.equal(precoNeg.success, false);
});

test("produtoUpdateSchema aceita reativação e ignora campos extras", () => {
  const parsed = produtoUpdateSchema.safeParse({
    id: 99,
    tenantId: 1,
    ativo: true,
    nome: "Cal",
    precoPadrao: 12.5,
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.ativo, true);
  assert.equal(parsed.data.precoPadrao, 12.5);
  assert.equal(parsed.data.id, undefined);
});
