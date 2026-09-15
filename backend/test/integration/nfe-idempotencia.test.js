const test = require("node:test");
const assert = require("node:assert/strict");
const { agent, prisma, resetDb, seedBase, seedTenant } = require("../helpers/testServer");
const { emitirNfe } = require("../../src/application/use-cases/emitirNfe");
const { consultarNfe, aplicarWebhookNfe } = require("../../src/application/use-cases/gerirNfe");
const { AppError } = require("../../src/shared/errors/appError");
const { STATUS } = require("../../src/domain/nfe/constants");
const { refNfeTentativa } = require("../../src/domain/nfe/refNfe");

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
}

async function seedFiscal(tenantOver = {}) {
  const base = await seedBase({
    tenant: tenantOver.tenant,
    cliente: fiscalCliente,
    produto: fiscalProduto,
  });
  await prisma.emitenteFiscal.create({
    data: { tenantId: base.tenant.id, ...emitenteBody },
  });
  await enableNfe();
  return base;
}

async function criarVenda(cliente, produto, vendedor) {
  const vendaRes = await agent.post("/api/vendas").send({
    clienteId: cliente.id,
    vendedorId: vendedor.id,
    itens: [{ produtoId: produto.id, quantidade: 1, precoUnitario: 80 }],
  });
  assert.equal(vendaRes.status, 201);
  return vendaRes.body;
}

function timeoutErr(code = "ECONNABORTED") {
  const err = new Error("timeout of 45000ms exceeded");
  err.code = code;
  return err;
}

test("cenário 1: emissão normal cria uma única ref determinística", async () => {
  const { tenant, cliente, produto, vendedor } = await seedFiscal();
  const venda = await criarVenda(cliente, produto, vendedor);
  const emit = await agent.post(`/api/vendas/${venda.id}/nfe`).send({});
  assert.equal(emit.status, 201);
  const expected = refNfeTentativa(tenant.id, venda.id, 1);
  assert.equal(emit.body.refProvedor, expected);
  const notas = await prisma.notaFiscal.findMany({ where: { vendaId: venda.id } });
  assert.equal(notas.length, 1);
  assert.equal(notas[0].refProvedor, expected);
  assert.equal(String(notas[0].refProvedor).includes(String(Date.now()).slice(0, 8)), false);
});

test("cenário 2: mesma venda não cria segunda emissão nem nova ref", async () => {
  const { tenant, cliente, produto, vendedor } = await seedFiscal();
  const venda = await criarVenda(cliente, produto, vendedor);
  const first = await agent.post(`/api/vendas/${venda.id}/nfe`).send({});
  assert.equal(first.status, 201);
  const ref = first.body.refProvedor;
  assert.equal(ref, `venda-${tenant.id}-${venda.id}`);

  const second = await agent.post(`/api/vendas/${venda.id}/nfe`).send({});
  assert.equal(second.status, 409);
  assert.equal(second.body.code, "NFE_JA_EXISTE");

  const notas = await prisma.notaFiscal.findMany({ where: { vendaId: venda.id } });
  assert.equal(notas.length, 1);
  assert.equal(notas[0].refProvedor, ref);
});

test("cenário 3: timeout após o provedor aceitar — consulta a ref e não reemite", async () => {
  const { tenant, cliente, produto, vendedor } = await seedFiscal();
  const venda = await criarVenda(cliente, produto, vendedor);
  const store = new Map();
  let emitirCalls = 0;
  const provider = {
    name: "mock-timeout-exists",
    async emitir({ ref, payload }) {
      emitirCalls += 1;
      store.set(ref, {
        status: STATUS.AUTORIZADA,
        serie: 1,
        numero: 9,
        chaveAcesso: "1".repeat(44),
        protocolo: "PROT-1",
        raw: { mock: true, ref, payload },
      });
      throw timeoutErr("ECONNABORTED");
    },
    async consultar({ ref }) {
      const found = store.get(ref);
      if (!found) {
        const err = new Error("ausente");
        err.httpStatus = 404;
        throw err;
      }
      return found;
    },
    async cancelar() {
      throw new Error("não deveria cancelar");
    },
  };

  await assert.rejects(
    () => emitirNfe(prisma, { tenantId: tenant.id, vendaId: venda.id, provider }),
    (err) => {
      assert.equal(err.code, "NFE_STATUS_INCERTO");
      return true;
    },
  );
  assert.equal(emitirCalls, 1);
  const aposTimeout = await prisma.notaFiscal.findMany({ where: { vendaId: venda.id } });
  assert.equal(aposTimeout.length, 1);
  assert.equal(aposTimeout[0].status, STATUS.PROCESSANDO);
  const ref = aposTimeout[0].refProvedor;
  assert.equal(ref, `venda-${tenant.id}-${venda.id}`);

  const retry = await emitirNfe(prisma, {
    tenantId: tenant.id,
    vendaId: venda.id,
    provider,
  });
  assert.equal(retry.status, STATUS.AUTORIZADA);
  assert.equal(retry.refProvedor, ref);
  assert.equal(emitirCalls, 1);
  const notas = await prisma.notaFiscal.findMany({ where: { vendaId: venda.id } });
  assert.equal(notas.length, 1);
});

