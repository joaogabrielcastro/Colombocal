const test = require("node:test");
const assert = require("node:assert/strict");
const {
  agent,
  prisma,
  resetDb,
  seedTenant,
  seedVendedor,
  seedProduto,
  seedCliente,
} = require("../helpers/testServer");

let ctx;
test.beforeEach(async () => {
  await resetDb();
  const tenant = await seedTenant();
  const vendedor = await seedVendedor(tenant.id, { comissaoPercentual: 4 });
  ctx = { tenant, vendedor };
});

test("GET /api/clientes retorna estrutura {clientes,total}", async () => {
  await seedCliente(ctx.tenant.id, { razaoSocial: "Alfa" });
  await seedCliente(ctx.tenant.id, { razaoSocial: "Beta", cnpj: "99888777000166" });
  const res = await agent.get("/api/clientes");
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 2);
  assert.equal(res.body.clientes.length, 2);
  assert.equal(res.headers["x-total-count"], "2");
});

test("GET /api/clientes filtra por busca e por ativo", async () => {
  await seedCliente(ctx.tenant.id, { razaoSocial: "Padaria Central", cidade: "Curitiba" });
  await seedCliente(ctx.tenant.id, {
    razaoSocial: "Mercado Sul",
    cnpj: "99888777000166",
    ativo: false,
  });
  const busca = await agent.get("/api/clientes").query({ busca: "Central" });
  assert.equal(busca.body.total, 1);
  const inativos = await agent.get("/api/clientes").query({ ativo: "false" });
  assert.equal(inativos.body.total, 1);
  assert.equal(inativos.body.clientes[0].razaoSocial, "Mercado Sul");
});

test("POST /api/clientes cria cliente PJ", async () => {
  const res = await agent.post("/api/clientes").send({
    razaoSocial: "Nova Empresa",
    cnpj: "11.222.333/0001-81",
    vendedorId: ctx.vendedor.id,
    fretePadraoSaco: 2.5,
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.cnpj, "11222333000181");
  assert.equal(res.body.tipoPessoa, "PJ");
  assert.equal(Number(res.body.fretePadraoSaco), 2.5);
});

test("POST /api/clientes rejeita CNPJ inválido", async () => {
  const res = await agent.post("/api/clientes").send({ razaoSocial: "X", cnpj: "123" });
  assert.equal(res.status, 400);
});

test("POST /api/clientes duplicado ativo retorna 400", async () => {
  await seedCliente(ctx.tenant.id, { cnpj: "11222333000181" });
  const res = await agent
    .post("/api/clientes")
    .send({ razaoSocial: "Repetido", cnpj: "11222333000181" });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /CNPJ já cadastrado/);
});

test("POST /api/clientes reativa cliente inativo com mesmo CNPJ", async () => {
  await seedCliente(ctx.tenant.id, { cnpj: "11222333000181", ativo: false });
  const res = await agent
    .post("/api/clientes")
    .send({ razaoSocial: "Reativado", cnpj: "11222333000181" });
  assert.equal(res.status, 200);
  assert.equal(res.body.ativo, true);
  assert.equal(res.body.razaoSocial, "Reativado");
});

test("GET/PUT/DELETE /api/clientes/:id ciclo completo", async () => {
  const cli = await seedCliente(ctx.tenant.id);
  const get = await agent.get(`/api/clientes/${cli.id}`);
  assert.equal(get.status, 200);
  assert.equal(get.body.id, cli.id);

  const put = await agent
    .put(`/api/clientes/${cli.id}`)
    .send({ razaoSocial: "Atualizado", comissaoFixaPercentual: 3.5, vendedorId: null });
  assert.equal(put.status, 200);
  assert.equal(put.body.razaoSocial, "Atualizado");
  assert.equal(Number(put.body.comissaoFixaPercentual), 3.5);

  const del = await agent.delete(`/api/clientes/${cli.id}`);
  assert.equal(del.status, 200);
  const afterDel = await prisma.cliente.findUnique({ where: { id: cli.id } });
  assert.equal(afterDel.ativo, false);
});

test("GET /api/clientes/:id 404", async () => {
  const res = await agent.get("/api/clientes/9999");
  assert.equal(res.status, 404);
});

test("PUT /api/clientes/:id 404", async () => {
  const res = await agent.put("/api/clientes/9999").send({ razaoSocial: "x" });
  assert.equal(res.status, 404);
});

test("DELETE /api/clientes/:id 404", async () => {
  const res = await agent.delete("/api/clientes/9999");
  assert.equal(res.status, 404);
});

test("GET /api/clientes/:id/precos retorna produtos com preço aplicado", async () => {
  const cli = await seedCliente(ctx.tenant.id);
  const prod = await seedProduto(ctx.tenant.id, { precoPadrao: 100 });
  await prisma.precoClienteProduto.create({
    data: {
      tenantId: ctx.tenant.id,
      clienteId: cli.id,
      produtoId: prod.id,
      preco: 80,
    },
  });
  const res = await agent.get(`/api/clientes/${cli.id}/precos`);
  assert.equal(res.status, 200);
  const item = res.body.find((p) => p.id === prod.id);
  assert.equal(item.precoEspecial, 80);
  assert.equal(item.precoAplicado, 80);
});

test("GET /api/clientes/:id/precos com produtoId e busca e take", async () => {
  const cli = await seedCliente(ctx.tenant.id);
  const prod = await seedProduto(ctx.tenant.id, { nome: "Especifico" });
  const byId = await agent
    .get(`/api/clientes/${cli.id}/precos`)
    .query({ produtoId: prod.id });
  assert.equal(byId.body.length, 1);
  const byBusca = await agent
    .get(`/api/clientes/${cli.id}/precos`)
    .query({ busca: "Especifico", take: "10" });
  assert.equal(byBusca.body.length, 1);
});

