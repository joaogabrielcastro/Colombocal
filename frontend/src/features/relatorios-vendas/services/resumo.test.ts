import { describe, expect, it } from "vitest";
import {
  isRepresentanteSemComissao,
  montarResumoRelatorioVendas,
  ordenarResumoRepresentantes,
  resumoComissaoVisual,
  type ResumoRepresentante,
} from "./resumo";
import type { RelVendas } from "../types";

function makeDataSemResumo(): RelVendas {
  return {
    vendas: [
      {
        id: 1,
        dataVenda: "2026-04-01",
        valorTotal: 1000,
        frete: 50,
        clienteId: 10,
        vendedorId: 20,
        cliente: { nomeFantasia: "Cliente A", razaoSocial: "Cliente A LTDA" },
        vendedor: { nome: "Vendedor X" },
        itens: [
          {
            produtoId: 100,
            quantidade: 2,
            subtotal: 400,
            produto: { nome: "Produto P1", unidade: "saco" },
          },
        ],
      },
      {
        id: 2,
        dataVenda: "2026-04-02",
        valorTotal: 500,
        frete: 25,
        clienteId: 11,
        vendedorId: 21,
        cliente: { nomeFantasia: "", razaoSocial: "Cliente B SA" },
        vendedor: { nome: "Vendedor Y" },
        itens: [
          {
            produtoId: 100,
            quantidade: 1,
            subtotal: 200,
            produto: { nome: "Produto P1", unidade: "saco" },
          },
          {
            produtoId: 101,
            quantidade: 3,
            subtotal: 300,
            produto: { nome: "Produto P2", unidade: "ton" },
          },
        ],
      },
    ] as unknown as RelVendas["vendas"],
    totalFaturamento: 1500,
    totalQuantidade: 0,
    quantidade: 2,
  };
}

describe("montarResumoRelatorioVendas", () => {
  it("agrega corretamente quando API nao envia resumos", () => {
    const data = makeDataSemResumo();
    const { resumoRepresentantes, resumoClientes, resumoProdutos } =
      montarResumoRelatorioVendas(data);

    expect(resumoRepresentantes).toHaveLength(2);
    expect(resumoRepresentantes[0]).toMatchObject({
      nome: "Vendedor X",
      total: 1000,
      quantidade: 1,
    });

    expect(resumoClientes).toHaveLength(2);
    expect(resumoClientes.map((c) => c.nome)).toContain("Cliente A");
    expect(resumoClientes.map((c) => c.nome)).toContain("Cliente B SA");

    expect(resumoProdutos).toHaveLength(2);
    expect(resumoProdutos.find((p) => p.nome === "Produto P1")?.quantidade).toBe(3);
    expect(resumoProdutos.find((p) => p.nome === "Produto P1")?.total).toBe(600);
  });

  it("agrega produtos por cliente a partir das vendas", () => {
    const data = makeDataSemResumo();
    const { resumoClienteProdutos } = montarResumoRelatorioVendas(data);
    expect(resumoClienteProdutos).toHaveLength(2);
    const cliA = resumoClienteProdutos.find((c) => c.nome === "Cliente A");
    expect(cliA?.produtos).toEqual([
      { produtoNome: "Produto P1", unidade: "saco", quantidade: 2, total: 400 },
    ]);
    const cliB = resumoClienteProdutos.find((c) => c.nome === "Cliente B SA");
    expect(cliB?.produtos.find((p) => p.produtoNome === "Produto P2")?.quantidade).toBe(3);
  });

  it("prioriza resumo vindo da API quando existe", () => {
    const data = makeDataSemResumo();
    data.resumoRepresentantes = [
      {
        vendedorId: 30,
        vendedorNome: "Resumo API",
        comissaoPercentual: 0,
        faturamento: 999,
        frete: 88,
        quantidadeVendas: 7,
        ticketMedio: 142.71,
        participacao: 66.6,
      },
    ];

    const { resumoRepresentantes } = montarResumoRelatorioVendas(data);
    expect(resumoRepresentantes).toEqual([
      {
        nome: "Resumo API",
        total: 999,
        frete: 88,
        quantidade: 7,
        ticketMedio: 142.71,
        participacao: 66.6,
      },
    ]);
  });
});

describe("ordenarResumoRepresentantes", () => {
  const base: ResumoRepresentante[] = [
    {
      nome: "Bruno",
      total: 200,
      frete: 0,
      quantidade: 2,
      ticketMedio: 100,
      participacao: 20,
    },
    {
      nome: "Ana",
      total: 500,
      frete: 0,
      quantidade: 1,
      ticketMedio: 500,
      participacao: 50,
    },
    {
      nome: "Carlos",
      total: 300,
      frete: 0,
      quantidade: 3,
      ticketMedio: 100,
      participacao: 30,
    },
  ];

  it("ordena por total desc", () => {
    const out = ordenarResumoRepresentantes(base, { key: "total", dir: "desc" });
    expect(out.map((x) => x.nome)).toEqual(["Ana", "Carlos", "Bruno"]);
  });

  it("ordena por nome asc", () => {
    const out = ordenarResumoRepresentantes(base, { key: "nome", dir: "asc" });
    expect(out.map((x) => x.nome)).toEqual(["Ana", "Bruno", "Carlos"]);
  });

  it("ordena por participacao asc", () => {
    const out = ordenarResumoRepresentantes(base, { key: "participacao", dir: "asc" });
    expect(out.map((x) => x.participacao)).toEqual([20, 30, 50]);
  });

  it("ordena por quantidade desc", () => {
    const out = ordenarResumoRepresentantes(base, { key: "quantidade", dir: "desc" });
    expect(out.map((x) => x.quantidade)).toEqual([3, 2, 1]);
  });
});

