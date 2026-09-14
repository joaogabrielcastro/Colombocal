import { describe, expect, it } from "vitest";
import {
  atrasoDoTitulo,
  classStatusTitulo,
  formatPct,
  labelMaiorAtraso,
  labelStatusTitulo,
  rotuloSituacaoVencimento,
  saldoAbertoTitulo,
  situacaoVencimentoKind,
  venceHojeDoTitulo,
} from "./display";
import type { TituloItem } from "../types";

const baseTitulo = {
  id: 1,
  vencimento: "2026-09-13T12:00:00.000Z",
  valorOriginal: 100,
  valorPago: 0,
  status: "aberto" as const,
  cliente: { id: 1, razaoSocial: "A" },
};

describe("display contas a receber", () => {
  it("saldoAbertoTitulo = original − pago, nunca negativo", () => {
    expect(saldoAbertoTitulo({ valorOriginal: 100, valorPago: 40 })).toBe(60);
    expect(saldoAbertoTitulo({ valorOriginal: 50, valorPago: 80 })).toBe(0);
  });

  it("formatPct e status não pintam aberto de vermelho", () => {
    expect(formatPct(8.83)).toMatch(/8[,.]83\s*%/);
    expect(labelStatusTitulo("aberto")).toBe("Aberto");
    expect(classStatusTitulo("aberto")).not.toMatch(/red/);
    expect(classStatusTitulo("quitado")).toMatch(/green/);
  });

  it("prioriza diasAtraso da API", () => {
    const t = { ...baseTitulo, diasAtraso: 11 } as TituloItem;
    expect(atrasoDoTitulo(t, 100)).toBe(11);
  });

  it("vence hoje não é tratado como atraso", () => {
    const kind = situacaoVencimentoKind({
      aberto: 100,
      diasAtraso: 0,
      venceHoje: true,
    });
    expect(kind).toBe("vence_hoje");
    expect(rotuloSituacaoVencimento(kind, 0)).toBe("vence hoje");
    expect(venceHojeDoTitulo({ ...baseTitulo, venceHoje: true } as TituloItem, 100)).toBe(
      true,
    );
  });

  it("diferencia vencido e a vencer", () => {
    expect(
      rotuloSituacaoVencimento(
        situacaoVencimentoKind({ aberto: 100, diasAtraso: 11, venceHoje: false }),
        11,
      ),
    ).toBe("11 dias em atraso");
    expect(
      rotuloSituacaoVencimento(
        situacaoVencimentoKind({ aberto: 100, diasAtraso: 0, venceHoje: false }),
        5,
      ),
    ).toBe("vence em 5 dias");
  });

  it("maior atraso zero aparece como em dia", () => {
    expect(labelMaiorAtraso(0)).toBe("Em dia");
    expect(labelMaiorAtraso(45)).toBe("45 dias");
  });
});
