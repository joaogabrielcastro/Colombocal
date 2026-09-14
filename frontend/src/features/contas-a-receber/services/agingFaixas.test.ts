import { describe, expect, it } from "vitest";
import { barrasAging, totalFaixasAging } from "./agingFaixas";

const faixas = {
  vencidos: 258.2,
  ate30: 639.74,
  de31a60: 0,
  de61a90: 0,
  acima90: 0,
};

describe("barrasAging", () => {
  it("usa só as faixas da API e preserva as 5 categorias existentes", () => {
    const barras = barrasAging(faixas);
    expect(barras).toHaveLength(5);
    expect(barras.map((b) => b.key)).toEqual([
      "vencidos",
      "ate30",
      "de31a60",
      "de61a90",
      "acima90",
    ]);
    const soma = barras.reduce((acc, b) => acc + b.valor, 0);
    expect(soma).toBeCloseTo(totalFaixasAging(faixas));
    expect(barras[0].pct + barras[1].pct).toBeCloseTo(100);
  });

  it("não inventa percentual quando o conjunto é vazio", () => {
    const barras = barrasAging({
      vencidos: 0,
      ate30: 0,
      de31a60: 0,
      de61a90: 0,
      acima90: 0,
    });
    expect(barras.every((b) => b.pct === 0)).toBe(true);
  });
});
