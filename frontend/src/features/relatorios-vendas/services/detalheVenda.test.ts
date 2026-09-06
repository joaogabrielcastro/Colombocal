import { describe, expect, it } from "vitest";
import { formatVendaProdutos, formatVendaQuantidades, textoObservacao } from "./detalheVenda";
import type { Venda } from "@/lib/utils";

const venda = {
  observacoes: "  urgente  ",
  itens: [
    { quantidade: 2, produto: { nome: "Cal hidratada", unidade: "ton" } },
    { quantidade: 10, produto: { nome: "Cal virgem", unidade: "saco" } },
  ],
} as unknown as Venda;

describe("detalheVenda", () => {
  it("junta produtos e quantidades com unidade", () => {
    expect(formatVendaProdutos(venda)).toBe("Cal hidratada, Cal virgem");
    expect(formatVendaQuantidades(venda)).toContain("ton");
    expect(formatVendaQuantidades(venda)).toContain("saco");
  });

  it("trata venda sem itens e sem observação", () => {
    const vazia = { itens: [], observacoes: "" } as unknown as Venda;
    expect(formatVendaProdutos(vazia)).toBe("—");
    expect(formatVendaQuantidades(vazia)).toBe("—");
    expect(textoObservacao(vazia)).toBe("—");
    expect(textoObservacao(venda)).toBe("urgente");
  });
});