test("GET /api/clientes/:id/precos valida ids", async () => {
  const cli = await seedCliente(ctx.tenant.id);
  assert.equal((await agent.get("/api/clientes/abc/precos")).status, 400);
  assert.equal((await agent.get("/api/clientes/9999/precos")).status, 404);
  assert.equal(
    (await agent.get(`/api/clientes/${cli.id}/precos`).query({ produtoId: "abc" })).status,
    400,
  );
});

test("PUT /api/clientes/:id/precos faz upsert e remoção", async () => {
  const cli = await seedCliente(ctx.tenant.id);
  const prod = await seedProduto(ctx.tenant.id);
  const up = await agent
    .put(`/api/clientes/${cli.id}/precos`)
    .send({ precos: [{ produtoId: prod.id, preco: 55 }] });
  assert.equal(up.status, 200);
  let rows = await prisma.precoClienteProduto.findMany({ where: { clienteId: cli.id } });
  assert.equal(rows.length, 1);

  // null é coagido para 0 pelo schema (z.coerce.number) => vira upsert de 0
  const zero = await agent
    .put(`/api/clientes/${cli.id}/precos`)
    .send({ precos: [{ produtoId: prod.id, preco: null }] });
  assert.equal(zero.status, 200);
  rows = await prisma.precoClienteProduto.findMany({ where: { clienteId: cli.id } });
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].preco), 0);
});

test("PUT /api/clientes/:id/precos 404 cliente inexistente", async () => {
  const res = await agent
    .put("/api/clientes/9999/precos")
    .send({ precos: [{ produtoId: 1, preco: 1 }] });
  assert.equal(res.status, 404);
});

test("GET/PUT /api/clientes/:id/comissoes", async () => {
  const cli = await seedCliente(ctx.tenant.id, {
    vendedorId: ctx.vendedor.id,
    comissaoFixaPercentual: null,
  });
  const prod = await seedProduto(ctx.tenant.id);

  const get1 = await agent.get(`/api/clientes/${cli.id}/comissoes`);
  assert.equal(get1.status, 200);
  assert.equal(get1.body.comissaoPadrao, 4); // % do representante
  const p1 = get1.body.produtos.find((p) => p.id === prod.id);
  assert.equal(p1.comissaoAplicada, 4);

  const up = await agent
    .put(`/api/clientes/${cli.id}/comissoes`)
    .send({ comissoes: [{ produtoId: prod.id, comissaoPercentual: 9 }] });
  assert.equal(up.status, 200);

  const get2 = await agent.get(`/api/clientes/${cli.id}/comissoes`);
  const p2 = get2.body.produtos.find((p) => p.id === prod.id);
  assert.equal(p2.comissaoEspecial, 9);
  assert.equal(p2.comissaoAplicada, 9);

  // null é coagido para 0 pelo schema => upsert de 0
  const zero = await agent
    .put(`/api/clientes/${cli.id}/comissoes`)
    .send({ comissoes: [{ produtoId: prod.id, comissaoPercentual: null }] });
  assert.equal(zero.status, 200);
  const rows = await prisma.comissaoClienteProduto.findMany({ where: { clienteId: cli.id } });
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].comissaoPercentual), 0);
});

test("GET /api/clientes/:id/comissoes valida id e 404", async () => {
  assert.equal((await agent.get("/api/clientes/abc/comissoes")).status, 400);
  assert.equal((await agent.get("/api/clientes/9999/comissoes")).status, 404);
});

test("PUT /api/clientes/:id/comissoes 404", async () => {
  const res = await agent
    .put("/api/clientes/9999/comissoes")
    .send({ comissoes: [{ produtoId: 1, comissaoPercentual: 1 }] });
  assert.equal(res.status, 404);
});

test("GET /api/clientes/:id/conta agrega saldo", async () => {
  const cli = await seedCliente(ctx.tenant.id);
  const prod = await seedProduto(ctx.tenant.id);
  const venda = await prisma.venda.create({
    data: {
      tenantId: ctx.tenant.id,
      numeroVenda: 1,
      clienteId: cli.id,
      vendedorId: ctx.vendedor.id,
      valorTotal: 200,
    },
  });
  await prisma.tituloReceber.create({
    data: {
      tenantId: ctx.tenant.id,
      clienteId: cli.id,
      vendaId: venda.id,
      vencimento: new Date(),
      valorOriginal: 200,
      valorPago: 50,
      status: "parcial",
    },
  });
  await prisma.pagamento.create({
    data: { tenantId: ctx.tenant.id, clienteId: cli.id, vendaId: venda.id, tipo: "dinheiro", valor: 50 },
  });
  const res = await agent.get(`/api/clientes/${cli.id}/conta`);
  assert.equal(res.status, 200);
  assert.equal(res.body.totalDebitos, 200);
  assert.equal(res.body.totalCreditos, 50);
  assert.equal(res.body.saldo, 150);
  assert.equal(res.body.vendas.length, 1);
});

test("GET /api/clientes/:id/conta 404", async () => {
  const res = await agent.get("/api/clientes/9999/conta");
  assert.equal(res.status, 404);
});

test("POST /api/clientes/:id/reconciliar-recebiveis", async () => {
  const cli = await seedCliente(ctx.tenant.id);
  const ok = await agent.post(`/api/clientes/${cli.id}/reconciliar-recebiveis`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.success, true);

  assert.equal(
    (await agent.post("/api/clientes/abc/reconciliar-recebiveis")).status,
    400,
  );
  assert.equal(
    (await agent.post("/api/clientes/9999/reconciliar-recebiveis")).status,
    404,
  );
});
