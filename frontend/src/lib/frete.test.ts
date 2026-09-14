import { describe, expect, it } from "vitest";
import { quantidadeEmSacos } from "./frete";

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
});
