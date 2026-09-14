import { describe, expect, it } from "vitest";
import {
  buildOrdemCarregamentoHtml,
  type OrdemCarregamentoPrintData,
} from "./ordem-carregamento-print";

function oc(
  over: Partial<OrdemCarregamentoPrintData> = {},
): OrdemCarregamentoPrintData {
  return {
    numeroOc: 41,
    dataEmissao: "2026-09-14T12:00:00.000Z",
    clienteNome: "Cliente Pátio",
    itens: [{ descricao: "DOLOMITA M-325", quantidade: 160, unidade: "SAC" }],
    ...over,
  };
}

describe("buildOrdemCarregamentoHtml", () => {
  it("imprime 160 SAC quando a OC já está em sacos — não reconverte", () => {
    const html = buildOrdemCarregamentoHtml(oc());
    expect(html).toContain("ORDEM DE CARREGAMENTO");
    expect(html).toContain("OC Nº:");
    expect(html).toContain("000041");
    expect(html).toContain("DOLOMITA M-325");
    expect(html).toContain("160 SAC");
    expect(html).toContain("TT DA ORDEM: 160 SAC");
    expect(html).not.toContain("8.000");
    expect(html).not.toContain("8000");
  });

  it("soma só linhas em saco no total da ordem", () => {
    const html = buildOrdemCarregamentoHtml(
      oc({
        itens: [
          { descricao: "Dolomita", quantidade: 160, unidade: "SAC" },
          { descricao: "Observação", quantidade: 4, unidade: "TON" },
        ],
      }),
    );
    expect(html).toContain("TT DA ORDEM: 160 SAC");
    expect(html).toContain("4 TON");
  });

  it("escapa HTML e inclui cliente, pedido e observação", () => {
    const html = buildOrdemCarregamentoHtml(
      oc({
        clienteNome: "A <script>alert(1)</script>",
        pedido: "1840",
        observacoes: "Conferir saco 25 kg",
        motoristaNome: "João",
        motoristaPlaca: "ABC1D23",
      }),
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("Pedido:");
    expect(html).toContain("1840");
    expect(html).toContain("Obs.: Conferir saco 25 kg");
    expect(html).toContain("João");
    expect(html).toContain("ABC1D23");
  });
});
