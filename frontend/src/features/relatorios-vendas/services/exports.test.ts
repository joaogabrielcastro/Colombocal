import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const writeFile = vi.fn();
vi.mock("xlsx", () => ({
  utils: {
    book_new: () => ({}),
    json_to_sheet: (rows: unknown) => rows,
    book_append_sheet: vi.fn(),
  },
  writeFile: (...args: unknown[]) => writeFile(...args),
}));

import {
  RELATORIO_VENDAS_PDF_SECOES,
  exportarRelatorioVendasPdfSecao,
  exportarRelatorioVendasPdfCompleto,
  exportarRelatorioVendasPdf,
  exportarRelatorioVendasExcel,
} from "./exports";
import type { RelVendas } from "../types";

function makeData(): RelVendas {
  return {
    vendas: [
      {
        id: 1,
        numeroVenda: 7,
        dataVenda: "2026-04-01T12:00:00Z",
        valorTotal: 1000,
        frete: 50,
        freteRecibo: true,
        clienteId: 10,
        vendedorId: 20,
        cliente: { nomeFantasia: "Cliente A", razaoSocial: "Cliente A LTDA" },
        vendedor: { nome: "Vendedor X" },
        itens: [],
      },
    ] as unknown as RelVendas["vendas"],
    totalFaturamento: 1000,
    totalFrete: 50,
    totalQuantidade: 0,
    quantidade: 1,
    totalRegistros: 1,
  };
}

const resumo = {
  resumoRepresentantes: [
    { nome: "Vendedor X", total: 1000, frete: 50, quantidade: 1, ticketMedio: 1000, participacao: 100 },
  ],
  resumoClientes: [{ nome: "Cliente A", total: 1000, quantidade: 1 }],
  resumoProdutos: [{ nome: "Produto P1", total: 600, quantidade: 3, unidade: "saco" }],
};

describe("RELATORIO_VENDAS_PDF_SECOES", () => {
  it("lista as 6 seções", () => {
    expect(RELATORIO_VENDAS_PDF_SECOES.map((s) => s.id)).toEqual([
      "totais",
      "representantes",
      "clientes",
      "produtos",
      "clienteProdutos",
      "detalhes",
    ]);
  });
});

describe("exportarRelatorioVendasPdfSecao", () => {
  let win: { document: { write: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }; focus: ReturnType<typeof vi.fn>; print: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    win = {
      document: { write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(win as unknown as Window);
  });
  afterEach(() => vi.restoreAllMocks());

  const secoes = ["totais", "representantes", "clientes", "produtos", "clienteProdutos", "detalhes"] as const;
  for (const secao of secoes) {
    it(`gera a seção ${secao}`, () => {
      exportarRelatorioVendasPdfSecao(secao, {
        data: makeData(),
        dataInicio: "2026-01-01",
        dataFim: "2026-12-31",
        ...resumo,
      });
      expect(win.document.write).toHaveBeenCalledOnce();
      expect(win.print).toHaveBeenCalled();
    });
  }

  it("não quebra quando window.open retorna null", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(() =>
      exportarRelatorioVendasPdfSecao("totais", {
        data: makeData(),
        dataInicio: "",
        dataFim: "",
        ...resumo,
      }),
    ).not.toThrow();
  });

  it("exportarRelatorioVendasPdf (deprecated) delega para detalhes", () => {
    exportarRelatorioVendasPdf(makeData(), "2026-01-01", "2026-12-31");
    expect(win.document.write).toHaveBeenCalled();
  });

  it("Produtos por cliente não impede quebra de página da tabela", () => {
    exportarRelatorioVendasPdfSecao("clienteProdutos", {
      data: makeData(),
      dataInicio: "2026-01-01",
      dataFim: "2026-12-31",
      ...resumo,
    });
    const html = String(win.document.write.mock.calls[0][0]);
    expect(html).toContain(".secao { page-break-inside: auto; break-inside: auto; }");
    expect(html).toContain("thead { display: table-header-group; }");
    expect(html).toContain(".meta + .secao-detalhes { page-break-before: auto; }");
  });

  it("exportarRelatorioVendasPdfCompleto inclui todas as seções", () => {
    exportarRelatorioVendasPdfCompleto({
      data: makeData(),
      dataInicio: "2026-01-01",
      dataFim: "2026-12-31",
      ...resumo,
    });
    expect(win.document.write).toHaveBeenCalledOnce();
    const html = String(win.document.write.mock.calls[0][0]);
    expect(html).toContain("Resumo geral");
    expect(html).toContain("Por representante");
    expect(html).toContain("Por cliente");
    expect(html).toContain("Por produto");
    expect(html).toContain("Produtos por cliente");
    expect(html).toContain("Detalhamento das vendas");
    expect(win.print).toHaveBeenCalled();
  });
});

describe("exportarRelatorioVendasExcel", () => {
  it("monta as planilhas e escreve o arquivo", () => {
    exportarRelatorioVendasExcel(makeData(), "2026-01-01", "2026-12-31");
    expect(writeFile).toHaveBeenCalledOnce();
    const filename = writeFile.mock.calls[0][1] as string;
    expect(filename).toContain(".xlsx");
  });
});
