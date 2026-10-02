const test = require("node:test");
const assert = require("node:assert/strict");
const { requireAdmin } = require("../src/middleware/auth");
const {
  idempotencyKeyFromRequest,
  requestHash,
} = require("../src/services/financeiroIdempotencia");

test("hash idempotente ignora ator e a própria chave", () => {
  const base = { tenantId: 1, clienteId: 2, vendaId: 3, valor: 40 };
  assert.equal(
    requestHash({ ...base, idempotencyKey: "operacao-1", auditActor: { id: 1 } }),
    requestHash({ ...base, idempotencyKey: "operacao-2", auditActor: { id: 9 } }),
  );
  assert.notEqual(requestHash(base), requestHash({ ...base, valor: 41 }));
});

test("Idempotency-Key inválida é rejeitada", () => {
  assert.throws(
    () => idempotencyKeyFromRequest({ get: () => "curta" }),
    (error) => error.code === "IDEMPOTENCY_KEY_INVALIDA" && error.httpStatus === 400,
  );
});

test("exclusão financeira pode ser protegida por requireAdmin", () => {
  let status;
  let body;
  requireAdmin(
    { authUser: { role: "member" } },
    {
      status(value) {
        status = value;
        return this;
      },
      json(value) {
        body = value;
      },
    },
    () => assert.fail("member não deve avançar"),
  );
  assert.equal(status, 403);
  assert.match(body.error, /administradores/i);
});
