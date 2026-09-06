const test = require("node:test");
const assert = require("node:assert/strict");
const { agent, prisma, resetDb, seedBase, seedMotorista } = require("../helpers/testServer");
const { createMockNfeProvider } = require("../../src/infra/nfe/mockNfeProvider");

process.env.NFE_PROVIDER = "mock";
process.env.NFE_WEBHOOK_SECRET = "hook-secret";

const fiscalCliente = {
  cidade: "Campinas",
  estado: "SP",
  endereco: "Av. Brasil",
  numero: "100",
  bairro: "Centro",
  cep: "13000000",
  codigoMunicipio: "3509502",
  inscricaoEstadual: "ISENTO",
  indIEDest: 2,
};

const fiscalProduto = {
  ncm: "25221000",
  cfopPadraoDentro: "5102",
  cfopPadraoFora: "6102",
  csosn: "102",
  origem: 0,
};

const emitenteBody = {
  cnpj: "11222333000181",
  inscricaoEstadual: "123456789",
  razaoSocial: "Colombocal LTDA",
  nomeFantasia: "Colombocal",
  crt: 1,
  logradouro: "Rua da Cal",
  numero: "10",
  bairro: "Centro",
  municipio: "Limeira",
  codigoMunicipio: "3526902",
  uf: "SP",
  cep: "13480000",
  ambiente: "homologacao",
  modalidadeFrete: 9,
};

test.beforeEach(async () => {
  await resetDb();
});

async function enableNfe() {
  const res = await agent.put("/api/config/tenant-features").send({ nfe: true });
  assert.equal(res.status, 200);
  assert.equal(res.body.nfe, true);
}

async function seedFiscal() {
  const base = await seedBase({
    cliente: fiscalCliente,
    produto: fiscalProduto,
  });
  await prisma.emitenteFiscal.create({
    data: { tenantId: base.tenant.id, ...emitenteBody },
  });
  await enableNfe();
  return base;
}

test("NF-e desligada por padrão no tenant Colombocal", async () => {
  await seedBase();
  const res = await agent.get("/api/config/tenant-features");
  assert.equal(res.status, 200);
  assert.equal(res.body.nfe, false);
});

test("módulo nfe desligado no tenant Requinte", async () => {
  await seedBase({ tenant: { slug: "requinte", name: "Requinte" } });
  const res = await agent.get("/api/config/tenant-features");
  assert.equal(res.status, 200);
  assert.equal(res.body.nfe, false);
});

test("PUT emitente fiscal mascara o token", async () => {
  await seedBase();
  const put = await agent.put("/api/config/emitente-fiscal").send({
    ...emitenteBody,
    provedorToken: "token-secreto",
  });
  assert.equal(put.status, 200);
  assert.equal(put.body.provedorToken, undefined);
  assert.equal(put.body.provedorTokenConfigurado, true);
  assert.equal(put.body.cnpj, "11222333000181");
});

test("emissão NF-e via mock + bloqueio de edição/cancelamento da venda", async () => {
  const { cliente, produto, vendedor } = await seedFiscal();
  const vendaRes = await agent.post("/api/vendas").send({
    clienteId: cliente.id,
    vendedorId: vendedor.id,
    itens: [{ produtoId: produto.id, quantidade: 2, precoUnitario: 100 }],
  });
  assert.equal(vendaRes.status, 201);
  const vendaId = vendaRes.body.id;

  const valid = await agent.get(`/api/vendas/${vendaId}/nfe/validacao`);
  assert.equal(valid.status, 200);
  assert.equal(valid.body.ok, true);

  const emit = await agent.post(`/api/vendas/${vendaId}/nfe`).send({});
  assert.equal(emit.status, 201);
  assert.equal(emit.body.status, "autorizada");
  assert.ok(emit.body.chaveAcesso);

  const detalhe = await agent.get(`/api/vendas/${vendaId}`);
  assert.equal(detalhe.status, 200);
  assert.equal(detalhe.body.podeEditar, false);
  assert.equal(detalhe.body.nfeBloqueiaEdicao, true);
  assert.equal(detalhe.body.notaFiscal.status, "autorizada");

  const put = await agent.put(`/api/vendas/${vendaId}`).send({
    clienteId: cliente.id,
    vendedorId: vendedor.id,
    itens: [{ produtoId: produto.id, quantidade: 1, precoUnitario: 100 }],
  });
  assert.equal(put.status, 400);
  assert.match(put.body.error, /NF-e autorizada/);

  const del = await agent.delete(`/api/vendas/${vendaId}`);
  assert.equal(del.status, 400);
  assert.match(del.body.error, /NF-e autorizada/);

  const danfe = await agent.get(`/api/vendas/${vendaId}/nfe/danfe`);
  assert.equal(danfe.status, 200);
  assert.match(String(danfe.headers["content-type"]), /html/);

  const xml = await agent.get(`/api/vendas/${vendaId}/nfe/xml`);
  assert.equal(xml.status, 200);
  assert.match(String(xml.text), /nfeProc/);
});

