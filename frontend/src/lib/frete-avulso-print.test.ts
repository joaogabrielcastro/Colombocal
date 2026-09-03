import { describe, expect, it } from "vitest";
import { buildFreteAvulsoPrintHtml, type FreteAvulsoImpressao } from "./frete-avulso-print";

const base: FreteAvulsoImpressao = {
  freteId: 12,
  cliente: "Cliente Teste",
  itens: [{ produtoNome: "Cal", quantidade: 2, unidade: "ton", subtotal: 40 }],
  valorFinal: 40,
  valorLabel: "R$ 40,00",
  pagoNoAto: true,
  data: "2026-09-03",
};

describe("buildFreteAvulsoPrintHtml", () => {
  it("mantém orçamento de frete avulso", () => {
    const html = buildFreteAvulsoPrintHtml({ ...base, origem: "avulso" });
    expect(html).toContain("Orçamento de frete");
    expect(html).toContain("Total do orçamento");
    expect(html).not.toContain("Frete da venda");
  });

  it("gera documento do frete da venda sem misturar com avulso", () => {
    const html = buildFreteAvulsoPrintHtml({
      ...base,
      origem: "venda",
      titulo: "Frete da venda",
      numeroExibicao: 1840,
      numeroVenda: 1840,
    });
    expect(html).toContain("Frete da venda");
    expect(html).toContain("Total do frete");
    expect(html).toContain("#001840");
    expect(html).not.toContain("Total do orçamento");
  });
});
