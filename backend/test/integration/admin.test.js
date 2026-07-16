const test = require("node:test");
const assert = require("node:assert/strict");
const {
  agent,
  prisma,
  resetDb,
  seedTenant,
  seedVendedor,
  seedCliente,
  seedProduto,
} = require("../helpers/testServer");

test.beforeEach(async () => {
  await resetDb();
  await seedTenant();
});

// ---------- users ----------
test("POST/GET/DELETE /api/users", async () => {
  const vazio = await agent.get("/api/users");
  assert.equal(vazio.status, 200);
  assert.deepEqual(vazio.body, []);

  const semDados = await agent.post("/api/users").send({});
  assert.equal(semDados.status, 400);

  const senhaCurta = await agent
    .post("/api/users")
    .send({ email: "a@a.com", password: "123" });
  assert.equal(senhaCurta.status, 400);

  const papelInvalido = await agent
    .post("/api/users")
    .send({ email: "a@a.com", password: "123456", role: "root" });
  assert.equal(papelInvalido.status, 400);

  const criado = await agent
    .post("/api/users")
    .send({ email: "Membro@Empresa.com", password: "segredo123", name: "Membro", role: "member" });
  assert.equal(criado.status, 201);
  assert.equal(criado.body.email, "membro@empresa.com");

  const dup = await agent
    .post("/api/users")
    .send({ email: "membro@empresa.com", password: "segredo123" });
  assert.equal(dup.status, 409);

  const lista = await agent.get("/api/users");
  assert.equal(lista.body.length, 1);

  const idInvalido = await agent.delete("/api/users/abc");
  assert.equal(idInvalido.status, 400);
  const naoExiste = await agent.delete("/api/users/9999");
  assert.equal(naoExiste.status, 404);
  const del = await agent.delete(`/api/users/${criado.body.id}`);
  assert.equal(del.status, 200);
});

test("PATCH /api/users/:id/nav-permissions", async () => {
  const criado = await agent
    .post("/api/users")
    .send({ email: "m2@e.com", password: "segredo123", role: "member" });
  const id = criado.body.id;

  const idInvalido = await agent.patch("/api/users/abc/nav-permissions").send({});
  assert.equal(idInvalido.status, 400);

  const naoExiste = await agent.patch("/api/users/9999/nav-permissions").send({});
  assert.equal(naoExiste.status, 404);

  const naoLista = await agent
    .patch(`/api/users/${id}/nav-permissions`)
    .send({ navPermissions: "x" });
  assert.equal(naoLista.status, 400);

  const invalidas = await agent
    .patch(`/api/users/${id}/nav-permissions`)
    .send({ navPermissions: ["clientes", "inexistente"] });
  assert.equal(invalidas.status, 400);

  const ok = await agent
    .patch(`/api/users/${id}/nav-permissions`)
    .send({ navPermissions: ["clientes", "vendas"] });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.body.navPermissions, ["clientes", "vendas"]);

  const evento = await prisma.financeiroEvento.findFirst({
    where: { tipo: "USER_NAV_PERMISSOES" },
  });
  assert.ok(evento);

  // admin não pode receber navPermissions
  const admin = await agent
    .post("/api/users")
    .send({ email: "adm@e.com", password: "segredo123", role: "admin" });
  const adminPatch = await agent
    .patch(`/api/users/${admin.body.id}/nav-permissions`)
    .send({ navPermissions: ["clientes"] });
  assert.equal(adminPatch.status, 400);
});

// ---------- config ----------
test("GET/PUT /api/config", async () => {
  const get = await agent.get("/api/config");
  assert.equal(get.status, 200);
  assert.equal(get.body.comissaoModo, "emissao");

  const invalido = await agent.put("/api/config").send({ comissaoModo: "xpto" });
  assert.equal(invalido.status, 400);

  const put = await agent.put("/api/config").send({ comissaoModo: "caixa" });
  assert.equal(put.status, 200);
  assert.equal(put.body.comissaoModo, "caixa");

  const getDepois = await agent.get("/api/config");
  assert.equal(getDepois.body.comissaoModo, "caixa");
});