test("validação pré-emissão retorna faltas", async () => {
  const { cliente, produto, vendedor } = await seedBase({
    cliente: { cidade: "X" },
    produto: { nome: "Cal" },
  });
  await prisma.emitenteFiscal.create({
    data: { tenantId: cliente.tenantId, ...emitenteBody },
  });
  await enableNfe();
  const vendaRes = await agent.post("/api/vendas").send({
    clienteId: cliente.id,
    vendedorId: vendedor.id,
    itens: [{ produtoId: produto.id, quantidade: 1, precoUnitario: 10 }],
  });
  const valid = await agent.get(`/api/vendas/${vendaRes.body.id}/nfe/validacao`);
  assert.equal(valid.status, 200);
  assert.equal(valid.body.ok, false);
  assert.ok(valid.body.erros.length > 0);

  const emit = await agent.post(`/api/vendas/${vendaRes.body.id}/nfe`).send({});
  assert.equal(emit.status, 400);
  assert.equal(emit.body.code, "NFE_CADASTRO_INCOMPLETO");
  assert.ok(Array.isArray(emit.body.details));
});

test("cancelar NF-e autorizada libera a venda", async () => {
  const { cliente, produto, vendedor } = await seedFiscal();
  await seedMotorista(cliente.tenantId, { placa: "ABC1D23" });
  const vendaRes = await agent.post("/api/vendas").send({
    clienteId: cliente.id,
    vendedorId: vendedor.id,
    itens: [{ produtoId: produto.id, quantidade: 1, precoUnitario: 80 }],
  });
  const vendaId = vendaRes.body.id;
  const emit = await agent.post(`/api/vendas/${vendaId}/nfe`).send({});
  assert.equal(emit.status, 201);

  const curto = await agent
    .post(`/api/vendas/${vendaId}/nfe/cancelar`)
    .send({ justificativa: "curto" });
  assert.equal(curto.status, 400);

  const cancel = await agent
    .post(`/api/vendas/${vendaId}/nfe/cancelar`)
    .send({ justificativa: "Cancelamento de teste homologacao" });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.body.status, "cancelada");

  const detalhe = await agent.get(`/api/vendas/${vendaId}`);
  assert.equal(detalhe.body.nfeBloqueiaEdicao, false);
});

test("webhook atualiza status da nota", async () => {
  const { cliente, produto, vendedor } = await seedFiscal();
  const vendaRes = await agent.post("/api/vendas").send({
    clienteId: cliente.id,
    vendedorId: vendedor.id,
    itens: [{ produtoId: produto.id, quantidade: 1, precoUnitario: 80 }],
  });
  const vendaId = vendaRes.body.id;
  const emit = await agent.post(`/api/vendas/${vendaId}/nfe`).send({});
  const ref = emit.body.refProvedor;

  const semAuth = await agent.post("/api/webhooks/nfe").send({
    ref,
    status: "cancelado",
  });
  assert.equal(semAuth.status, 401);

  const ok = await agent
    .post("/api/webhooks/nfe")
    .set("x-webhook-token", "hook-secret")
    .send({
      ref,
      status: "cancelado",
      mensagem_sefaz: "Cancelado via webhook",
    });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.status, "cancelada");
});

