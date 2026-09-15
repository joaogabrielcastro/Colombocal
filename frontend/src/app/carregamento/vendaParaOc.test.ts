import type { Venda } from "@/lib/utils";
import { describe, expect, it } from "vitest";
import { itensDaVendaParaForm, numeroPedidoDaVenda } from "./vendaParaOc";

describe("vendaParaOc", () => {
  it("usa numeroVenda quando existe", () => {
    expect(numeroPedidoDaVenda({ id: 99, numeroVenda: 303 })).toBe("303");
  });

  it("cai no id técnico se a venda legado não tiver número", () => {
    expect(numeroPedidoDaVenda({ id: 12 })).toBe("12");
  });

  it("mapeia itens da venda para o formulário da OC", () => {
    expect(
      itensDaVendaParaForm({
        itens: [{ produtoId: 7, quantidade: 2.5 }] as Venda["itens"],
      }),
    ).toEqual([{ produtoId: "7", quantidade: "2.5" }]);
  });

  it("deixa uma linha vazia se a venda não tiver itens", () => {
    expect(itensDaVendaParaForm({ itens: [] })).toEqual([
      { produtoId: "", quantidade: "" },
    ]);
  });
});

describe("vendaParaOc", () => {
  it("usa numeroVenda quando existe", () => {
    expect(numeroPedidoDaVenda({ id: 99, numeroVenda: 303 })).toBe("303");
  });

  it("cai no id técnico se a venda legado não tiver número", () => {
    expect(numeroPedidoDaVenda({ id: 12 })).toBe("12");
  });

  it("mapeia itens da venda para o formulário da OC", () => {
    expect(
      itensDaVendaParaForm({
        itens: [
          {
            id: 1,
            produtoId: 7,
            quantidade: 2.5,
            precoUnitario: 10,
            subtotal: 25,
            produto: { id: 7, nome: "Cal", unidade: "ton", precoPadrao: 10 },
          },
        ],
      }),
    ).toEqual([{ produtoId: "7", quantidade: "2.5" }]);
  });

  it("deixa uma linha vazia se a venda não tiver itens", () => {
    expect(itensDaVendaParaForm({ itens: [] })).toEqual([
      { produtoId: "", quantidade: "" },
    ]);
  });
});
