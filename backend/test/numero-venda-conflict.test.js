const test = require("node:test");
const assert = require("node:assert/strict");
const { isNumeroVendaConflict } = require("../src/application/use-cases/criarVenda");

test("isNumeroVendaConflict reconhece P2002 de numeroVenda", () => {
  assert.equal(isNumeroVendaConflict({ code: "P2002", meta: { target: ["tenantId", "numeroVenda"] } }), true);
  assert.equal(isNumeroVendaConflict({ code: "P2002", meta: { target: "numeroVenda" } }), true);
  assert.equal(isNumeroVendaConflict({ code: "P2002", meta: { target: ["email"] } }), false);
  assert.equal(isNumeroVendaConflict({ code: "P2003" }), false);
  assert.equal(isNumeroVendaConflict(null), false);
});
