const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const {
  agent,
  prisma,
  resetDb,
  seedTenant,
} = require("../helpers/testServer");
const {
  getMemoryOutbox,
  resetMemoryOutbox,
} = require("../../src/infra/email/emailService");
const { isEncryptedFiscalToken } = require("../../src/infra/crypto/fiscalTokenCrypto");

test.beforeEach(async () => {
  await resetDb();
  await seedTenant({ slug: "default", name: "Colombocal" });
  resetMemoryOutbox();
});

async function seedAdmin(email = "admin@reset.local", password = "antiga123") {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "default" } });
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({
    data: {
      tenantId: tenant.id,
      email,
      passwordHash,
      name: "Admin Reset",
      role: "admin",
    },
  });
}

test("forgot-password: resposta idêntica para e-mail existente e inexistente", async () => {
  await seedAdmin();
  const a = await agent
    .post("/api/auth/forgot-password")
    .send({ email: "admin@reset.local" });
  const b = await agent
    .post("/api/auth/forgot-password")
    .send({ email: "naoexiste@reset.local" });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(a.body.message, b.body.message);
  assert.equal(a.body.ok, true);
  assert.equal(b.body.ok, true);
});

test("forgot-password: armazena só hash e envia e-mail; reset invalida JWT antigo", async () => {
  const user = await seedAdmin("u@reset.local", "antiga123");
  const login1 = await agent
    .post("/api/auth/login")
    .send({ email: "u@reset.local", password: "antiga123" });
  assert.equal(login1.status, 200);
  const oldToken = login1.body.token;

  const forgot = await agent
    .post("/api/auth/forgot-password")
    .send({ email: "u@reset.local" });
  assert.equal(forgot.status, 200);

  const rows = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
  assert.equal(rows.length, 1);
  assert.ok(rows[0].tokenHash);
  assert.ok(!rows[0].tokenHash.includes(" "));
  assert.equal(rows[0].tokenHash.length, 64);

  const outbox = getMemoryOutbox();
  assert.ok(outbox.length >= 1);
  const mail = outbox.find((m) => m.to === "u@reset.local");
  assert.ok(mail);
  const m = String(mail.text).match(/token=([^\s&]+)/);
  assert.ok(m, "e-mail deve conter link com token");
  const rawToken = decodeURIComponent(m[1]);
  assert.notEqual(crypto.createHash("sha256").update(rawToken).digest("hex"), "");
  assert.ok(!JSON.stringify(rows).includes(rawToken));

  const reset = await agent
    .post("/api/auth/reset-password")
    .send({ token: rawToken, password: "novaSenha99" });
  assert.equal(reset.status, 200);

  const reuse = await agent
    .post("/api/auth/reset-password")
    .send({ token: rawToken, password: "outraSenha99" });
  assert.equal(reuse.status, 400);

  const oldLogin = await agent
    .post("/api/auth/login")
    .send({ email: "u@reset.local", password: "antiga123" });
  assert.equal(oldLogin.status, 401);

  const newLogin = await agent
    .post("/api/auth/login")
    .send({ email: "u@reset.local", password: "novaSenha99" });
  assert.equal(newLogin.status, 200);

  // AUTH_DISABLED=true no harness — para validar JWT precisamos forçar auth.
  const prevAuth = process.env.AUTH_DISABLED;
  process.env.AUTH_DISABLED = "false";
  try {
    const meOld = await agent
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${oldToken}`);
    assert.equal(meOld.status, 401);

    const meNew = await agent
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${newLogin.body.token}`);
    assert.equal(meNew.status, 200);
  } finally {
    process.env.AUTH_DISABLED = prevAuth;
  }
});

test("reset-password: token inexistente/expirado/alterado", async () => {
  await seedAdmin();
  const bad = await agent
    .post("/api/auth/reset-password")
    .send({ token: "x".repeat(40), password: "abcdef" });
  assert.equal(bad.status, 400);

  const user = await prisma.user.findFirst({ where: { email: "admin@reset.local" } });
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: crypto.createHash("sha256").update("expired-token-value").digest("hex"),
      expiresAt: new Date(Date.now() - 60_000),
    },
  });
  const exp = await agent
    .post("/api/auth/reset-password")
    .send({ token: "expired-token-value", password: "abcdef" });
  assert.equal(exp.status, 400);
});

test("emitente-fiscal: token é criptografado e nunca retornado", async () => {
  const prevAuth = process.env.AUTH_DISABLED;
  process.env.AUTH_DISABLED = "false";
  try {
    const user = await seedAdmin("fiscal@local", "segredo123");
    const login = await agent
      .post("/api/auth/login")
      .send({ email: "fiscal@local", password: "segredo123" });
    const headers = { Authorization: `Bearer ${login.body.token}` };

    const put = await agent
      .put("/api/config/emitente-fiscal")
      .set(headers)
      .send({
        cnpj: "12345678000199",
        inscricaoEstadual: "123",
        razaoSocial: "Emitente Teste",
        crt: 1,
        logradouro: "Rua A",
        numero: "1",
        bairro: "Centro",
        municipio: "Limeira",
        codigoMunicipio: "3526902",
        uf: "SP",
        cep: "13480000",
        ambiente: "homologacao",
        provedorToken: "token-secreto-nao-vazar",
      });
    assert.equal(put.status, 200);
    assert.equal(put.body.provedorToken, undefined);
    assert.equal(put.body.provedorTokenConfigurado, true);
    assert.ok(!JSON.stringify(put.body).includes("token-secreto-nao-vazar"));

    const row = await prisma.emitenteFiscal.findUnique({
      where: { tenantId: user.tenantId },
    });
    assert.ok(isEncryptedFiscalToken(row.provedorToken));
    assert.ok(!String(row.provedorToken).includes("token-secreto-nao-vazar"));

    const get = await agent.get("/api/config/emitente-fiscal").set(headers);
    assert.equal(get.status, 200);
    assert.equal(get.body.provedorToken, undefined);
    assert.equal(get.body.provedorTokenConfigurado, true);
  } finally {
    process.env.AUTH_DISABLED = prevAuth;
  }
});
