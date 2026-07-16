import { describe, expect, it } from "vitest";
import {
  montarResumoRelatorioVendas,
  ordenarResumoRepresentantes,
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
    const { resumoClientes, resumoProdutos } = montarResumoRelatorioVendas(data);
    expect(resumoClientes).toEqual([{ nome: "Cli API", total: 300, quantidade: 2 }]);
    expect(resumoProdutos[0]).toMatchObject({ nome: "Prod API", total: 400, unidade: "" });
  });

  it("participação é 0 quando faturamento total é 0", () => {
    const data = makeDataSemResumo();
    data.totalFaturamento = 0;
    const { resumoRepresentantes } = montarResumoRelatorioVendas(data);
    expect(resumoRepresentantes.every((r) => r.participacao === 0)).toBe(true);
  });
});
