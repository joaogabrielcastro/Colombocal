import { describe, expect, it } from "vitest";
import {
  buildOrdemServicoFreteDestaqueHtml,
  buildOrdemServicoPrintHtml,
} from "./ordem-servico-print";
import type { Venda } from "./utils";

function item(over: {
  nome: string;
  unidade: string;
  quantidade?: number;
  pesoKg?: number | null;
}): Venda["itens"][number] {
  return {
    id: 1,
    produtoId: 1,
    quantidade: over.quantidade ?? 10,
    precoUnitario: 9,
    subtotal: 90,
    produto: {
      id: 1,
      nome: over.nome,
      codigo: "X",
      precoPadrao: 9,
      unidade: over.unidade,
      pesoKg: over.pesoKg ?? null,
      ativo: true,
    },
  };
}

function vendaBase(over: Partial<Venda> = {}): Venda {
  return {
    id: 80,
    numeroVenda: 80,
    clienteId: 1,
    vendedorId: 1,
    frete: 0,
    freteTarifaSaco: 0,
    freteTarifaTonelada: 0,
    freteRecibo: false,
    valorTotal: 2700,
    dataVenda: "2026-09-05T12:00:00Z",
    cliente: {
      id: 1,
      razaoSocial: "Deposito Casarotto",
      nomeFantasia: "Deposito Casarotto",
      ativo: true,
    },
    vendedor: { id: 1, nome: "Vendedor", comissaoPercentual: 0, ativo: true },
    itens: [],
    ...over,
  } as Venda;
}

describe("buildOrdemServicoFreteDestaqueHtml", () => {
  it("cal (saco) continua mostrando FRETE unitário", () => {
    const { tagsHtml } = buildOrdemServicoFreteDestaqueHtml(
      vendaBase({
        freteTarifaSaco: 3.1,
        itens: [item({ nome: "CAL VIRGEM", unidade: "saco", quantidade: 300 })],
      }),
      true,
    );
    expect(tagsHtml).toContain("FRETE:");
    expect(tagsHtml).toContain("3,10");
    expect(tagsHtml).not.toContain("FRETE TONELADA");
  });

  it("dolomita (ton) mostra FRETE TONELADA em vez de sair zerado", () => {
    const { tagsHtml, hintHtml } = buildOrdemServicoFreteDestaqueHtml(
      vendaBase({
        freteTarifaTonelada: 155,
        itens: [item({ nome: "DOLOMITA", unidade: "tonelada", quantidade: 12 })],
      }),
      true,
    );
    expect(tagsHtml).toContain("FRETE TONELADA:");
    expect(tagsHtml).toContain("155,00");
    expect(tagsHtml).not.toMatch(/>FRETE:</);
    expect(hintHtml).toContain("tonelada");
  });

  it("não imprime FRETE TONELADA zerado", () => {
    const { tagsHtml } = buildOrdemServicoFreteDestaqueHtml(
      vendaBase({
        freteTarifaTonelada: 0,
        itens: [item({ nome: "DOLOMITA", unidade: "t", quantidade: 12 })],
      }),
      true,
    );
    expect(tagsHtml).not.toContain("FRETE TONELADA");
  });

  it("venda mista mostra saco e tonelada", () => {
    const { tagsHtml } = buildOrdemServicoFreteDestaqueHtml(
      vendaBase({
        freteTarifaSaco: 3.1,
        freteTarifaTonelada: 155,
        itens: [
          item({ nome: "CAL VIRGEM", unidade: "saco", quantidade: 300 }),
          item({ nome: "DOLOMITA", unidade: "ton", quantidade: 5 }),
        ],
      }),
      true,
    );
    expect(tagsHtml).toContain("FRETE:");
    expect(tagsHtml).toContain("3,10");
    expect(tagsHtml).toContain("FRETE TONELADA:");
    expect(tagsHtml).toContain("155,00");
  });

  it("não gera bloco de frete quando o tenant não usa frete", () => {
    const { tagsHtml, hintHtml } = buildOrdemServicoFreteDestaqueHtml(
      vendaBase({
        freteTarifaTonelada: 155,
        itens: [item({ nome: "DOLOMITA", unidade: "ton", quantidade: 1 })],
      }),
      false,
    );
    expect(tagsHtml).toBe("");
    expect(hintHtml).toBe("");
  });
});

describe("buildOrdemServicoPrintHtml", () => {
  it("inclui FRETE TONELADA na ordem de serviço", () => {
    const html = buildOrdemServicoPrintHtml(
      vendaBase({
        freteTarifaTonelada: 155,
        itens: [item({ nome: "DOLOMITA", unidade: "ton", quantidade: 12 })],
      }),
      { freteEnabled: true, numeroPublico: "#80" },
    );
    expect(html).toContain("Ordem de Serviço - Entrega");
    expect(html).toContain("DOLOMITA");
    expect(html).toContain("FRETE TONELADA:");
    expect(html).toContain("155,00");
  });
});
