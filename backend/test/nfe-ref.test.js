const test = require("node:test");
const assert = require("node:assert/strict");
const { AppError } = require("../src/shared/errors/appError");
const {
  refNfeTentativa,
  isErroInconclusivoNfe,
  isNfeNaoEncontradaNoProvedor,
  statusPermiteReutilizarRef,
} = require("../src/domain/nfe/refNfe");
const { STATUS } = require("../src/domain/nfe/constants");

test("refNfeTentativa é determinística e sem Date.now", () => {
  assert.equal(refNfeTentativa(3, 41, 1), "venda-3-41");
  assert.equal(refNfeTentativa(3, 41, 1), refNfeTentativa(3, 41));
  assert.equal(refNfeTentativa(3, 41, 2), "venda-3-41-t2");
  assert.equal(refNfeTentativa(3, 41, 3), "venda-3-41-t3");
  assert.ok(!String(refNfeTentativa(1, 1, 1)).includes(String(Date.now()).slice(0, 8)));
});

test("isErroInconclusivoNfe cobre timeout, reset e 502/503", () => {
  assert.equal(
    isErroInconclusivoNfe(new AppError("timeout", { code: "NFE_PROVEDOR_INDISPONIVEL", httpStatus: 502 })),
    true,
  );
  assert.equal(isErroInconclusivoNfe({ code: "ECONNRESET" }), true);
  assert.equal(isErroInconclusivoNfe({ code: "ECONNABORTED", message: "timeout of 45000ms exceeded" }), true);
  assert.equal(isErroInconclusivoNfe({ httpStatus: 503 }), true);
  assert.equal(isErroInconclusivoNfe({ httpStatus: 429 }), true);
  assert.equal(isErroInconclusivoNfe({ httpStatus: 409 }), true);
  assert.equal(
    isErroInconclusivoNfe(new AppError("SEFAZ recusou", { code: "NFE_PROVEDOR_ERRO", httpStatus: 400 })),
    false,
  );
});

test("isNfeNaoEncontradaNoProvedor", () => {
  assert.equal(
    isNfeNaoEncontradaNoProvedor(new AppError("x", { code: "NFE_NAO_ENCONTRADA", httpStatus: 404 })),
    true,
  );
  assert.equal(isNfeNaoEncontradaNoProvedor({ httpStatus: 404 }), true);
  assert.equal(isNfeNaoEncontradaNoProvedor({ httpStatus: 502 }), false);
});

test("statusPermiteReutilizarRef só processamento/rascunho", () => {
  assert.equal(statusPermiteReutilizarRef(STATUS.PROCESSANDO), true);
  assert.equal(statusPermiteReutilizarRef(STATUS.RASCUNHO), true);
  assert.equal(statusPermiteReutilizarRef(STATUS.REJEITADA), false);
  assert.equal(statusPermiteReutilizarRef(STATUS.AUTORIZADA), false);
  assert.equal(statusPermiteReutilizarRef(STATUS.CANCELADA), false);
});
