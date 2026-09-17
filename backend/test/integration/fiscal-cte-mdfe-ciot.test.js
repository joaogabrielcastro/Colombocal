const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const {
  agent,
  prisma,
  resetDb,
  seedBase,
} = require("../helpers/testServer");
const { STATUS: CTE_STATUS } = require("../../src/domain/cte/constants");
const { STATUS: MDFE_STATUS } = require("../../src/domain/mdfe/constants");
const { STATUS: CIOT_STATUS } = require("../../src/domain/ciot/constants");
const { createMockCteProvider } = require("../../src/infra/cte/provider");
const { createMockMdfeProvider } = require("../../src/infra/mdfe/provider");
const { createMockCiotProvider } = require("../../src/infra/ciot/provider");
const { createNaoImplementadoCiotProvider } = require("../../src/infra/ciot/provider");
const { emitirCte } = require("../../src/application/use-cases/emitirCte");
const { emitirMdfe } = require("../../src/application/use-cases/emitirMdfe");
const { encerrarMdfe } = require("../../src/application/use-cases/gerirMdfe");
const { registrarCiot } = require("../../src/application/use-cases/registrarCiot");
const { resumoFiscalMulti } = require("../../src/domain/fiscal");
const { refCteTentativa } = require("../../src/domain/cte/refCte");

process.env.NFE_PROVIDER = "mock";
process.env.CTE_PROVIDER = "mock";
process.env.MDFE_PROVIDER = "mock";
process.env.CIOT_PROVIDER = "mock";

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
  rntrc: "12345678",
  serieCte: 1,
  serieMdfe: 1,
};

test.beforeEach(async () => {
  await resetDb();
});

async function enableFlags(tenantId, flags = {}) {
  const all = {
    CTE_ENABLED: true,
    MDFE_ENABLED: true,
    CIOT_ENABLED: true,
    ...flags,
  };
  for (const [chave, on] of Object.entries(all)) {
    await prisma.configSistema.upsert({
      where: { tenantId_chave: { tenantId, chave } },
      create: { tenantId, chave, valor: on ? "true" : "false" },
      update: { valor: on ? "true" : "false" },
    });
  }
}

async function seedTransporteTenant(opts = {}) {
  const base = await seedBase({
    tenant: opts.tenant || { slug: "default", name: "Colombocal" },
  });
  await prisma.emitenteFiscal.create({
    data: { tenantId: base.tenant.id, ...emitenteBody },
  });
  await enableFlags(base.tenant.id, opts.flags);
  return base;
}

async function createMember(tenantId, { email, navPermissions, password = "segredo123" }) {
  const passwordHash = await bcrypt.hash(password, 4);
  return prisma.user.create({
    data: {
      tenantId,
      email,
      passwordHash,
      name: email,
      role: "member",
      navPermissions,
    },
  });
}

const cteInput = {
  remetenteNome: "Remetente SA",
  remetenteDoc: "98765432000198",
  destinatarioNome: "Destinatario LTDA",
  destinatarioDoc: "11222333000181",
  origemMunicipio: "Limeira",
  origemUf: "SP",
  origemCodigoMunicipio: "3526902",
  destinoMunicipio: "Campinas",
  destinoUf: "SP",
  destinoCodigoMunicipio: "3509502",
  valorServico: 150,
  valorCarga: 1000,
  pesoKg: 500,
};

test("refCteTentativa estável sem Date.now", () => {
  assert.equal(refCteTentativa({ tenantId: 1, docId: 9, tentativa: 1 }), "cte-1-doc-9");
  assert.equal(
    refCteTentativa({ tenantId: 1, freteMovimentoId: 5, tentativa: 2 }),
    "cte-1-frete-5-t2",
  );
});

