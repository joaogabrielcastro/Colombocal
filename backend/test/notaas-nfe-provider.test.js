const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createNotaasNfeProvider,
  mapStatusNotaas,
  normalizeNotaasResponse,
  safeDocumentUrl,
} = require("../src/infra/nfe/notaasNfeProvider");
const { montarPayloadNotaas } = require("../src/domain/nfe/montarPayload");

test("Nôtaas normaliza estados e invoiceId", () => {
  assert.equal(mapStatusNotaas("issued"), "autorizada");
  assert.equal(mapStatusNotaas("cancelled"), "cancelada");
  assert.equal(mapStatusNotaas("error"), "rejeitada");
  const row = normalizeNotaasResponse({ invoiceId: "123", status: "queued" });
  assert.equal(row.status, "processando");
  assert.equal(row.refProvedor, "123");
  assert.match(row.xmlUrl, /\/123\/xml$/);
});

test("Nôtaas bloqueia download fora da origem fiscal", () => {
  const ok = "https://platform.notaas.com.br/api/v1/nfe/invoices/abc-123/xml";
  assert.equal(safeDocumentUrl(ok), ok);
  assert.throws(() => safeDocumentUrl("http://platform.notaas.com.br/api/v1/nfe/invoices/abc/xml"));
  assert.throws(() => safeDocumentUrl("https://atacante.test/api/v1/nfe/invoices/abc/xml"));
  assert.throws(() => safeDocumentUrl("https://platform.notaas.com.br/api/v1/nfe/invoices/abc/status"));
});

test("Nôtaas emite, consulta e cancela pelo invoiceId", async () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  const calls = [];
  const http = {
    async post(url, body) {
      calls.push({ method: "post", url, body });
      if (url.endsWith("/cancelar")) return { status: 202, data: { invoiceId: id, status: "processing" } };
      return { status: 202, data: { invoiceId: id, status: "queued" } };
    },
    async get(url) {
      calls.push({ method: "get", url });
      return { status: 200, data: { invoiceId: id, status: "issued", numero: 7 } };
    },
  };
  const provider = createNotaasNfeProvider({ token: "ntaas_test", http });
  assert.equal((await provider.emitir({ payload: { modelo: 55 } })).refProvedor, id);
  assert.equal((await provider.consultar({ ref: id })).status, "autorizada");
  assert.equal((await provider.cancelar({ ref: id, justificativa: "Motivo válido para cancelar" })).status, "processando");
  assert.equal(calls[2].body.invoiceId, id);
  assert.equal(calls[2].body.motivo, "Motivo válido para cancelar");
});

test("Nôtaas não libera reemissão sem invoiceId confirmado", async () => {
  const provider = createNotaasNfeProvider({ token: "ntaas_test", http: {} });
  await assert.rejects(() => provider.consultar({ ref: "nfe-tenant-venda-1" }), (err) => {
    assert.equal(err.code, "NFE_PROVEDOR_INDISPONIVEL");
    return true;
  });
});

test("payload Nôtaas usa o contrato camelCase documentado", () => {
  const payload = montarPayloadNotaas({
    emitente: { cnpj: "11222333000181", inscricaoEstadual: "123", uf: "PR", crt: 1, modalidadeFrete: 9 },
    cliente: {
      tipoPessoa: "PJ", cnpj: "12345678000195", razaoSocial: "Cliente Teste", inscricaoEstadual: "ISENTO",
      logradouro: "Rua A", numero: "10", bairro: "Centro", cidade: "Curitiba", estado: "PR",
      cep: "80000000", codigoMunicipio: "4106902",
    },
    venda: { numeroVenda: 10, dataVenda: "2026-10-03T12:00:00-03:00" },
    itens: [{ produtoId: 1, quantidade: 2, precoUnitario: 10 }],
    produtosPorId: new Map([[1, { codigo: "P1", nome: "Produto", unidade: "UN", ncm: "25221000", cfopInterno: "5102", csosn: "102", origem: 0 }]]),
  });
  assert.equal(payload.modelo, 55);
  assert.equal(payload.dest.endereco.codigoMunicipio, 4106902);
  assert.equal(payload.items[0].csosn, "102");
  assert.equal(payload.items[0].valorTotal, 20);
  assert.equal(payload.pagamentos[0].valor, 20);
  assert.equal(payload.cnpj_emitente, undefined);
});
