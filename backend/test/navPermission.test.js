const test = require("node:test");
const assert = require("node:assert/strict");
const { requireNavKey } = require("../src/middleware/navPermission");

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

test("requireNavKey bloqueia membro sem permissão", () => {
  const mw = requireNavKey("vendas");
  const req = { authUser: { role: "member", navPermissions: ["clientes"] } };
  const res = mockRes();
  let nextCalled = false;
  mw(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
});

test("requireNavKey permite admin", () => {
  const mw = requireNavKey("vendas");
  const req = { authUser: { role: "admin", navPermissions: null } };
  const res = mockRes();
  let nextCalled = false;
  mw(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});
