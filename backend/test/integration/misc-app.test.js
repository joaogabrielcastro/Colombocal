const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const { agent, resetDb, seedTenant } = require("../helpers/testServer");

test.beforeEach(async () => {
  await resetDb();
  await seedTenant();
});

test("GET / e /health e /ready", async () => {
  const root = await agent.get("/");
  assert.equal(root.status, 200);
  assert.match(root.body.message, /Colombocal/);

  const health = await agent.get("/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.status, "ok");

  const ready = await agent.get("/ready");
  assert.equal(ready.status, 200);
  assert.equal(ready.body.status, "ready");
});

test("rota /api desconhecida retorna 404", async () => {
  const res = await agent.get("/api/rota-inexistente");
  assert.equal(res.status, 404);
});

test("GET /api/cnpj valida formato", async () => {
  const res = await agent.get("/api/cnpj/123");
  assert.equal(res.status, 400);
});

test("GET /api/cnpj busca com sucesso (axios mockado)", async () => {
  const orig = axios.get;
  axios.get = async () => ({
    data: {
      cnpj: "11222333000181",
      razao_social: "Empresa X",
      nome_fantasia: "X",
      ddd_telefone_1: "41",
      telefone_1: "999999999",
      municipio: "Curitiba",
      uf: "PR",
      logradouro: "Rua A",
      numero: "10",
      complemento: "",
      bairro: "Centro",
      cep: "80000000",
    },
  });
  try {
    const res = await agent.get("/api/cnpj/11222333000181");
    assert.equal(res.status, 200);
    assert.equal(res.body.razaoSocial, "Empresa X");
    assert.equal(res.body.estado, "PR");
  } finally {
    axios.get = orig;
  }
});

test("GET /api/cnpj 404 quando não encontrado", async () => {
  const orig = axios.get;
  axios.get = async () => {
    const err = new Error("not found");
    err.response = { status: 404 };
    throw err;
  };
  try {
    const res = await agent.get("/api/cnpj/11222333000181");
    assert.equal(res.status, 404);
  } finally {
    axios.get = orig;
  }
});

test("GET /api/cnpj 500 em erro genérico", async () => {
  const orig = axios.get;
  axios.get = async () => {
    throw new Error("timeout");
  };
  try {
    const res = await agent.get("/api/cnpj/11222333000181");
    assert.equal(res.status, 500);
  } finally {
    axios.get = orig;
  }
});