test("CT-e emissão mock + isolamento + ACL", async () => {
  process.env.DEFAULT_TENANT_ID = "1";
  const a = await seedTransporteTenant({ tenant: { slug: "default", name: "A" } });
  const b = await seedTransporteTenant({ tenant: { slug: "outro", name: "B" } });
  assert.equal(a.tenant.id, 1);

  const doc = await emitirCte(prisma, {
    tenantId: a.tenant.id,
    input: cteInput,
    provider: createMockCteProvider(),
  });
  assert.equal(doc.status, CTE_STATUS.AUTORIZADA);
  assert.ok(doc.refProvedor.startsWith("cte-1-"));

  const lista = await agent.get("/api/fiscal/cte");
  assert.equal(lista.status, 200);
  assert.equal(lista.body.length, 1);

  const cross = await agent.get(`/api/fiscal/cte/${doc.id}`);
  assert.equal(cross.status, 200);

  // Tenant B doc must not appear under DEFAULT_TENANT_ID=1
  const docB = await emitirCte(prisma, {
    tenantId: b.tenant.id,
    input: cteInput,
    provider: createMockCteProvider(),
  });
  const crossDetail = await agent.get(`/api/fiscal/cte/${docB.id}`);
  assert.equal(crossDetail.status, 404);

  await createMember(a.tenant.id, {
    email: "com-fiscal-cte@local",
    navPermissions: ["fiscal"],
  });
  await createMember(a.tenant.id, {
    email: "sem-fiscal-cte@local",
    navPermissions: ["vendas"],
  });

  const prev = process.env.AUTH_DISABLED;
  process.env.AUTH_DISABLED = "false";
  try {
    const okLogin = await agent
      .post("/api/auth/login")
      .send({ email: "com-fiscal-cte@local", password: "segredo123" });
    assert.equal(okLogin.status, 200);
    const ok = await agent
      .get("/api/fiscal/cte")
      .set("Authorization", `Bearer ${okLogin.body.token}`);
    assert.equal(ok.status, 200);

    const noLogin = await agent
      .post("/api/auth/login")
      .send({ email: "sem-fiscal-cte@local", password: "segredo123" });
    const denied = await agent
      .get("/api/fiscal/cte")
      .set("Authorization", `Bearer ${noLogin.body.token}`);
    assert.equal(denied.status, 403);
  } finally {
    process.env.AUTH_DISABLED = prev;
  }
});

test("MDF-e emissão + encerramento", async () => {
  const base = await seedTransporteTenant();
  const provider = createMockMdfeProvider();
  const chave = "35220911222333000181550010000000011000000010";
  const doc = await emitirMdfe(prisma, {
    tenantId: base.tenant.id,
    input: {
      ufInicio: "SP",
      ufFim: "MG",
      veiculoPlaca: "ABC1D23",
      motoristaNome: "João",
      documentos: [{ tipo: "nfe", chaveAcesso: chave }],
    },
    provider,
  });
  assert.equal(doc.status, MDFE_STATUS.AUTORIZADA);
  assert.equal(doc.documentos.length, 1);

  const enc = await encerrarMdfe(prisma, {
    tenantId: base.tenant.id,
    id: doc.id,
    data: "2026-09-17",
    siglaUf: "MG",
    nomeMunicipio: "Uberlandia",
    provider,
  });
  assert.equal(enc.status, MDFE_STATUS.ENCERRADA);
  assert.equal(enc.ufEncerramento, "MG");
});

test("CIOT mock vs NAO_IMPLEMENTADO", async () => {
  const base = await seedTransporteTenant();
  const ok = await registrarCiot(prisma, {
    tenantId: base.tenant.id,
    input: {
      transportadorNome: "Transp SA",
      contratanteNome: "Colombocal",
      origemMunicipio: "Limeira",
      origemUf: "SP",
      destinoMunicipio: "Campinas",
      destinoUf: "SP",
      valorOperacao: 200,
    },
    provider: createMockCiotProvider(),
  });
  assert.equal(ok.status, CIOT_STATUS.REGISTRADO);
  assert.ok(String(ok.codigoCiot).startsWith("DEMO"));

  await assert.rejects(
    () =>
      registrarCiot(prisma, {
        tenantId: base.tenant.id,
        input: {
          transportadorNome: "T",
          contratanteNome: "C",
          origemMunicipio: "A",
          origemUf: "SP",
          destinoMunicipio: "B",
          destinoUf: "SP",
          valorOperacao: 1,
        },
        provider: createNaoImplementadoCiotProvider(),
      }),
    (err) => err.code === "CIOT_NAO_IMPLEMENTADO",
  );
});

test("resumoFiscalMulti separa valores por tipo", () => {
  const multi = resumoFiscalMulti({
    notas: [{ status: "autorizada", venda: { valorTotal: 1000 } }],
    ctes: [{ status: "autorizada", valorServico: 150 }],
    mdfes: [{ status: "encerrada" }, { status: "autorizada" }],
    ciots: [{ status: "registrado", valorOperacao: 80 }],
  });
  assert.equal(multi.nfe.valorAutorizado, 1000);
  assert.equal(multi.cte.valorServicoAutorizado, 150);
  assert.equal(multi.ciot.valorRegistrado, 80);
  assert.equal(multi.mdfe.encerradas, 1);
});

test("API CT-e feature flag 403", async () => {
  process.env.DEFAULT_TENANT_ID = "1";
  await seedTransporteTenant({ flags: { CTE_ENABLED: false } });
  const res = await agent.get("/api/fiscal/cte");
  assert.equal(res.status, 403);
  assert.equal(res.body.code, "CTE_DESABILITADO");
});
