const test = require("node:test");
const assert = require("node:assert/strict");
const { agent, prisma, resetDb } = require("../helpers/testServer");

const SECRET = "test-setup-secret-abc";

test.beforeEach(async () => {
  await resetDb();
});

test("GET /api/setup/status reflete banco vazio", async () => {
  const res = await agent.get("/api/setup/status");
  assert.equal(res.status, 200);
  assert.equal(res.body.setupEnabled, true);
  assert.equal(res.body.databaseReady, true);
  assert.equal(res.body.needsBootstrap, true);
});

test("POST /api/setup/first-admin cria admin e depois bloqueia", async () => {
  const secretErrado = await agent
    .post("/api/setup/first-admin")
    .send({ setupSecret: "errado", email: "a@e.com", password: "segredo123" });
  assert.equal(secretErrado.status, 401);

  const semDados = await agent
    .post("/api/setup/first-admin")
    .send({ setupSecret: SECRET });
  assert.equal(semDados.status, 400);

  const senhaCurta = await agent.post("/api/setup/first-admin").send({
    setupSecret: SECRET,
    email: "admin@e.com",
    password: "123",
  });
  assert.equal(senhaCurta.status, 400);

  const ok = await agent.post("/api/setup/first-admin").send({
    setupSecret: SECRET,
    email: "admin@e.com",
    password: "segredo123",
    name: "Admin",
    tenantName: "Minha Empresa",
  });
  assert.equal(ok.status, 201);
  assert.ok(ok.body.token);
  assert.equal(ok.body.user.role, "admin");
  assert.equal(ok.body.tenant.slug, "default");

  const status = await agent.get("/api/setup/status");
  assert.equal(status.body.needsBootstrap, false);

  const denovo = await agent.post("/api/setup/first-admin").send({
    setupSecret: SECRET,
    email: "outro@e.com",
    password: "segredo123",
  });
  assert.equal(denovo.status, 410);
});

test("POST /api/setup/tenant cria nova organização", async () => {
  const secretErrado = await agent
    .post("/api/setup/tenant")
    .send({ setupSecret: "errado" });
  assert.equal(secretErrado.status, 401);

  const ok = await agent.post("/api/setup/tenant").send({
    setupSecret: SECRET,
    tenantName: "Requinte Cal",
    tenantSlug: "requinte",
    email: "adm@requinte.com",
    password: "segredo123",
  });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.tenant.slug, "requinte");
  assert.ok(ok.body.token);

  const dup = await agent.post("/api/setup/tenant").send({
    setupSecret: SECRET,
    tenantName: "Outra",
    tenantSlug: "requinte",
    email: "outro@e.com",
    password: "segredo123",
  });
  assert.equal(dup.status, 409);

  const semNome = await agent.post("/api/setup/tenant").send({
    setupSecret: SECRET,
    tenantName: "",
    email: "x@e.com",
    password: "segredo123",
  });
  assert.equal(semNome.status, 400);
});

test("POST /api/setup/tenant com signIn:false não retorna token", async () => {
  const res = await agent.post("/api/setup/tenant").send({
    setupSecret: SECRET,
    tenantName: "Sem Login",
    tenantSlug: "sem-login",
    email: "adm@sem-login.com",
    password: "segredo123",
    signIn: false,
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.token, undefined);
  assert.equal(res.body.tenant.slug, "sem-login");
});

test("setup retorna 503 quando SETUP_SECRET ausente", async () => {
  const prev = process.env.SETUP_SECRET;
  delete process.env.SETUP_SECRET;
  try {
    const status = await agent.get("/api/setup/status");
    assert.equal(status.body.setupEnabled, false);

    const firstAdmin = await agent
      .post("/api/setup/first-admin")
      .send({ setupSecret: "x", email: "a@e.com", password: "segredo123" });
    assert.equal(firstAdmin.status, 503);

    const tenant = await agent
      .post("/api/setup/tenant")
      .send({ setupSecret: "x", tenantName: "T", email: "a@e.com", password: "segredo123" });
    assert.equal(tenant.status, 503);
  } finally {
    process.env.SETUP_SECRET = prev;
  }
});