describe("montarResumoRelatorioVendas casos extras", () => {
  it("retorna listas vazias quando data é null", () => {
    const r = montarResumoRelatorioVendas(null);
    expect(r.resumoRepresentantes).toEqual([]);
    expect(r.resumoClientes).toEqual([]);
    expect(r.resumoProdutos).toEqual([]);
    expect(r.resumoClienteProdutos).toEqual([]);
  });

  it("prioriza resumoClientes e resumoProdutos da API", () => {
    const data = makeDataSemResumo();
    data.resumoClientes = [
      { clienteId: 1, clienteNome: "Cli API", faturamento: 300, quantidadeVendas: 2, ticketMedio: 150 },
    ];
    data.resumoProdutos = [
      {
        produtoId: 1,
        produtoNome: "Prod API",
        unidade: "",
        quantidade: 4,
        faturamento: 400,
        quantidadeItens: 4,
      },
    ];
    data.resumoClienteProdutos = [
      {
        clienteId: 9,
        clienteNome: "Cli API",
        produtos: [
          { produtoId: 1, produtoNome: "Dolomita", unidade: "ton", quantidade: 12.5, faturamento: 1250 },
        ],
      },
    ];
    const { resumoClientes, resumoProdutos, resumoClienteProdutos } = montarResumoRelatorioVendas(data);
    expect(resumoClientes).toEqual([{ nome: "Cli API", total: 300, quantidade: 2, participacao: 20 }]);
    expect(resumoProdutos[0]).toMatchObject({ nome: "Prod API", total: 400, unidade: "", participacao: expect.any(Number) });
    expect(resumoClienteProdutos).toEqual([
      {
        nome: "Cli API",
        produtos: [{ produtoNome: "Dolomita", unidade: "ton", quantidade: 12.5, total: 1250 }],
      },
    ]);
  });

  it("participação é 0 quando faturamento total é 0", () => {
    const data = makeDataSemResumo();
    data.totalFaturamento = 0;
    const { resumoRepresentantes } = montarResumoRelatorioVendas(data);
    expect(resumoRepresentantes.every((r) => r.participacao === 0)).toBe(true);
  });

  it("calcula participação de clientes e produtos a partir do total do período", () => {
    const data = makeDataSemResumo();
    const { resumoClientes, resumoProdutos } = montarResumoRelatorioVendas(data);
    const cliA = resumoClientes.find((c) => c.nome === "Cliente A");
    expect(cliA?.participacao).toBeCloseTo((1000 / 1500) * 100);
    const p1 = resumoProdutos.find((p) => p.nome === "Produto P1");
    expect(p1?.participacao).toBeCloseTo((600 / 1500) * 100);
  });
});

describe("isRepresentanteSemComissao / resumoComissaoVisual", () => {
  it("reconhece SEM COMISSÃO e SEN COMISSÃO sem alterar totais", () => {
    expect(isRepresentanteSemComissao("SEM COMISSÃO")).toBe(true);
    expect(isRepresentanteSemComissao("Sen Comissao")).toBe(true);
    expect(isRepresentanteSemComissao("  sem   comissão  ")).toBe(true);
    expect(isRepresentanteSemComissao("LUISTA REPRESENTAÇÕES")).toBe(false);
  });

  it("não classifica outro representante só porque o nome contém o trecho", () => {
    expect(isRepresentanteSemComissao("REPRESENTAÇÃO SEM COMISSÃO")).toBe(false);
    expect(isRepresentanteSemComissao("JOAO SEN COMISSAO SILVA")).toBe(false);
    expect(isRepresentanteSemComissao("COMISSAO")).toBe(false);
    expect(isRepresentanteSemComissao("")).toBe(false);
  });

  it("resume comissão visual a partir do agrupamento existente", () => {
    const reps: ResumoRepresentante[] = [
      {
        nome: "SEM COMISSÃO",
        total: 565.58,
        frete: 0,
        quantidade: 4,
        ticketMedio: 141.4,
        participacao: 42.15,
      },
      {
        nome: "LUISTA REPRESENTAÇÕES",
        total: 776.42,
        frete: 0,
        quantidade: 6,
        ticketMedio: 129.4,
        participacao: 57.85,
      },
    ];
    const r = resumoComissaoVisual(reps, 1342);
    expect(r.temSemComissao).toBe(true);
    expect(r.totalSem).toBeCloseTo(565.58);
    expect(r.participacaoSem).toBeCloseTo((565.58 / 1342) * 100);
    expect(r.totalCom).toBeCloseTo(1342 - 565.58);
    expect(r.quantidadeCom).toBe(6);
  });

  it("não inventa categoria quando não existe representante sem comissão", () => {
    const r = resumoComissaoVisual(
      [
        {
          nome: "Ana",
          total: 100,
          frete: 0,
          quantidade: 1,
          ticketMedio: 100,
          participacao: 100,
        },
      ],
      100,
    );
    expect(r.temSemComissao).toBe(false);
    expect(r.totalSem).toBe(0);
    expect(r.totalCom).toBe(100);
  });
});
