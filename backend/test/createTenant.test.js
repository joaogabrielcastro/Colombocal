const test = require("node:test");
const assert = require("node:assert/strict");
const {
  slugify,
  normalizeSlug,
  validateTenantAdminInput,
} = require("../src/services/createTenant");

test("slugify: normaliza nome com acentos e espaços", () => {
  assert.equal(slugify("Distribuidora São Paulo"), "distribuidora-sao-paulo");
  assert.equal(slugify("  A & B  "), "a-b");
});

test("normalizeSlug: gera slug a partir do nome quando omitido", () => {
  assert.equal(normalizeSlug(null, "Minha Empresa"), "minha-empresa");
});

test("normalizeSlug: rejeita slug reservado", () => {
  assert.throws(
    () => normalizeSlug("default", "X"),
    (err) => err.statusCode === 400,
  );
});

test("normalizeSlug: rejeita caracteres inválidos", () => {
  assert.throws(
    () => normalizeSlug("Org_Nova", "X"),
    (err) => err.statusCode === 400,
  );
});

test("validateTenantAdminInput: exige campos obrigatórios", () => {
  assert.throws(
    () => validateTenantAdminInput({ tenantName: "", email: "a@b.com", password: "123456" }),
    (err) => err.statusCode === 400,
  );
  assert.throws(
    () => validateTenantAdminInput({ tenantName: "Org", email: "", password: "123456" }),
    (err) => err.statusCode === 400,
  );
  assert.throws(
    () => validateTenantAdminInput({ tenantName: "Org", email: "a@b.com", password: "12" }),
    (err) => err.statusCode === 400,
  );
});

test("validateTenantAdminInput: normaliza e-mail", () => {
  const out = validateTenantAdminInput({
    tenantName: " Org ",
    email: " Admin@Exemplo.COM ",
    password: "123456",
  });
  assert.equal(out.email, "admin@exemplo.com");
  assert.equal(out.tenantName, "Org");
});
