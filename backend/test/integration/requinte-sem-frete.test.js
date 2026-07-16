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

let ctx;
test.beforeEach(async () => {
  await resetDb();
  // tenant sem frete (slug requinte). DEFAULT_TENANT_ID=1 => este tenant.
  const tenant = await seedTenant({ slug: "requinte", name: "Requinte" });
  const vendedor = await seedVendedor(tenant.id);
  const cliente = await seedCliente(tenant.id, { vendedorId: vendedor.id });
  const produto = await seedProduto(tenant.id, { unidade: "ton", precoPadrao: 100 });
  ctx = { tenant, vendedor, cliente, produto };
});

test("GET /api/fretes bloqueado para tenant sem frete", async () => {
  const res = await agent.get("/api/fretes");
  assert.equal(res.status, 403);
});

test("POST /api/fretes/avulso bloqueado para tenant sem frete", async () => {
  const res = await agent.post("/api/fretes/avulso").send({
    clienteId: ctx.cliente.id,
    motoristaId: 1,
    produtoId: ctx.produto.id,
    quantidade: 1,
  });
  assert.equal(res.status, 403);
});

test("POST /api/vendas ignora frete quando tenant sem frete", async () => {
  const res = await agent.post("/api/vendas").send({
    clienteId: ctx.cliente.id,
    vendedorId: ctx.vendedor.id,
    fretePorTonelada: 50,
    itens: [{ produtoId: ctx.produto.id, quantidade: 2, precoUnitario: 100 }],
  });
  assert.equal(res.status, 201);
  assert.equal(Number(res.body.frete), 0);
  const fretes = await prisma.freteMovimento.findMany({ where: { vendaId: res.body.id } });
  assert.equal(fretes.length, 0);
});

test("PATCH /api/vendas/:id de frete bloqueado", async () => {
  const venda = await agent.post("/api/vendas").send({
    clienteId: ctx.cliente.id,
    vendedorId: ctx.vendedor.id,
    itens: [{ produtoId: ctx.produto.id, quantidade: 1, precoUnitario: 100 }],
  });
  assert.equal(venda.status, 201);
  const patch = await agent.patch(`/api/vendas/${venda.body.id}`).send({ frete: 10 });
  assert.equal(patch.status, 403);
});
