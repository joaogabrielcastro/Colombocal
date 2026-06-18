const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getRegistrationTenantSlugs,
  resolveRegistrationTenantSlug,
} = require("../src/utils/registrationTenants");

const tenants = [
  { id: 1, slug: "default", name: "Colombocal" },
  { id: 2, slug: "requinte", name: "Requinte" },
];

test("getRegistrationTenantSlugs: usa REGISTRATION_TENANT_SLUGS quando definido", () => {
  const prev = process.env.REGISTRATION_TENANT_SLUGS;
  process.env.REGISTRATION_TENANT_SLUGS = "default, requinte";
  try {
    assert.deepEqual(getRegistrationTenantSlugs(), ["default", "requinte"]);
  } finally {
    if (prev === undefined) delete process.env.REGISTRATION_TENANT_SLUGS;
    else process.env.REGISTRATION_TENANT_SLUGS = prev;
  }
});

test("resolveRegistrationTenantSlug: com uma org não exige escolha", () => {
  assert.equal(
    resolveRegistrationTenantSlug({}, [tenants[0]]),
    "default",
  );
});

test("resolveRegistrationTenantSlug: com várias orgs exige tenantSlug", () => {
  assert.throws(
    () => resolveRegistrationTenantSlug({}, tenants),
    (err) => err.statusCode === 400,
  );
  assert.equal(
    resolveRegistrationTenantSlug({ tenantSlug: "requinte" }, tenants),
    "requinte",
  );
});

test("resolveRegistrationTenantSlug: rejeita slug fora da lista", () => {
  assert.throws(
    () => resolveRegistrationTenantSlug({ tenantSlug: "outra" }, tenants),
    (err) => err.statusCode === 400,
  );
});
