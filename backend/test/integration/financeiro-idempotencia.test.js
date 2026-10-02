const test = require("node:test");
const assert = require("node:assert/strict");
const {
  agent,
  prisma,
  resetDb,
  seedTenant,
  seedVendedor,
  seedCliente,
} = require("../helpers/testServer");

let ctx;

test.beforeEach(async () => {
  await resetDb();
  const tenant = await seedTenant();
  const vendedor = await seedVendedor(tenant.id);
  const cliente = await seedCliente(tenant.id, { vendedorId: vendedor.id });
  const venda = await prisma.venda.create({
    data: {
      tenantId: tenant.id,
      numeroVenda: 1,
      clienteId: cliente.id,
      vendedorId: vendedor.id,
      valorTotal: 100,
    },
  });
  await prisma.tituloReceber.create({
    data: {
      tenantId: tenant.id,
      clienteId: cliente.id,
      vendaId: venda.id,
      numero: "VENDA-1",
      vencimento: new Date("2026-10-02T12:00:00Z"),
      valorOriginal: 100,
      status: "aberto",
    },
  });
  ctx = { tenant, cliente, venda };
});

function receber(valor, key) {
  return agent
    .post("/api/recebimentos")
    .set("Idempotency-Key", key)
    .send({
      clienteId: ctx.cliente.id,
      vendaId: ctx.venda.id,
      dinheiro: { valor, data: "2026-10-02" },
    });
}

test("duas baixas simultâneas e intencionais usam o saldo atualizado", async () => {
  const [first, second] = await Promise.all([
    receber(40, "baixa-intencional-0001"),
    receber(60, "baixa-intencional-0002"),
  ]);
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);

  const pagamentos = await prisma.pagamento.findMany({
    where: { tenantId: ctx.tenant.id, vendaId: ctx.venda.id },
  });
  assert.equal(pagamentos.length, 2);
  assert.equal(
    pagamentos.reduce((sum, row) => sum + Number(row.valor), 0),
    100,
  );
  const titulo = await prisma.tituloReceber.findFirst({ where: { vendaId: ctx.venda.id } });
  assert.equal(titulo.status, "quitado");
  assert.equal(Number(titulo.valorPago), 100);
});

test("reenvio simultâneo da mesma intenção cria uma única baixa", async () => {
  const key = "mesma-intencao-00000001";
  const [first, second] = await Promise.all([receber(70, key), receber(70, key)]);
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.deepEqual(first.body, second.body);

  const pagamentos = await prisma.pagamento.findMany({
    where: { tenantId: ctx.tenant.id, vendaId: ctx.venda.id },
  });
  assert.equal(pagamentos.length, 1);
  assert.equal(Number(pagamentos[0].valor), 70);
});

test("a mesma chave não pode representar valores diferentes", async () => {
  const key = "chave-conflitante-000001";
  assert.equal((await receber(20, key)).status, 201);
  const conflict = await receber(30, key);
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.code, "IDEMPOTENCY_KEY_REUTILIZADA");
});
