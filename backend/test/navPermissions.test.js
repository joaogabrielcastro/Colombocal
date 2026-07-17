const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeNavPermissions,
  userHasNavKey,
  normalizeNavKey,
} = require("../src/constants/navPermissions");

test("normalizeNavPermissions migra cheques e rel_titulos", () => {
  assert.deepEqual(normalizeNavPermissions(["cheques", "vendas", "rel_titulos"]), [
    "financeiro",
    "vendas",
    "rel_financeiro",
  ]);
});

test("userHasNavKey aceita alias legado cheques", () => {
  const user = { role: "member", navPermissions: ["cheques"] };
  assert.equal(userHasNavKey(user, "financeiro"), true);
  assert.equal(normalizeNavKey("cheques"), "financeiro");
});

test("userHasNavKey: admin sempre pode", () => {
  assert.equal(userHasNavKey({ role: "admin" }, "auditoria"), true);
});
