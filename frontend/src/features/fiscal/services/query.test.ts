import { describe, expect, it } from "vitest";
import { mesParaPeriodo, periodoParaMes, formatChave } from "./query";

describe("fiscal query helpers", () => {
  it("mesParaPeriodo cobre o mês inteiro", () => {
    expect(mesParaPeriodo("2026-09")).toEqual({
      dataInicio: "2026-09-01",
      dataFim: "2026-09-30",
    });
    expect(mesParaPeriodo("2026-02")).toEqual({
      dataInicio: "2026-02-01",
      dataFim: "2026-02-28",
    });
  });

  it("periodoParaMes", () => {
    expect(periodoParaMes("2026-09-01")).toBe("2026-09");
  });

  it("formatChave agrupa 44 dígitos", () => {
    const chave = "35260911222333000181550010000001251000001250";
    expect(formatChave(chave).replace(/\s/g, "")).toBe(chave);
    expect(formatChave(null)).toBe("—");
  });
});
