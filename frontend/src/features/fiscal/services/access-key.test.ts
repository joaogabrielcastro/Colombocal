import { describe, expect, it } from "vitest";
import { fiscalAccessKeyError, isValidFiscalAccessKey } from "./access-key";

const VALID_KEY = "35260911222333000181550010000001251000001251";

describe("fiscal access key", () => {
  it("aceita chave com 44 dígitos e DV válido", () => {
    expect(isValidFiscalAccessKey(VALID_KEY)).toBe(true);
    expect(fiscalAccessKeyError(VALID_KEY)).toBeNull();
  });

  it("não completa, corta ou aceita tamanho incorreto", () => {
    expect(fiscalAccessKeyError(VALID_KEY.slice(0, 43))).toBe(
      "Informe exatamente 44 dígitos.",
    );
    expect(fiscalAccessKeyError(`${VALID_KEY}9`)).toBe(
      "Informe exatamente 44 dígitos.",
    );
  });

  it("rejeita dígito verificador incorreto", () => {
    expect(fiscalAccessKeyError(`${VALID_KEY.slice(0, 43)}0`)).toBe(
      "Chave inválida. Verifique o dígito verificador.",
    );
  });
});