test("cenário 4: timeout + provedor 404 permite nova tentativa com a mesma ref", async () => {
  const { tenant, cliente, produto, vendedor } = await seedFiscal();
  const venda = await criarVenda(cliente, produto, vendedor);
  let emitirCalls = 0;
  const provider = {
    name: "mock-timeout-absent",
    async emitir({ ref }) {
      emitirCalls += 1;
      if (emitirCalls === 1) throw timeoutErr("ETIMEDOUT");
      return {
        status: STATUS.AUTORIZADA,
        serie: 1,
        numero: 3,
        chaveAcesso: "2".repeat(44),
        protocolo: "PROT-2",
        raw: { mock: true, ref },
      };
    },
    async consultar() {
      const err = new Error("Nota mock não encontrada");
      err.httpStatus = 404;
      throw err;
    },
    async cancelar() {},
  };

  await assert.rejects(
    () => emitirNfe(prisma, { tenantId: tenant.id, vendaId: venda.id, provider }),
    (err) => err.code === "NFE_STATUS_INCERTO",
  );
  const aposTimeout = await prisma.notaFiscal.findMany({ where: { vendaId: venda.id } });
  assert.equal(aposTimeout.length, 1);
  assert.equal(aposTimeout[0].status, STATUS.PROCESSANDO);
  const ref = aposTimeout[0].refProvedor;

  const retry = await emitirNfe(prisma, {
    tenantId: tenant.id,
    vendaId: venda.id,
    provider,
  });
  assert.equal(retry.status, STATUS.AUTORIZADA);
  assert.equal(retry.refProvedor, ref);
  assert.equal(emitirCalls, 2);
  const notas = await prisma.notaFiscal.findMany({ where: { vendaId: venda.id } });
  assert.equal(notas.length, 1);
});

test("cenário 5: webhook atualiza emissão com ref determinística", async () => {
  const { tenant, cliente, produto, vendedor } = await seedFiscal();
  const venda = await criarVenda(cliente, produto, vendedor);
  const emit = await agent.post(`/api/vendas/${venda.id}/nfe`).send({});
  const ref = emit.body.refProvedor;
  assert.equal(ref, `venda-${tenant.id}-${venda.id}`);

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

  const viaUseCase = await aplicarWebhookNfe(prisma, {
    ref,
    body: { ref, status: "autorizado" },
  });
  assert.equal(viaUseCase.status, STATUS.AUTORIZADA);
});

test("cenário 6: tenant B não consulta nem emite NF-e da venda do tenant A", async () => {
  const a = await seedFiscal();
  const venda = await criarVenda(a.cliente, a.produto, a.vendedor);
  const emit = await agent.post(`/api/vendas/${venda.id}/nfe`).send({});
  assert.equal(emit.status, 201);

  const tenantB = await seedTenant({ slug: "requinte", name: "Requinte" });
  await prisma.emitenteFiscal.create({
    data: { tenantId: tenantB.id, ...emitenteBody, cnpj: "99888777000166" },
  });

  await assert.rejects(
    () => consultarNfe(prisma, { tenantId: tenantB.id, vendaId: venda.id }),
    (err) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.code, "NFE_NAO_ENCONTRADA");
      return true;
    },
  );
  await assert.rejects(
    () => emitirNfe(prisma, { tenantId: tenantB.id, vendaId: venda.id }),
    (err) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.code, "VENDA_NAO_ENCONTRADA");
      return true;
    },
  );

  const notaA = await prisma.notaFiscal.findFirst({
    where: { tenantId: a.tenant.id, vendaId: venda.id },
  });
  assert.ok(notaA);
  assert.equal(notaA.status, STATUS.AUTORIZADA);
});
