const test = require("node:test");
const assert = require("node:assert/strict");
const { isValidCpf, normalizeCpf } = require("../src/utils/cpf");
const {
  tenantAllowsClienteCpf,
  tenantAllowsFrete,
  getNoFreteTenantSlugs,
  getClientCpfTenantSlugs,
} = require("../src/constants/tenantFeatures");
const { labelTipoAuditoria } = require("../src/constants/auditoriaTipos");

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
  assert.equal(tenantAllowsFrete(""), true);
  assert.equal(tenantAllowsFrete(null), true);
});

test("tenantAllowsClienteCpf: false sem env e para slug vazio", () => {
  const prev = process.env.CLIENT_CPF_TENANT_SLUGS;
  delete process.env.CLIENT_CPF_TENANT_SLUGS;
  try {
    assert.equal(tenantAllowsClienteCpf("requinte"), false);
    assert.equal(tenantAllowsClienteCpf(""), false);
    assert.deepEqual(getClientCpfTenantSlugs(), []);
  } finally {
    if (prev !== undefined) process.env.CLIENT_CPF_TENANT_SLUGS = prev;
  }
});

test("getNoFreteTenantSlugs: mescla env com padrão", () => {
  const prev = process.env.NO_FRETE_TENANT_SLUGS;
  process.env.NO_FRETE_TENANT_SLUGS = "outra;mais";
  try {
    const slugs = getNoFreteTenantSlugs();
    assert.ok(slugs.includes("requinte"));
    assert.ok(slugs.includes("outra"));
    assert.ok(slugs.includes("mais"));
    assert.equal(tenantAllowsFrete("outra"), false);
  } finally {
    if (prev === undefined) delete process.env.NO_FRETE_TENANT_SLUGS;
    else process.env.NO_FRETE_TENANT_SLUGS = prev;
  }
});

test("getNoFreteTenantSlugs: apenas padrão sem env", () => {
  const prev = process.env.NO_FRETE_TENANT_SLUGS;
  delete process.env.NO_FRETE_TENANT_SLUGS;
  try {
    assert.deepEqual(getNoFreteTenantSlugs(), ["requinte"]);
  } finally {
    if (prev !== undefined) process.env.NO_FRETE_TENANT_SLUGS = prev;
  }
});

test("labelTipoAuditoria: usa rótulo conhecido e formata desconhecido", () => {
  assert.equal(labelTipoAuditoria("VENDA_CRIADA"), "Venda criada");
  assert.equal(labelTipoAuditoria(""), "");
  assert.equal(labelTipoAuditoria(null), "");
  assert.equal(labelTipoAuditoria("ALGO_NOVO_AQUI"), "Algo Novo Aqui");
});
