import { describe, expect, it } from "vitest";
import { freteLinha, quantidadeEmSacos } from "./frete";

describe("freteLinha", () => {
  it("produto em ton com pesoKg de saco: 36 t × R$100 = R$3600 (não R$90)", () => {
    expect(
      freteLinha({
        unidade: "ton",
        pesoKg: 25,
        quantidade: 36,
        fretePorSaco: 0,
        fretePorTonelada: 100,
      }),
    ).toBe(3600);
  });

  it("produto em saco com pesoKg ainda rateia pelo peso", () => {
    expect(
      freteLinha({
        unidade: "saco",
        pesoKg: 8,
        quantidade: 10,
        fretePorSaco: 0,
        fretePorTonelada: 100,
      }),
    ).toBe(8);
  });

  it("produto em kg ignora pesoKg do cadastro", () => {
    expect(
      freteLinha({
        unidade: "kg",
        pesoKg: 25,
        quantidade: 2000,
        fretePorSaco: 0,
        fretePorTonelada: 100,
      }),
    ).toBe(200);
  });
});

/**
 * Mesma regra da nova OC: a quantidade digitada está na unidade do cadastro
 * e é convertida para sacos antes de gravar/imprimir.
 */
describe("quantidadeEmSacos (ordem de carregamento)", () => {
  it("produto em saco mantém a quantidade", () => {
    expect(
      quantidadeEmSacos({ quantidade: 160, unidade: "saco", pesoKg: 25 }),
    ).toBe(160);
    expect(quantidadeEmSacos({ quantidade: 160, unidade: "SAC" })).toBe(160);
  });

  it("produto em ton sem pesoKg usa saco de 20 kg: 160 t = 8.000 sacos", () => {
    expect(quantidadeEmSacos({ quantidade: 160, unidade: "ton" })).toBe(8000);
  });

  it("produto em ton com saco 25 kg: 4 t = 160 sacos; 160 t = 6.400 sacos", () => {
    expect(
      quantidadeEmSacos({ quantidade: 4, unidade: "ton", pesoKg: 25 }),
    ).toBe(160);
    expect(
      quantidadeEmSacos({ quantidade: 160, unidade: "ton", pesoKg: 25 }),
    ).toBe(6400);
  });

  it("produto em kg divide pelo peso do saco", () => {
    expect(
      quantidadeEmSacos({ quantidade: 4000, unidade: "kg", pesoKg: 25 }),
    ).toBe(160);
    expect(quantidadeEmSacos({ quantidade: 40, unidade: "kg" })).toBe(2);
  });

  it("aceita vírgula decimal e aliases de unidade", () => {
    expect(quantidadeEmSacos({ quantidade: "2,5", unidade: "tonelada" })).toBe(
      125,
    );
    expect(quantidadeEmSacos({ quantidade: 10, unidade: "t" })).toBe(500);
  });

  it("quantidade inválida ou zero vira 0", () => {
    expect(quantidadeEmSacos({ quantidade: 0, unidade: "saco" })).toBe(0);
    expect(quantidadeEmSacos({ quantidade: -10, unidade: "ton" })).toBe(0);
    expect(quantidadeEmSacos({ quantidade: "abc", unidade: "saco" })).toBe(0);
  });

  it("ENSACADA não converte ton→sacos (cenário dolomita do pátio)", () => {
    expect(
      quantidadeEmSacos({
        quantidade: 416,
        unidade: "ton",
        nome: "DOLOMITA M-325 ENSACADA",
      }),
    ).toBe(416);
    expect(
      quantidadeEmSacos({
        quantidade: 64,
        unidade: "ton",
        nome: "DOLOMITA M-040 ENSACADA",
      }),
    ).toBe(64);
  });

  it("dolomita a granel (sem ENSACADA) ainda converte ton→sacos", () => {
    expect(
      quantidadeEmSacos({
        quantidade: 160,
        unidade: "ton",
        nome: "DOLOMITA M-325",
      }),
    ).toBe(8000);
  });
});
