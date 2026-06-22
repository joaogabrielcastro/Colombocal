const test = require("node:test");
const assert = require("node:assert/strict");
const { isValidCpf, normalizeCpf } = require("../src/utils/cpf");
const { tenantAllowsClienteCpf, tenantAllowsFrete } = require("../src/constants/tenantFeatures");

test("isValidCpf: aceita CPF válido", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
});

test("isValidCpf: rejeita sequência repetida", () => {
  assert.equal(isValidCpf("111.111.111-11"), false);
});

test("isValidCpf: rejeita tamanho incorreto", () => {
  assert.equal(isValidCpf("123"), false);
});

test("normalizeCpf: retorna só dígitos", () => {
  assert.equal(normalizeCpf("529.982.247-25"), "52998224725");
});

test("tenantAllowsClienteCpf: respeita CLIENT_CPF_TENANT_SLUGS", () => {
  const prev = process.env.CLIENT_CPF_TENANT_SLUGS;
  process.env.CLIENT_CPF_TENANT_SLUGS = "requinte, outra";
  try {
    assert.equal(tenantAllowsClienteCpf("requinte"), true);
    assert.equal(tenantAllowsClienteCpf("default"), false);
  } finally {
    if (prev === undefined) delete process.env.CLIENT_CPF_TENANT_SLUGS;
    else process.env.CLIENT_CPF_TENANT_SLUGS = prev;
  }
});

test("tenantAllowsFrete: requinte sem frete por padrão", () => {
  assert.equal(tenantAllowsFrete("requinte"), false);
  assert.equal(tenantAllowsFrete("default"), true);
});
