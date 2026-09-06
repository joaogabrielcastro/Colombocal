const test = require("node:test");
const assert = require("node:assert/strict");
const { validarPreEmissaoNfe } = require("../src/domain/nfe/validarPreEmissao");
const { montarPayloadFocus } = require("../src/domain/nfe/montarPayload");
const { inferIndIEDest, cfopParaUf, statusBloqueiaVenda } = require("../src/domain/nfe/constants");

const emitenteOk = {
  cnpj: "11222333000181",
  inscricaoEstadual: "123456789",
  razaoSocial: "Colombocal LTDA",
  logradouro: "Rua A",
  numero: "10",
  bairro: "Centro",
  municipio: "Limeira",
  codigoMunicipio: "3526902",
  uf: "SP",
  cep: "13480000",
  crt: 1,
};

const clienteOk = {
  tipoPessoa: "PJ",
  cnpj: "99888777000166",
  razaoSocial: "Cliente LTDA",
  inscricaoEstadual: "ISENTO",
  indIEDest: 2,
  endereco: "Av. B",
  numero: "20",
  bairro: "Industrial",
  cidade: "Campinas",
  estado: "SP",
  cep: "13000000",
  codigoMunicipio: "3509502",
};

const produtoOk = {
  id: 1,
  nome: "Cal Virgem",
  codigo: "CAL-VIV-001",
  ncm: "25221000",
  cfopPadraoDentro: "5102",
  cfopPadraoFora: "6102",
  origem: 0,
  csosn: "102",
  unidade: "ton",
};

test("validarPreEmissao: ok com cadastros completos", () => {
  const r = validarPreEmissaoNfe({
    emitente: emitenteOk,
    cliente: clienteOk,
    itens: [{ produtoId: 1, quantidade: 2, precoUnitario: 100 }],
    produtosPorId: new Map([[1, produtoOk]]),
  });
  assert.equal(r.ok, true);
  assert.equal(r.erros.length, 0);
});

test("validarPreEmissao: lista faltas de emitente e NCM", () => {
  const r = validarPreEmissaoNfe({
    emitente: null,
    cliente: { ...clienteOk, cep: null, codigoMunicipio: null },
    itens: [{ produtoId: 1, quantidade: 1, precoUnitario: 10 }],
    produtosPorId: new Map([[1, { ...produtoOk, ncm: null, csosn: null }]]),
  });
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => /emitente/i.test(e)));
  assert.ok(r.erros.some((e) => /CEP/i.test(e)));
  assert.ok(r.erros.some((e) => /NCM/i.test(e)));
});

test("montarPayloadFocus: só produtos, frete zerado na modalidade", () => {
  const payload = montarPayloadFocus({
    emitente: { ...emitenteOk, modalidadeFrete: 9, naturezaOperacao: "Venda" },
    cliente: clienteOk,
    venda: { numeroVenda: 12, dataVenda: new Date("2026-01-15T15:00:00Z") },
    itens: [{ produtoId: 1, quantidade: 2, precoUnitario: 50 }],
    produtosPorId: new Map([[1, produtoOk]]),
    motorista: { nome: "João", placa: "ABC1D23" },
  });
  assert.equal(payload.modalidade_frete, 9);
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].valor_bruto, "100.00");
  assert.equal(payload.cpf_destinatario, undefined);
  assert.equal(payload.cnpj_destinatario, "99888777000166");
  assert.match(payload.informacoes_adicionais_contribuinte, /Frete cobrado à parte/);
  assert.equal(payload.nome_transportador, "João");
});

test("cfop intra vs inter", () => {
  assert.equal(cfopParaUf(produtoOk, "SP", "SP"), "5102");
  assert.equal(cfopParaUf(produtoOk, "MG", "SP"), "6102");
});

test("inferIndIEDest", () => {
  assert.equal(inferIndIEDest({ tipoPessoa: "PF" }), 9);
  assert.equal(inferIndIEDest({ tipoPessoa: "PJ", inscricaoEstadual: "ISENTO" }), 2);
  assert.equal(inferIndIEDest({ tipoPessoa: "PJ", inscricaoEstadual: "123" }), 1);
});

test("statusBloqueiaVenda", () => {
  assert.equal(statusBloqueiaVenda("autorizada"), true);
  assert.equal(statusBloqueiaVenda("processando"), true);
  assert.equal(statusBloqueiaVenda("rejeitada"), false);
  assert.equal(statusBloqueiaVenda("cancelada"), false);
});
