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
const {
  createCheque,
} = require("../../src/infra/prisma/repositories/chequeRepository");
const {
  registrarRecebimentoComposto,
} = require("../../src/application/use-cases/registrarRecebimentoComposto");

async function seedVendaComTitulo(tenantId, over = {}) {
  const vendedor = await seedVendedor(tenantId, { nome: over.vendedorNome || "Rep" });
  const cliente = await seedCliente(tenantId, {
    vendedorId: vendedor.id,
    cnpj: over.cnpj || `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 14),
    razaoSocial: over.razaoSocial || "Cliente MT",
  });
  const venda = await prisma.venda.create({
    data: {
      tenantId,
      numeroVenda: over.numeroVenda || 1,
      clienteId: cliente.id,
      vendedorId: vendedor.id,
      valorTotal: over.valorTotal ?? 880,
    },
  });
  await prisma.tituloReceber.create({
    data: {
      tenantId,
      clienteId: cliente.id,
      vendaId: venda.id,
      numero: `VENDA-${venda.id}`,
      vencimento: new Date(),
      valorOriginal: over.valorTotal ?? 880,
      status: "aberto",
    },
  });
  return { vendedor, cliente, venda };
}

test.beforeEach(async () => {
  await resetDb();
  process.env.DEFAULT_TENANT_ID = "1";
});

/**
 * Regressão do bug em produção:
 * índice legado UNIQUE(numeroOrdem) fazia Requinte falhar ao criar cheque #1
 * se Colombocal já tinha cheque #1.
 */
test("numeroOrdem do cheque é independente por tenant (createCheque)", async () => {
  const colombocal = await seedTenant({ slug: "default", name: "Colombocal" });
  const requinte = await seedTenant({ slug: "requinte", name: "Requinte" });

  const col = await seedVendaComTitulo(colombocal.id, {
    cnpj: "11222333000181",
    razaoSocial: "Col Cliente",
  });
  const req = await seedVendaComTitulo(requinte.id, {
    cnpj: "99888777000166",
    razaoSocial: "Req Cliente",
  });

  const chequeCol = await createCheque(
    prisma,
    {
      tenantId: colombocal.id,
      clienteId: col.cliente.id,
      vendaId: col.venda.id,
      valor: 100,
      emitenteNome: "Col",
      status: "registrado",
      dataRecebimento: new Date(),
    },
    { numeroOrdem: 1 },
  );
  const chequeReq = await createCheque(
    prisma,
    {
      tenantId: requinte.id,
      clienteId: req.cliente.id,
      vendaId: req.venda.id,
      valor: 200,
      emitenteNome: "Req",
      status: "registrado",
      dataRecebimento: new Date(),
    },
    { numeroOrdem: 1 },
  );

  assert.equal(chequeCol.numeroOrdem, 1);
  assert.equal(chequeReq.numeroOrdem, 1);
  assert.notEqual(chequeCol.tenantId, chequeReq.tenantId);

  const mesmosNumeros = await prisma.cheque.findMany({
    where: { numeroOrdem: 1 },
  });
  assert.equal(mesmosNumeros.length, 2);
});

test("recebimento composto na Requinte não colide com cheques da Colombocal", async () => {
  const colombocal = await seedTenant({ slug: "default", name: "Colombocal" });
  const requinte = await seedTenant({ slug: "requinte", name: "Requinte" });

  const col = await seedVendaComTitulo(colombocal.id, {
    cnpj: "11222333000181",
    valorTotal: 500,
  });
  const req = await seedVendaComTitulo(requinte.id, {
    cnpj: "99888777000166",
    valorTotal: 880,
  });

  // Colombocal já usou numeroOrdem 1 e 2
  await createCheque(
    prisma,
    {
      tenantId: colombocal.id,
      clienteId: col.cliente.id,
      vendaId: col.venda.id,
      valor: 250,
      emitenteNome: "A",
      status: "registrado",
      dataRecebimento: new Date(),
    },
    { numeroOrdem: 1 },
  );
  await createCheque(
    prisma,
    {
      tenantId: colombocal.id,
      clienteId: col.cliente.id,
      vendaId: col.venda.id,
      valor: 250,
      emitenteNome: "B",
      status: "registrado",
      dataRecebimento: new Date(),
    },
    { numeroOrdem: 2 },
  );

  // Mesmo cenário da tela: 2 cheques + dinheiro na Requinte
  const result = await registrarRecebimentoComposto(prisma, {
    tenantId: requinte.id,
    clienteId: req.cliente.id,
    vendaId: req.venda.id,
    cheques: [
      { valor: 450, emitenteNome: "joao", banco: "bradesco", numero: "487978979" },
      { valor: 200, emitenteNome: "eduardo", banco: "bradesco", numero: "8974516516" },
    ],
    dinheiro: { valor: 229.99 },
  });

  assert.equal(result.chequesCriados, 2);
  assert.equal(result.pagamentosCriados, 3);

  const chequesReq = await prisma.cheque.findMany({
    where: { tenantId: requinte.id },
    orderBy: { numeroOrdem: "asc" },
  });
  assert.equal(chequesReq.length, 2);
  assert.equal(chequesReq[0].numeroOrdem, 1);
  assert.equal(chequesReq[1].numeroOrdem, 2);
});

test("HTTP POST /api/recebimentos em outro tenant reutiliza numeroOrdem 1", async () => {
  const colombocal = await seedTenant({ slug: "default", name: "Colombocal" });
  const requinte = await seedTenant({ slug: "requinte", name: "Requinte" });

  const col = await seedVendaComTitulo(colombocal.id, { cnpj: "11222333000181" });
  const req = await seedVendaComTitulo(requinte.id, {
    cnpj: "99888777000166",
    valorTotal: 100,
  });

  process.env.DEFAULT_TENANT_ID = String(colombocal.id);
  const colRes = await agent.post("/api/cheques").send({
    clienteId: col.cliente.id,
    vendaId: col.venda.id,
    valor: 50,
    emitenteNome: "Col HTTP",
  });
  assert.equal(colRes.status, 201);

  process.env.DEFAULT_TENANT_ID = String(requinte.id);
  const reqRes = await agent.post("/api/recebimentos").send({
    clienteId: req.cliente.id,
    vendaId: req.venda.id,
    cheques: [{ valor: 60, emitenteNome: "Req HTTP" }],
    dinheiro: { valor: 40 },
  });
  assert.equal(reqRes.status, 201, JSON.stringify(reqRes.body));

  const cheques = await prisma.cheque.findMany({
    where: { numeroOrdem: 1 },
    orderBy: { tenantId: "asc" },
  });
  assert.equal(cheques.length, 2);
  assert.deepEqual(
    cheques.map((c) => c.tenantId).sort((a, b) => a - b),
    [colombocal.id, requinte.id].sort((a, b) => a - b),
  );
});
