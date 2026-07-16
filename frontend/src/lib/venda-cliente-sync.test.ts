import { describe, expect, it } from "vitest";
import {
  moneyDiffers,
  hasClienteCadastroDiff,
  buildClienteCadastroDiff,
  formatClienteCadastroDiffMessage,
  diffToAtualizarClientePayload,
} from "./venda-cliente-sync";

describe("moneyDiffers", () => {
  it("ignora diferenças menores que epsilon", () => {
    expect(moneyDiffers(10, 10.005)).toBe(false);
    expect(moneyDiffers(10, 10.5)).toBe(true);
  });
  it("retorna false para valores não finitos", () => {
    expect(moneyDiffers(NaN, 1)).toBe(false);
    expect(moneyDiffers(1, Infinity)).toBe(false);
  });
});

describe("buildClienteCadastroDiff", () => {
  const base = {
    itens: [] as {
      produtoId: string;
      produtoNome: string;
      precoUnitario: string;
      precoReferencia: string;
    }[],
    fretePorSaco: "0",
    fretePorTonelada: "0",
    freteRefSaco: "0",
    freteRefTonelada: "0",
    clienteId: "1",
  };

  it("retorna null sem clienteId", () => {
    expect(buildClienteCadastroDiff({ ...base, clienteId: "" })).toBeNull();
  });

  it("retorna null quando nada mudou", () => {
    expect(buildClienteCadastroDiff(base)).toBeNull();
  });

  it("detecta mudança de preço", () => {
    const diff = buildClienteCadastroDiff({
      ...base,
      itens: [
        {
          produtoId: "10",
          produtoNome: "Cal",
          precoUnitario: "120",
          precoReferencia: "100",
        },
      ],
    });
    expect(diff).not.toBeNull();
    expect(diff!.precos[0]).toMatchObject({ produtoId: 10, anterior: 100, novo: 120 });
  });

  it("trata referência ausente como anterior 0", () => {
    const diff = buildClienteCadastroDiff({
      ...base,
      itens: [
        {
          produtoId: "10",
          produtoNome: "",
          precoUnitario: "50",
          precoReferencia: "abc",
        },
      ],
    });
    expect(diff!.precos[0]).toMatchObject({ anterior: 0, novo: 50, produtoNome: "Produto #10" });
  });

  it("ignora itens sem produto ou preço", () => {
    const diff = buildClienteCadastroDiff({
      ...base,
      itens: [
        { produtoId: "", produtoNome: "x", precoUnitario: "10", precoReferencia: "5" },
        { produtoId: "3", produtoNome: "y", precoUnitario: "", precoReferencia: "5" },
      ],
    });
    expect(diff).toBeNull();
  });

  it("detecta mudanças de frete saco e tonelada", () => {
    const diff = buildClienteCadastroDiff({
      ...base,
      fretePorSaco: "5",
      fretePorTonelada: "80",
      freteRefSaco: "3",
      freteRefTonelada: "70",
    });
    expect(diff!.freteSaco).toEqual({ anterior: 3, novo: 5 });
    expect(diff!.freteTonelada).toEqual({ anterior: 70, novo: 80 });
  });
});

describe("hasClienteCadastroDiff", () => {
  it("false para null", () => {
    expect(hasClienteCadastroDiff(null)).toBe(false);
  });
  it("true quando há preços", () => {
    expect(
      hasClienteCadastroDiff({ precos: [{ produtoId: 1, produtoNome: "x", anterior: 1, novo: 2 }] }),
    ).toBe(true);
  });
  it("true quando há frete", () => {
    expect(
      hasClienteCadastroDiff({ precos: [], freteSaco: { anterior: 1, novo: 2 } }),
    ).toBe(true);
  });
});

describe("formatClienteCadastroDiffMessage e payload", () => {
  const diff = {
    precos: [{ produtoId: 1, produtoNome: "Cal", anterior: 100, novo: 120 }],
    freteSaco: { anterior: 3, novo: 5 },
    freteTonelada: { anterior: 70, novo: 80 },
  };

  it("gera mensagem legível", () => {
    const msg = formatClienteCadastroDiffMessage(diff);
    expect(msg).toContain("Cal");
    expect(msg).toContain("Frete por saco");
    expect(msg).toContain("Frete por tonelada");
  });

  it("converte diff em payload de atualização", () => {
    const payload = diffToAtualizarClientePayload(diff);
    expect(payload.precos).toEqual([{ produtoId: 1, preco: 120 }]);
    expect(payload.fretePadraoSaco).toBe(5);
    expect(payload.fretePadraoTonelada).toBe(80);
  });

  it("payload sem fretes quando ausentes", () => {
    const payload = diffToAtualizarClientePayload({ precos: [] });
    expect(payload.fretePadraoSaco).toBeUndefined();
    expect(payload.fretePadraoTonelada).toBeUndefined();
  });
});
