const test = require("node:test");
const assert = require("node:assert/strict");
const { agent, prisma, resetDb, seedTenant } = require("../helpers/testServer");

test.beforeEach(async () => {
  await resetDb();
  await seedTenant({ slug: "default", name: "Colombocal" });
});

test("GET /api/auth/register-status (fechado por padrão)", async () => {
  const res = await agent.get("/api/auth/register-status");
  assert.equal(res.status, 200);
  assert.equal(res.body.registrationOpen, false);
  assert.ok(Array.isArray(res.body.tenants));
});

test("POST /api/auth/register bloqueado quando fechado", async () => {
  const res = await agent
    .post("/api/auth/register")
    .send({ email: "novo@e.com", password: "segredo123" });
  assert.equal(res.status, 403);
});

test("POST /api/auth/register cria membro quando aberto", async () => {
  process.env.OPEN_REGISTRATION = "true";
  try {
    const status = await agent.get("/api/auth/register-status");
    assert.equal(status.body.registrationOpen, true);

    const semDados = await agent.post("/api/auth/register").send({ email: "" });
    assert.equal(semDados.status, 400);

    const ok = await agent
      .post("/api/auth/register")
      .send({ email: "Membro@E.com", password: "segredo123", name: "Membro" });
    assert.equal(ok.status, 201);
    assert.ok(ok.body.token);
    assert.equal(ok.body.user.email, "membro@e.com");
    assert.equal(ok.body.user.role, "member");

    const dup = await agent
      .post("/api/auth/register")
      .send({ email: "membro@e.com", password: "segredo123" });
    assert.equal(dup.status, 409);
  } finally {
    delete process.env.OPEN_REGISTRATION;
  }
});

test("POST /api/auth/login valida credenciais", async () => {
  process.env.OPEN_REGISTRATION = "true";
  try {
    await agent
      .post("/api/auth/register")
      .send({ email: "login@e.com", password: "segredo123" });
  } finally {
    delete process.env.OPEN_REGISTRATION;
  }

  const semDados = await agent.post("/api/auth/login").send({});
  assert.equal(semDados.status, 400);

  const emailErrado = await agent
    .post("/api/auth/login")
    .send({ email: "naoexiste@e.com", password: "x" });
  assert.equal(emailErrado.status, 401);

  const senhaErrada = await agent
    .post("/api/auth/login")
    .send({ email: "login@e.com", password: "errada" });
  assert.equal(senhaErrada.status, 401);

  const ok = await agent
    .post("/api/auth/login")
    .send({ email: "login@e.com", password: "segredo123" });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);
});

test("GET /api/auth/tenants lista todas as organizações", async () => {
  await seedTenant({ slug: "requinte", name: "Requinte" });
  const res = await agent.get("/api/auth/tenants");
  assert.equal(res.status, 200);
  assert.equal(res.body.tenants.length, 2);
  const slugs = res.body.tenants.map((t) => t.slug).sort();
  assert.deepEqual(slugs, ["default", "requinte"]);
});

test("POST /api/auth/login com mesmo e-mail em 2 tenants exige organização", async () => {
  const bcrypt = require("bcrypt");
  const colombocal = await prisma.tenant.findUnique({ where: { slug: "default" } });
  const requinte = await seedTenant({ slug: "requinte", name: "Requinte" });
  const hash = await bcrypt.hash("segredo123", 10);
  await prisma.user.create({
    data: {
      tenantId: colombocal.id,
      email: "mesmo@e.com",
      passwordHash: hash,
      name: "Admin Col",
      role: "admin",
    },
  });
  await prisma.user.create({
    data: {
      tenantId: requinte.id,
      email: "mesmo@e.com",
      passwordHash: hash,
      name: "Admin Req",
      role: "admin",
    },
  });

  const auto = await agent
    .post("/api/auth/login")
    .send({ email: "mesmo@e.com", password: "segredo123" });
  assert.equal(auto.status, 409);
  assert.equal(auto.body.code, "TENANT_REQUIRED");
  assert.ok(Array.isArray(auto.body.tenants));
  assert.equal(auto.body.tenants.length, 2);

  const reqOk = await agent
    .post("/api/auth/login")
    .send({ email: "mesmo@e.com", password: "segredo123", tenantSlug: "requinte" });
  assert.equal(reqOk.status, 200);
  assert.equal(reqOk.body.tenant.slug, "requinte");

  const colOk = await agent
    .post("/api/auth/login")
    .send({ email: "mesmo@e.com", password: "segredo123", tenantSlug: "default" });
  assert.equal(colOk.status, 200);
  assert.equal(colOk.body.tenant.slug, "default");
});

test("Auth real (AUTH_DISABLED=false): 401 sem token, /me com token", async () => {
  // cria usuário e obtém token
  process.env.OPEN_REGISTRATION = "true";
  let token;
  try {
    const reg = await agent
      .post("/api/auth/register")
      .send({ email: "real@e.com", password: "segredo123", name: "Real" });
    token = reg.body.token;
  } finally {
    delete process.env.OPEN_REGISTRATION;
  }

  process.env.AUTH_DISABLED = "false";
  try {
    const semToken = await agent.get("/api/clientes");
    assert.equal(semToken.status, 401);

    const tokenRuim = await agent
      .get("/api/clientes")
      .set("Authorization", "Bearer token-invalido");
    assert.equal(tokenRuim.status, 401);

    const me = await agent.get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, "real@e.com");
    assert.equal(me.body.features.frete, true);
    assert.equal(me.body.features.clienteCpf, false);

    // usuário removido → middleware rejeita o token (401)
    await prisma.user.deleteMany({ where: { email: "real@e.com" } });
    const meSem = await agent.get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    assert.equal(meSem.status, 401);
  } finally {
    process.env.AUTH_DISABLED = "true";
  }
});

test("POST /api/auth/register exige chave de convite quando REGISTRATION_KEY definido", async () => {
  process.env.OPEN_REGISTRATION = "true";
  process.env.REGISTRATION_KEY = "convite-secreto";
  try {
    const status = await agent.get("/api/auth/register-status");
    assert.equal(status.body.registrationRequiresKey, true);

    const semChave = await agent
      .post("/api/auth/register")
      .send({ email: "conv@e.com", password: "segredo123" });
    assert.equal(semChave.status, 401);

    const chaveErrada = await agent
      .post("/api/auth/register")
      .send({ email: "conv@e.com", password: "segredo123", registrationKey: "errada!" });
    assert.equal(chaveErrada.status, 401);

    const ok = await agent.post("/api/auth/register").send({
      email: "conv@e.com",
      password: "segredo123",
      registrationKey: "convite-secreto",
    });
    assert.equal(ok.status, 201);
  } finally {
    delete process.env.OPEN_REGISTRATION;
    delete process.env.REGISTRATION_KEY;
  }
});

test("POST /api/auth/register valida senha curta", async () => {
  process.env.OPEN_REGISTRATION = "true";
  try {
    const res = await agent
      .post("/api/auth/register")
      .send({ email: "curta@e.com", password: "123" });
    assert.equal(res.status, 400);
  } finally {
    delete process.env.OPEN_REGISTRATION;
  }
});
