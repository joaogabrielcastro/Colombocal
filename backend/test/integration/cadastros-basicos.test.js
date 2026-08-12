const test = require("node:test");
const assert = require("node:assert/strict");
const { agent, prisma, resetDb, seedTenant } = require("../helpers/testServer");

test.beforeEach(async () => {
  await resetDb();
  await seedTenant();
});

for (const recurso of ["motoristas", "vendedores"]) {
  test(`CRUD /api/${recurso}`, async () => {
    const lista0 = await agent.get(`/api/${recurso}`);
    assert.equal(lista0.status, 200);
    assert.deepEqual(lista0.body, []);

    const criado = await agent
      .post(`/api/${recurso}`)
      .send({ nome: "Fulano", telefone: "4190000", comissaoPercentual: 3 });
    assert.equal(criado.status, 201);
    assert.equal(criado.body.nome, "Fulano");
    const id = criado.body.id;

    const busca = await agent.get(`/api/${recurso}`).query({ busca: "Ful" });
    assert.equal(busca.body.length, 1);

    const get = await agent.get(`/api/${recurso}/${id}`);
    assert.equal(get.status, 200);
    assert.equal(get.body.id, id);

    const get404 = await agent.get(`/api/${recurso}/9999`);
    assert.equal(get404.status, 404);

    const put = await agent.put(`/api/${recurso}/${id}`).send({ nome: "Beltrano" });
    assert.equal(put.status, 200);
    assert.equal(put.body.nome, "Beltrano");

    const put404 = await agent.put(`/api/${recurso}/9999`).send({ nome: "x" });
    assert.equal(put404.status, 404);

    const del = await agent.delete(`/api/${recurso}/${id}`);
    assert.equal(del.status, 200);
    assert.equal(del.body.success, true);

    const del404 = await agent.delete(`/api/${recurso}/9999`);
    assert.equal(del404.status, 404);

    // após inativar, some da lista (filtra ativo:true)
    const listaFinal = await agent.get(`/api/${recurso}`);
    assert.equal(listaFinal.body.length, 0);
  });

  test(`POST /api/${recurso} com payload inválido retorna erro tratado`, async () => {
    // nome como objeto viola o tipo esperado pelo Prisma → cai no catch (handleRouteError)
    const res = await agent.post(`/api/${recurso}`).send({ nome: { x: 1 } });
    assert.equal(res.status, 500);
    assert.ok(res.body.error);
  });
}

test("GET /api/dashboard agrega métricas", async () => {
  const tenant = await prisma.tenant.findFirst();
  const vendedor = await prisma.vendedor.create({
    data: { tenantId: tenant.id, nome: "V", comissaoPercentual: 5 },
  });
  const cliente = await prisma.cliente.create({
    data: { tenantId: tenant.id, cnpj: "11222333000181", razaoSocial: "Cli" },
  });
  await prisma.produto.create({
    data: { tenantId: tenant.id, nome: "P", codigo: "C1", precoPadrao: 10 },
  });
  const venda = await prisma.venda.create({
    data: {
      tenantId: tenant.id,
      numeroVenda: 1,
      clienteId: cliente.id,
      vendedorId: vendedor.id,
      valorTotal: 500,
      dataVenda: new Date(),
    },
  });
  await prisma.tituloReceber.create({
    data: {
      tenantId: tenant.id,
      clienteId: cliente.id,
      vendaId: venda.id,
      vencimento: new Date(),
      valorOriginal: 500,
      status: "aberto",
    },
  });
  await prisma.cheque.create({
    data: { tenantId: tenant.id, numeroOrdem: 1, clienteId: cliente.id, valor: 200 },
  });

  const res = await agent.get("/api/dashboard");
  assert.equal(res.status, 200);
  assert.equal(res.body.vendasHoje, 1);
  assert.equal(res.body.faturamentoHoje, 500);
  assert.equal(res.body.faturamentoMes, 500);
  assert.equal(res.body.clientesDevendo, 1);
  assert.equal(res.body.totalEmAberto, 500);
  assert.equal(res.body.totalChequesRegistrados, 200);
  assert.equal(res.body.totalProdutosAtivos, 1);
  assert.equal(res.body.ultimasVendas.length, 1);
  assert.equal(res.body.ultimasVendas[0].saldoOrdem, 500);
  assert.equal(res.body.ultimasVendas[0].quitada, false);
  assert.ok(res.body.divergenciasFinanceiras);
  assert.equal(typeof res.body.divergenciasFinanceiras.clientesComDivergencia, "number");
  assert.equal(res.body.faturamentoPorMes.length, 6);
  assert.ok(res.body.onboarding);
  assert.equal(res.body.onboarding.clientes, 1);
  assert.equal(res.body.onboarding.produtos, 1);
  assert.equal(res.body.onboarding.vendas, 1);
});
