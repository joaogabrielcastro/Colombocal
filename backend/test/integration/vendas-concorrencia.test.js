const test = require("node:test");
const assert = require("node:assert/strict");
const { agent, prisma, resetDb, seedBase } = require("../helpers/testServer");
const { criarVenda } = require("../../src/application/use-cases/criarVenda");

test.beforeEach(async () => {
  await resetDb();
});

test("criações simultâneas no mesmo tenant não duplicam numeroVenda", async () => {
  const { tenant, cliente, produto, vendedor } = await seedBase();
  const payload = {
    clienteId: cliente.id,
    vendedorId: vendedor.id,
    itens: [{ produtoId: produto.id, quantidade: 1, precoUnitario: 50 }],
  };

  const results = await Promise.all(
    Array.from({ length: 8 }, () => agent.post("/api/vendas").send(payload)),
  );

  for (const res of results) {
    assert.equal(res.status, 201, res.body?.error || JSON.stringify(res.body));
    assert.ok(res.body.id);
    assert.ok(Number.isInteger(res.body.numeroVenda));
  }

  const numeros = results.map((r) => r.body.numeroVenda).sort((a, b) => a - b);
  assert.deepEqual(numeros, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(new Set(numeros).size, 8);

  const noDb = await prisma.venda.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, numeroVenda: true },
  });
  assert.equal(noDb.length, 8);
  const titulos = await prisma.tituloReceber.findMany({ where: { tenantId: tenant.id } });
  assert.equal(titulos.length, 8);
});

test("tenants diferentes podem repetir a numeração", async () => {
  const a = await seedBase({ tenant: { slug: "default", name: "Colombocal" } });
  const b = await seedBase({ tenant: { slug: "requinte", name: "Requinte" } });

  const [va, vb] = await Promise.all([
    criarVenda(prisma, {
      tenantId: a.tenant.id,
      clienteId: a.cliente.id,
      vendedorId: a.vendedor.id,
      itens: [{ produtoId: a.produto.id, quantidade: 1, precoUnitario: 10 }],
    }),
    criarVenda(prisma, {
      tenantId: b.tenant.id,
      clienteId: b.cliente.id,
      vendedorId: b.vendedor.id,
      itens: [{ produtoId: b.produto.id, quantidade: 1, precoUnitario: 10 }],
    }),
  ]);

  assert.equal(va.numeroVenda, 1);
  assert.equal(vb.numeroVenda, 1);
  assert.notEqual(va.tenantId, vb.tenantId);
});