test("cadastro de cliente persiste campos fiscais", async () => {
  await seedBase();
  const res = await agent.post("/api/clientes").send({
    razaoSocial: "Fiscal LTDA",
    cnpj: "33444555000199",
    cidade: "Limeira",
    estado: "SP",
    endereco: "Rua X",
    numero: "1",
    bairro: "Centro",
    cep: "13480-000",
    codigoMunicipio: "3526902",
    inscricaoEstadual: "ISENTO",
    indIEDest: 2,
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.cep, "13480000");
  assert.equal(res.body.codigoMunicipio, "3526902");
  assert.equal(res.body.inscricaoEstadual, "ISENTO");
});

test("cadastro de produto persiste NCM/CFOP", async () => {
  await seedBase();
  const res = await agent.post("/api/produtos").send({
    nome: "Cal Pintura",
    codigo: "CAL-PINT",
    precoPadrao: 10,
    unidade: "saco",
    ncm: "2522.20.00",
    cfopPadraoDentro: "5102",
    cfopPadraoFora: "6102",
    csosn: "102",
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.ncm, "25222000");
  assert.equal(res.body.cfopPadraoDentro, "5102");
});

test("POST /api/vendas sem emitirNfe não cria nota fiscal", async () => {
  const { cliente, produto, vendedor } = await seedFiscal();
  const vendaRes = await agent.post("/api/vendas").send({
    clienteId: cliente.id,
    vendedorId: vendedor.id,
    itens: [{ produtoId: produto.id, quantidade: 1, precoUnitario: 50 }],
  });
  assert.equal(vendaRes.status, 201);
  assert.equal(vendaRes.body.notaFiscal, null);
  assert.equal(vendaRes.body.nfeErro, undefined);
  const notas = await prisma.notaFiscal.findMany({ where: { vendaId: vendaRes.body.id } });
  assert.equal(notas.length, 0);
});

test("POST /api/vendas com emitirNfe emite no mesmo request", async () => {
  const { cliente, produto, vendedor } = await seedFiscal();
  const vendaRes = await agent.post("/api/vendas").send({
    clienteId: cliente.id,
    vendedorId: vendedor.id,
    itens: [{ produtoId: produto.id, quantidade: 1, precoUnitario: 50 }],
    emitirNfe: true,
  });
  assert.equal(vendaRes.status, 201);
  assert.equal(vendaRes.body.nfeErro, undefined);
  assert.equal(vendaRes.body.notaFiscal.status, "autorizada");
  assert.equal(vendaRes.body.nfeBloqueiaEdicao, true);

  const lista = await agent.get("/api/vendas");
  assert.equal(lista.status, 200);
  const row = lista.body.find((v) => v.id === vendaRes.body.id);
  assert.ok(row);
  assert.equal(row.notaFiscal.status, "autorizada");
});

test("POST /api/vendas com emitirNfe grava a venda se a nota falhar", async () => {
  const { cliente, produto, vendedor } = await seedBase({
    cliente: { cidade: "X" },
    produto: { nome: "Cal" },
  });
  await prisma.emitenteFiscal.create({
    data: { tenantId: cliente.tenantId, ...emitenteBody },
  });
  await enableNfe();
  const vendaRes = await agent.post("/api/vendas").send({
    clienteId: cliente.id,
    vendedorId: vendedor.id,
    itens: [{ produtoId: produto.id, quantidade: 1, precoUnitario: 10 }],
    emitirNfe: true,
  });
  assert.equal(vendaRes.status, 201);
  assert.ok(vendaRes.body.id);
  assert.ok(vendaRes.body.nfeErro);
  assert.equal(vendaRes.body.nfeErro.code, "NFE_CADASTRO_INCOMPLETO");
  assert.ok(Array.isArray(vendaRes.body.nfeErro.details));
  assert.equal(vendaRes.body.notaFiscal, null);
});

test("mock provider can reject", async () => {
  const rejecting = createMockNfeProvider({
    emitir: async () => ({
      status: "rejeitada",
      motivoRejeicao: "Rejeicao de teste",
      raw: { status: "erro_autorizacao" },
    }),
  });
  const out = await rejecting.emitir({ ref: "x", payload: {} });
  assert.equal(out.status, "rejeitada");
});
