const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parsePagination,
  setPaginationHeaders,
  handleRouteError,
} = require("../src/utils/api");

function fakeRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    set(k, v) {
      this.headers[String(k).toLowerCase()] = v;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

// parsePagination
test("parsePagination: usa padrões quando ausente", () => {
  assert.deepEqual(parsePagination({}), { take: 100, skip: 0 });
  assert.deepEqual(parsePagination(undefined), { take: 100, skip: 0 });
});

test("parsePagination: respeita defaultTake e maxTake", () => {
  assert.deepEqual(parsePagination({}, { defaultTake: 50 }), { take: 50, skip: 0 });
  assert.deepEqual(
    parsePagination({ take: "9999" }, { maxTake: 500 }),
    { take: 500, skip: 0 },
  );
});

test("parsePagination: converte take e skip válidos", () => {
  assert.deepEqual(parsePagination({ take: "20", skip: "5" }), { take: 20, skip: 5 });
});

test("parsePagination: ignora valores inválidos ou negativos", () => {
  assert.deepEqual(parsePagination({ take: "abc", skip: "-3" }), { take: 100, skip: 0 });
  assert.deepEqual(parsePagination({ take: "0" }), { take: 100, skip: 0 });
  assert.deepEqual(parsePagination({ take: "", skip: "" }), { take: 100, skip: 0 });
});

// setPaginationHeaders
test("setPaginationHeaders: seta cabeçalhos numéricos", () => {
  const res = fakeRes();
  setPaginationHeaders(res, { total: 42, take: 10, skip: 20 });
  assert.equal(res.headers["x-total-count"], "42");
  assert.equal(res.headers["x-page-size"], "10");
  assert.equal(res.headers["x-page-offset"], "20");
});

test("setPaginationHeaders: ignora não-numéricos", () => {
  const res = fakeRes();
  setPaginationHeaders(res, {});
  assert.deepEqual(res.headers, {});
});

// handleRouteError
test("handleRouteError: usa httpStatus quando presente", () => {
  const res = fakeRes();
  handleRouteError(res, { httpStatus: 404, message: "não achou" });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, "não achou");
});

test("handleRouteError: usa statusCode quando presente", () => {
  const res = fakeRes();
  handleRouteError(res, { statusCode: 400, message: "ruim" });
  assert.equal(res.statusCode, 400);
});

test("handleRouteError: usa status quando presente", () => {
  const res = fakeRes();
  handleRouteError(res, { status: 403, message: "proibido" });
  assert.equal(res.statusCode, 403);
});

test("handleRouteError: mapeia P2002 para 409 e mensagem amigável", () => {
  const res = fakeRes();
  handleRouteError(res, { code: "P2002", meta: { target: ["email"] } });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "P2002");
  assert.match(res.body.error, /duplicado/i);
});

test("handleRouteError: P2002 em numeroOrdem tem mensagem específica", () => {
  const res = fakeRes();
  handleRouteError(res, { code: "P2002", meta: { target: "Cheque_numeroOrdem_key" } });
  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /número interno do cheque/i);
});

test("handleRouteError: default 500 e mensagem do erro", () => {
  const res = fakeRes();
  handleRouteError(res, new Error("explodiu"));
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, "explodiu");
});

test("handleRouteError: AppError usa a própria mensagem", () => {
  const res = fakeRes();
  handleRouteError(res, { name: "AppError", message: "regra de negócio", httpStatus: 400 });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "regra de negócio");
});

test("handleRouteError: PrismaClientKnownRequestError tem mensagem genérica de banco", () => {
  const res = fakeRes();
  handleRouteError(res, { name: "PrismaClientKnownRequestError", code: "P2025" });
  assert.equal(res.statusCode, 500);
  assert.match(res.body.error, /banco de dados/i);
});

test("handleRouteError: erro com texto de prisma vira mensagem genérica", () => {
  const res = fakeRes();
  handleRouteError(res, new Error("Invalid `prisma.venda.create()`"));
  assert.match(res.body.error, /banco de dados/i);
});

test("handleRouteError: sem mensagem cai em erro interno", () => {
  const res = fakeRes();
  handleRouteError(res, {});
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, "Erro interno do servidor");
});
