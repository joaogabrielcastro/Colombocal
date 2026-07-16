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
  exportarRelatorioVendasPdf,
  exportarRelatorioVendasCSV,
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
  it("lista as 5 seções", () => {
    expect(RELATORIO_VENDAS_PDF_SECOES.map((s) => s.id)).toEqual([
      "totais",
      "representantes",
      "clientes",
      "produtos",
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

  const secoes = ["totais", "representantes", "clientes", "produtos", "detalhes"] as const;
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
});

describe("exportarRelatorioVendasCSV", () => {
  it("gera blob e dispara download", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:1");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi.fn();
    const anchor = { href: "", download: "", click } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(anchor);

    exportarRelatorioVendasCSV(makeData(), "2026-01-01", "2026-12-31");

    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(anchor.download).toContain("relatorio-vendas-");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:1");
    vi.unstubAllGlobals();
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
