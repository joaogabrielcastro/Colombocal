import { describe, expect, it } from "vitest";
import { evolucaoDoRelatorio, montarEvolucaoPeriodo } from "./evolucao";

describe("montarEvolucaoPeriodo", () => {
  it("agrupa por dia no período curto", () => {
    const out = montarEvolucaoPeriodo(
      [
        { dataVenda: "2026-08-01T12:00:00.000Z", valorTotal: 100 },
        { dataVenda: "2026-08-01T12:00:00.000Z", valorTotal: 50 },
        { dataVenda: "2026-08-03T12:00:00.000Z", valorTotal: 200 },
      ],
      "2026-08-01",
      "2026-08-03",
    );
    expect(out.granularidade).toBe("dia");
    expect(out.pontos).toHaveLength(3);
    expect(out.pontos[0]).toMatchObject({ faturamento: 150, quantidade: 2 });
    expect(out.pontos[1]).toMatchObject({ faturamento: 0, quantidade: 0 });
    expect(out.pontos[2]).toMatchObject({ faturamento: 200, quantidade: 1 });
  });

  it("usa mês quando o intervalo passa de 45 dias", () => {
    const out = montarEvolucaoPeriodo(
      [
        { dataVenda: "2026-01-15T12:00:00.000Z", valorTotal: 10 },
        { dataVenda: "2026-03-02T12:00:00.000Z", valorTotal: 30 },
      ],
      "2026-01-01",
      "2026-03-31",
    );
    expect(out.granularidade).toBe("mes");
    expect(out.pontos.map((p) => p.periodo)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(out.pontos[0].faturamento).toBe(10);
    expect(out.pontos[2].faturamento).toBe(30);
  });

  it("omite dias zerados quando a série é esparsa", () => {
    const out = montarEvolucaoPeriodo(
      [{ dataVenda: "2026-08-01T12:00:00.000Z", valorTotal: 10 }],
      "2026-08-01",
      "2026-08-31",
    );
    expect(out.pontos).toHaveLength(1);
    expect(out.pontos[0].periodo).toBe("2026-08-01");
  });

  it("sem vendas preenche o período com zeros", () => {
    const out = montarEvolucaoPeriodo([], "2026-08-01", "2026-08-02");
    expect(out.pontos).toHaveLength(2);
    expect(out.pontos.every((p) => p.quantidade === 0)).toBe(true);
  });

  it("45 dias inclusive permanece diário; 46 dias passa a mensal", () => {
    const dia = montarEvolucaoPeriodo(
      [{ dataVenda: "2026-01-01T12:00:00.000Z", valorTotal: 10 }],
      "2026-01-01",
      "2026-02-14",
    );
    expect(dia.granularidade).toBe("dia");
    const mes = montarEvolucaoPeriodo(
      [{ dataVenda: "2026-01-01T12:00:00.000Z", valorTotal: 10 }],
      "2026-01-01",
      "2026-02-15",
    );
    expect(mes.granularidade).toBe("mes");
    expect(mes.pontos.map((p) => p.periodo)).toEqual(["2026-01", "2026-02"]);
  });

  it("um único dia gera um ponto com faturamento e quantidade reais", () => {
    const out = montarEvolucaoPeriodo(
      [
        { dataVenda: "2026-09-06T12:00:00.000Z", valorTotal: 80 },
        { dataVenda: "2026-09-06T12:00:00.000Z", valorTotal: 20 },
      ],
      "2026-09-06",
      "2026-09-06",
    );
    expect(out.granularidade).toBe("dia");
    expect(out.pontos).toEqual([
      { periodo: "2026-09-06", label: "06/09", faturamento: 100, quantidade: 2 },
    ]);
  });

  it("travessia de ano agrupa dezembro e janeiro no modo mensal", () => {
    const out = montarEvolucaoPeriodo(
      [
        { dataVenda: "2025-12-20T12:00:00.000Z", valorTotal: 40 },
        { dataVenda: "2026-01-02T12:00:00.000Z", valorTotal: 60 },
      ],
      "2025-12-01",
      "2026-01-31",
    );
    expect(out.granularidade).toBe("mes");
    expect(out.pontos.map((p) => p.periodo)).toEqual(["2025-12", "2026-01"]);
    expect(out.pontos[0].faturamento).toBe(40);
    expect(out.pontos[1].faturamento).toBe(60);
    expect(out.pontos.reduce((acc, p) => acc + p.quantidade, 0)).toBe(2);
  });
});

describe("evolucaoDoRelatorio", () => {
  it("prioriza a série completa da API", () => {
    const api = {
      granularidade: "mes" as const,
      pontos: [{ periodo: "2026-08", label: "ago/26", faturamento: 999, quantidade: 4 }],
    };
    const out = evolucaoDoRelatorio(
      api,
      [{ dataVenda: "2026-08-01T12:00:00.000Z", valorTotal: 1 }],
      "2026-08-01",
      "2026-08-31",
    );
    expect(out).toEqual(api);
  });

  it("prioriza a série da API mesmo vazia, sem usar a página de detalhe", () => {
    const api = {
      granularidade: "dia" as const,
      pontos: [] as Array<{ periodo: string; label: string; faturamento: number; quantidade: number }>,
    };
    const out = evolucaoDoRelatorio(
      api,
      [{ dataVenda: "2026-08-01T12:00:00.000Z", valorTotal: 999 }],
      "2026-08-01",
      "2026-08-01",
    );
    expect(out.pontos).toEqual([]);
  });

  it("faz fallback para as vendas da página se a API não enviar série", () => {
    const out = evolucaoDoRelatorio(
      undefined,
      [{ dataVenda: "2026-08-01T12:00:00.000Z", valorTotal: 80 }],
      "2026-08-01",
      "2026-08-01",
    );
    expect(out.pontos[0].faturamento).toBe(80);
    expect(out.pontos[0].quantidade).toBe(1);
  });
});
