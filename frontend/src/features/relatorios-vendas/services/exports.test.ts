import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { writeFile, bookAppendSheet } = vi.hoisted(() => ({
  writeFile: vi.fn(),
  bookAppendSheet: vi.fn(),
}));

vi.mock("xlsx", () => ({
  utils: {
    book_new: () => ({}),
    json_to_sheet: (rows: unknown) => rows,
    book_append_sheet: (...args: unknown[]) => bookAppendSheet(...args),
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
    { nome: "SEM COMISSÃO", total: 400, frete: 0, quantidade: 1, ticketMedio: 400, participacao: 40 },
    { nome: "Vendedor X", total: 600, frete: 50, quantidade: 1, ticketMedio: 600, participacao: 60 },
  ],
  resumoClientes: [{ nome: "Cliente A", total: 1000, quantidade: 1, participacao: 100 }],
  resumoProdutos: [{ nome: "Produto P1", total: 600, quantidade: 3, unidade: "saco", participacao: 60 }],
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

  it("exportarRelatorioVendasPdfCompleto inclui hierarquia e destaque sem comissão", () => {
    exportarRelatorioVendasPdfCompleto({
      data: makeData(),
      dataInicio: "2026-01-01",
      dataFim: "2026-12-31",
      ...resumo,
      filtrosTexto: "Representante: Vendedor X",
    });
    expect(win.document.write).toHaveBeenCalledOnce();
    const html = String(win.document.write.mock.calls[0][0]);
    expect(html).toContain("Indicadores");
    expect(html).toContain("Resumo executivo");
    expect(html).toContain("Por representante");
    expect(html).toContain("Por cliente");
    expect(html).toContain("Por produto");
    expect(html).toContain("Produtos por cliente");
    expect(html).toContain("Detalhamento das vendas");
    expect(html).toContain("Filtros aplicados: Representante: Vendedor X");
    expect(html).toContain("Vendas sem comissão");
    expect(html).toContain("destaque-sem");
    expect(html).toContain("thead { display: table-header-group; }");
    expect(html).toContain("overflow-wrap: anywhere");
    expect(win.print).toHaveBeenCalled();
  });
});

describe("exportarRelatorioVendasExcel", () => {
  beforeEach(() => {
    writeFile.mockReset();
    bookAppendSheet.mockReset();
  });

  it("monta as planilhas e escreve o arquivo", () => {
    exportarRelatorioVendasExcel(makeData(), "2026-01-01", "2026-12-31");
    expect(writeFile).toHaveBeenCalledOnce();
    const filename = writeFile.mock.calls[0][1] as string;
    expect(filename).toContain(".xlsx");
  });

  it("exporta agrupamentos completos da API, não só o preview da página", () => {
    const data = makeData();
    data.resumoRepresentantes = [
      {
        vendedorId: 1,
        vendedorNome: "SEM COMISSÃO",
        comissaoPercentual: 0,
        faturamento: 400,
        frete: 0,
        quantidadeVendas: 2,
        ticketMedio: 200,
        participacao: 40,
      },
      {
        vendedorId: 2,
        vendedorNome: "Outro",
        comissaoPercentual: 5,
        faturamento: 600,
        frete: 0,
        quantidadeVendas: 3,
        ticketMedio: 200,
        participacao: 60,
      },
    ];
    data.resumoClientes = [
      { clienteId: 1, clienteNome: "Cliente A", faturamento: 1000, quantidadeVendas: 1, ticketMedio: 1000 },
      { clienteId: 2, clienteNome: "Cliente B", faturamento: 500, quantidadeVendas: 2, ticketMedio: 250 },
    ];
    data.resumoProdutos = [
      { produtoId: 1, produtoNome: "Cal", unidade: "ton", quantidade: 10, faturamento: 800, quantidadeItens: 2 },
    ];
    data.totalFaturamento = 1000;
    data.totalRegistros = 5;
    exportarRelatorioVendasExcel(data, "2026-08-01", "2026-09-06");
    const sheets = bookAppendSheet.mock.calls.map((c) => c[2]);
    expect(sheets).toEqual([
      "Resumo",
      "Vendas",
      "Por vendedor",
      "Por cliente",
      "Por produto",
    ]);
    const porVendedor = bookAppendSheet.mock.calls[2][1] as Array<{ vendedor: string; total: number }>;
    expect(porVendedor.map((r) => r.vendedor)).toEqual(["SEM COMISSÃO", "Outro"]);
    const porCliente = bookAppendSheet.mock.calls[3][1] as Array<{ cliente: string }>;
    expect(porCliente.map((r) => r.cliente)).toEqual(["Cliente A", "Cliente B"]);
    const detalhes = bookAppendSheet.mock.calls[1][1] as unknown[];
    expect(detalhes).toHaveLength(data.vendas.length);
    const resumoSheet = bookAppendSheet.mock.calls[0][1] as Array<{ Indicador: string; Valor: number }>;
    expect(resumoSheet.find((r) => r.Indicador === "Vendas no período")?.Valor).toBe(5);
    expect(resumoSheet.find((r) => r.Indicador === "Total vendido")?.Valor).toBe(1000);
    expect(resumoSheet.find((r) => r.Indicador === "Ticket médio")?.Valor).toBe(200);
  });
});
