const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getClienteCreateSchema,
  clienteUpdateSchema,
  clientePrecosSchema,
  clienteComissoesSchema,
} = require("../src/schemas/cliente");

// ---- PJ (CNPJ) ----
test("create PJ: exige CNPJ com 14 dígitos", () => {
  const schema = getClienteCreateSchema({ allowsClienteCpf: false });
  const bad = schema.safeParse({ razaoSocial: "Empresa", cnpj: "123" });
  assert.equal(bad.success, false);

  const ok = schema.safeParse({ razaoSocial: "Empresa", cnpj: "11.222.333/0001-81" });
  assert.equal(ok.success, true);
  assert.equal(ok.data.tipoPessoa, "PJ");
  assert.equal(ok.data.cnpj, "11222333000181");
  assert.equal(ok.data.cpf, null);
});

test("create PJ: default vira PJ quando CPF não permitido", () => {
  const schema = getClienteCreateSchema({ allowsClienteCpf: false });
  const res = schema.safeParse({ razaoSocial: "X", cnpj: "11222333000181" });
  assert.equal(res.success, true);
  assert.equal(res.data.tipoPessoa, "PJ");
});

// ---- PF (CPF) ----
test("create PF: bloqueado quando organização não permite CPF", () => {
  const schema = getClienteCreateSchema({ allowsClienteCpf: false });
  const res = schema.safeParse({ razaoSocial: "Fulano", tipoPessoa: "PF", cpf: "39053344705" });
  assert.equal(res.success, false);
  assert.match(JSON.stringify(res.error.issues), /não disponível/);
});

test("create PF: exige CPF quando permitido", () => {
  const schema = getClienteCreateSchema({ allowsClienteCpf: true });
  const semCpf = schema.safeParse({ razaoSocial: "Fulano", tipoPessoa: "PF" });
  assert.equal(semCpf.success, false);
  assert.match(JSON.stringify(semCpf.error.issues), /CPF é obrigatório/);
});

test("create PF: rejeita CPF inválido", () => {
  const schema = getClienteCreateSchema({ allowsClienteCpf: true });
  const res = schema.safeParse({ razaoSocial: "Fulano", tipoPessoa: "PF", cpf: "11111111111" });
  assert.equal(res.success, false);
  assert.match(JSON.stringify(res.error.issues), /CPF inválido/);
});

test("create PF: aceita CPF válido e normaliza", () => {
  const schema = getClienteCreateSchema({ allowsClienteCpf: true });
  const res = schema.safeParse({ razaoSocial: "Fulano", tipoPessoa: "PF", cpf: "390.533.447-05" });
  assert.equal(res.success, true);
  assert.equal(res.data.tipoPessoa, "PF");
  assert.equal(res.data.cpf, "39053344705");
  assert.equal(res.data.cnpj, null);
});

test("create: default vira PF quando CPF permitido e sem tipo", () => {
  const schema = getClienteCreateSchema({ allowsClienteCpf: true });
  const res = schema.safeParse({ razaoSocial: "Fulano", cpf: "39053344705" });
  assert.equal(res.success, true);
  assert.equal(res.data.tipoPessoa, "PF");
});

// ---- update ----
test("update: aceita campos parciais", () => {
  const res = clienteUpdateSchema.safeParse({ razaoSocial: "Novo", ativo: false });
  assert.equal(res.success, true);
});

test("update: omitir CEP/IE não zera campos fiscais", () => {
  const res = clienteUpdateSchema.safeParse({ razaoSocial: "Novo" });
  assert.equal(res.success, true);
  assert.equal(res.data.cep, undefined);
  assert.equal(res.data.inscricaoEstadual, undefined);
  assert.equal(res.data.indIEDest, undefined);
});

test("update: rejeita razaoSocial vazia", () => {
  const res = clienteUpdateSchema.safeParse({ razaoSocial: "" });
  assert.equal(res.success, false);
});

// ---- precos / comissoes ----
test("precos: exige ao menos um item", () => {
  assert.equal(clientePrecosSchema.safeParse({ precos: [] }).success, false);
  const ok = clientePrecosSchema.safeParse({ precos: [{ produtoId: 1, preco: 10 }] });
  assert.equal(ok.success, true);
});

test("comissoes: exige item e coage null para 0", () => {
  assert.equal(clienteComissoesSchema.safeParse({ comissoes: [] }).success, false);
  const ok = clienteComissoesSchema.safeParse({
    comissoes: [{ produtoId: 1, comissaoPercentual: null }],
  });
  assert.equal(ok.success, true);
  // z.coerce.number() converte null -> 0 (primeira opção do union vence)
  assert.equal(ok.data.comissoes[0].comissaoPercentual, 0);
});
