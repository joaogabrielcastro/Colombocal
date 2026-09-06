import { describe, expect, it } from "vitest";
import { montarResumoRelatorioVendas, resumoComissaoVisual } from "./resumo";
import type { RelVendas } from "../types";

function venda(over: Record<string, unknown>) {
  return {
    id: 1,
    numeroVenda: 1,
    dataVenda: "2026-08-10T12:00:00.000Z",
    valorTotal: 100,
    frete: 10,
    clienteId: 1,
    vendedorId: 1,
    cliente: { nomeFantasia: "Cli A", razaoSocial: "Cli A LTDA" },
    vendedor: { nome: "Rep A" },
    itens: [
      {
        produtoId: 1,
        quantidade: 2,
        subtotal: 100,
        produto: { nome: "Cal", unidade: "ton" },
      },
    ],
    ...over,
  };
}

describe("auditoria de cálculos do relatório", () => {
  it("ticket médio e participações fecham com o total do período (API)", () => {
    const data: RelVendas = {
      vendas: [venda({ id: 1 }) as RelVendas["vendas"][number]],
      totalFaturamento: 1000,
      totalFrete: 80,
      totalQuantidade: 0,
      quantidade: 1,
      totalRegistros: 4,
      resumoRepresentantes: [
        {
          vendedorId: 1,
          vendedorNome: "Rep A",
          comissaoPercentual: 5,
          faturamento: 600,
          frete: 40,
          quantidadeVendas: 2,
          ticketMedio: 300,
          participacao: 60,
        },
        {
          vendedorId: 2,
          vendedorNome: "SEM COMISSÃO",
          comissaoPercentual: 0,
          faturamento: 400,
          frete: 40,
          quantidadeVendas: 2,
          ticketMedio: 200,
          participacao: 40,
        },
      ],
      resumoClientes: [
        { clienteId: 1, clienteNome: "Cli A", faturamento: 700, quantidadeVendas: 3, ticketMedio: 700 / 3 },
        { clienteId: 2, clienteNome: "Cli B", faturamento: 300, quantidadeVendas: 1, ticketMedio: 300 },
      ],
      resumoProdutos: [
        { produtoId: 1, produtoNome: "Cal", unidade: "ton", quantidade: 8, faturamento: 800, quantidadeItens: 3 },
        { produtoId: 2, produtoNome: "Virgem", unidade: "saco", quantidade: 10, faturamento: 200, quantidadeItens: 1 },
      ],
    };

    const { resumoRepresentantes, resumoClientes, resumoProdutos } = montarResumoRelatorioVendas(data);
    const ticket = data.totalFaturamento / (data.totalRegistros ?? 0);
    expect(ticket).toBe(250);

    const partRep = resumoRepresentantes.reduce((acc, r) => acc + r.participacao, 0);
    expect(partRep).toBeCloseTo(100);

    const fatRep = resumoRepresentantes.reduce((acc, r) => acc + r.total, 0);
    expect(fatRep).toBeCloseTo(data.totalFaturamento);

    const fatCli = resumoClientes.reduce((acc, c) => acc + c.total, 0);
    expect(fatCli).toBeCloseTo(data.totalFaturamento);
    expect(resumoClientes.reduce((acc, c) => acc + c.participacao, 0)).toBeCloseTo(100);

    const fatProd = resumoProdutos.reduce((acc, p) => acc + p.total, 0);
    expect(fatProd).toBeCloseTo(data.totalFaturamento);
    expect(resumoProdutos.reduce((acc, p) => acc + p.participacao, 0)).toBeCloseTo(100);

    const comissao = resumoComissaoVisual(resumoRepresentantes, data.totalFaturamento);
    expect(comissao.totalSem).toBe(400);
    expect(comissao.totalCom).toBe(600);
    expect(comissao.participacaoSem).toBeCloseTo(40);
  });

  it("sem resultados: totais zerados e participações 0", () => {
    const data: RelVendas = {
      vendas: [],
      totalFaturamento: 0,
      totalFrete: 0,
      totalQuantidade: 0,
      quantidade: 0,
      totalRegistros: 0,
      resumoRepresentantes: [],
      resumoClientes: [],
      resumoProdutos: [],
    };
    const r = montarResumoRelatorioVendas(data);
    expect(r.resumoRepresentantes).toEqual([]);
    expect(r.resumoClientes).toEqual([]);
    expect(resumoComissaoVisual([], 0).temSemComissao).toBe(false);
  });

  it("não usa a página de vendas quando a API envia resumos completos (limite 500)", () => {
    const data: RelVendas = {
      vendas: [
        venda({ id: 1, valorTotal: 10, vendedorId: 1 }) as RelVendas["vendas"][number],
      ],
      totalFaturamento: 5000,
      totalFrete: 100,
      totalQuantidade: 0,
      quantidade: 1,
      totalRegistros: 800,
      resumoRepresentantes: [
        {
          vendedorId: 9,
          vendedorNome: "Completo API",
          comissaoPercentual: 3,
          faturamento: 5000,
          frete: 100,
          quantidadeVendas: 800,
          ticketMedio: 5000 / 800,
          participacao: 100,
        },
      ],
      resumoClientes: [
        { clienteId: 9, clienteNome: "Cliente API", faturamento: 5000, quantidadeVendas: 800, ticketMedio: 5000 / 800 },
      ],
      resumoProdutos: [
        { produtoId: 9, produtoNome: "Produto API", unidade: "ton", quantidade: 99, faturamento: 5000, quantidadeItens: 800 },
      ],
    };
    const r = montarResumoRelatorioVendas(data);
    expect(r.resumoRepresentantes[0].nome).toBe("Completo API");
    expect(r.resumoRepresentantes[0].quantidade).toBe(800);
    expect(r.resumoClientes[0].quantidade).toBe(800);
    expect(r.resumoProdutos[0].total).toBe(5000);
    expect(r.resumoRepresentantes[0].total).not.toBe(10);
  });
});
