const test = require("node:test");
const assert = require("node:assert/strict");
const { refCteTentativa } = require("../src/domain/cte/refCte");
const { refMdfeTentativa } = require("../src/domain/mdfe/refMdfe");
const { refCiotTentativa } = require("../src/domain/ciot/constants");
const { resumoFiscalMulti } = require("../src/domain/fiscal");
const { validarPreEmissaoCte } = require("../src/domain/cte/montarPayload");
const { validarPreEmissaoMdfe } = require("../src/domain/mdfe/montarPayload");
const { validarRegistroCiot } = require("../src/domain/ciot/constants");
const { resolveCiotProviderName } = require("../src/infra/ciot/provider");

test("refs estáveis sem Date.now", () => {
  assert.equal(refCteTentativa({ tenantId: 1, docId: 9, tentativa: 1 }), "cte-1-doc-9");
  assert.equal(refMdfeTentativa({ tenantId: 2, docId: 3, tentativa: 2 }), "mdfe-2-doc-3-t2");
  assert.equal(
    refCiotTentativa({ tenantId: 1, freteMovimentoId: 8, tentativa: 1 }),
    "ciot-1-frete-8",
  );
});

test("resumoFiscalMulti não mistura valores", () => {
  const m = resumoFiscalMulti({
    notas: [{ status: "autorizada", venda: { valorTotal: 100 } }],
    ctes: [{ status: "autorizada", valorServico: 40 }],
    mdfes: [{ status: "encerrada" }],
    ciots: [{ status: "registrado", valorOperacao: 25 }],
  });
  assert.equal(m.nfe.valorAutorizado, 100);
  assert.equal(m.cte.valorServicoAutorizado, 40);
  assert.equal(m.ciot.valorRegistrado, 25);
  assert.equal(m.mdfe.encerradas, 1);
});

test("validações pré-emissão", () => {
  const cte = validarPreEmissaoCte({
    emitente: { cnpj: "11222333000181", rntrc: "12345678" },
    input: {
      origemMunicipio: "A",
      origemUf: "SP",
      destinoMunicipio: "B",
      destinoUf: "SP",
      remetenteNome: "R",
      destinatarioNome: "D",
    },
  });
  assert.equal(cte.ok, true);

  const mdfe = validarPreEmissaoMdfe({
    emitente: { cnpj: "1" },
    input: { ufInicio: "SP", ufFim: "MG", veiculoPlaca: "ABC1D23" },
    documentos: [{ tipo: "nfe", chaveAcesso: "1".repeat(44) }],
  });
  assert.equal(mdfe.ok, true);

  const ciot = validarRegistroCiot({
    transportadorNome: "T",
    contratanteNome: "C",
    origemMunicipio: "A",
    origemUf: "SP",
    destinoMunicipio: "B",
    destinoUf: "SP",
    valorOperacao: 10,
  });
  assert.equal(ciot.ok, true);
});

test("CIOT provider default não é mock em production-like", () => {
  const prev = process.env.NODE_ENV;
  const prevP = process.env.CIOT_PROVIDER;
  try {
    process.env.NODE_ENV = "production";
    delete process.env.CIOT_PROVIDER;
    assert.equal(resolveCiotProviderName(), "nao_implementado");
  } finally {
    process.env.NODE_ENV = prev;
    if (prevP != null) process.env.CIOT_PROVIDER = prevP;
    else delete process.env.CIOT_PROVIDER;
  }
});
