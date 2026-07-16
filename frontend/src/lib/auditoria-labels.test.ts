import { describe, expect, it } from "vitest";
import { labelTipoAuditoria } from "./auditoria-labels";

describe("labelTipoAuditoria", () => {
  it("usa rótulo conhecido", () => {
    expect(labelTipoAuditoria("VENDA_CRIADA")).toBe("Venda criada");
  });
  it("retorna vazio para entrada vazia", () => {
    expect(labelTipoAuditoria("")).toBe("");
    expect(labelTipoAuditoria(undefined as unknown as string)).toBe("");
  });
  it("formata tipo desconhecido em Title Case", () => {
    expect(labelTipoAuditoria("ALGO_NOVO_AQUI")).toBe("Algo Novo Aqui");
  });
});
