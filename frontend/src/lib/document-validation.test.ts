import { describe, expect, it } from "vitest";
import { isValidCpf, isValidCnpjDigits, onlyDigits } from "./document-validation";

describe("document-validation", () => {
  it("onlyDigits remove não-dígitos", () => {
    expect(onlyDigits("123.456.789-09")).toBe("12345678909");
  });

  it("rejeita CPF inválido", () => {
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });

  it("aceita CPF válido conhecido", () => {
    // CPF de teste com dígitos verificadores corretos
    expect(isValidCpf("529.982.247-25")).toBe(true);
  });

  it("CNPJ exige dígitos verificadores válidos", () => {
    expect(isValidCnpjDigits("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpjDigits("12.345.678/0001-95")).toBe(true);
    expect(isValidCnpjDigits("12.345.678/0001-00")).toBe(false);
    expect(isValidCnpjDigits("123")).toBe(false);
    expect(isValidCnpjDigits("00000000000000")).toBe(false);
  });
});