test("POST /api/config/reset-financeiro-legacy respeita secret", async () => {
  const semSecret = await agent
    .post("/api/config/reset-financeiro-legacy")
    .send({ confirm: true });
  assert.equal(semSecret.status, 503);

  process.env.ADMIN_RESET_SECRET = "reset-secret-xyz";
  try {
    const secretErrado = await agent
      .post("/api/config/reset-financeiro-legacy")
      .send({ secret: "errado", confirm: true });
    assert.equal(secretErrado.status, 401);

    const semConfirm = await agent
      .post("/api/config/reset-financeiro-legacy")
      .send({ secret: "reset-secret-xyz" });
    assert.equal(semConfirm.status, 400);

    const ok = await agent
      .post("/api/config/reset-financeiro-legacy")
      .send({ secret: "reset-secret-xyz", confirm: true });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.success, true);
  } finally {
    delete process.env.ADMIN_RESET_SECRET;
  }
});

// ---------- auditoria ----------
test("GET /api/auditoria e /tipos", async () => {
  const tenant = await prisma.tenant.findFirst();
  const vendedor = await seedVendedor(tenant.id);
  const cliente = await seedCliente(tenant.id, { vendedorId: vendedor.id });
  const produto = await seedProduto(tenant.id);
  const venda = await agent.post("/api/vendas").send({
    clienteId: cliente.id,
    vendedorId: vendedor.id,
    itens: [{ produtoId: produto.id, quantidade: 1, precoUnitario: 100 }],
  });
  assert.equal(venda.status, 201);

  const lista = await agent.get("/api/auditoria");
  assert.equal(lista.status, 200);
  assert.ok(lista.body.length >= 1);
  assert.ok(lista.body[0].tipoLabel);

  const filtrada = await agent.get("/api/auditoria").query({
    tipo: "VENDA",
    entidade: "Venda",
    vendaId: venda.body.id,
    clienteId: cliente.id,
    userId: 1,
    dataInicio: "2000-01-01",
    dataFim: "2100-01-01",
  });
  assert.equal(filtrada.status, 200);

  const tipos = await agent.get("/api/auditoria/tipos");
  assert.equal(tipos.status, 200);
  assert.ok(tipos.body.some((t) => t.key === "VENDA_CRIADA"));
});

test("GET /api/auditoria bloqueia membro sem permissão (403)", async () => {
  process.env.OPEN_REGISTRATION = "true";
  let token;
  let userId;
  try {
    const reg = await agent
      .post("/api/auth/register")
      .send({ email: "membro-aud@e.com", password: "segredo123", name: "Membro" });
    token = reg.body.token;
    userId = reg.body.user.id;
  } finally {
    delete process.env.OPEN_REGISTRATION;
  }

  // permissões restritas que NÃO incluem "auditoria"
  await prisma.user.update({
    where: { id: userId },
    data: { navPermissions: ["clientes"] },
  });

  process.env.AUTH_DISABLED = "false";
  try {
    const lista = await agent
      .get("/api/auditoria")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(lista.status, 403);

    const tipos = await agent
      .get("/api/auditoria/tipos")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(tipos.status, 403);
  } finally {
    process.env.AUTH_DISABLED = "true";
  }
});

test("GET /api/auditoria permite membro com permissão de nav auditoria", async () => {
  process.env.OPEN_REGISTRATION = "true";
  let token;
  let userId;
  try {
    const reg = await agent
      .post("/api/auth/register")
      .send({ email: "membro-ok@e.com", password: "segredo123", name: "Membro OK" });
    token = reg.body.token;
    userId = reg.body.user.id;
  } finally {
    delete process.env.OPEN_REGISTRATION;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { navPermissions: ["auditoria"] },
  });

  process.env.AUTH_DISABLED = "false";
  try {
    const lista = await agent
      .get("/api/auditoria")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(lista.status, 200);
  } finally {
    process.env.AUTH_DISABLED = "true";
  }
});
