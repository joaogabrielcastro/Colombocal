import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RelatorioVendasEvolucaoChart } from "./RelatorioVendasEvolucaoChart";

describe("RelatorioVendasEvolucaoChart", () => {
  it("mostra tooltip formatado a partir dos pontos reais", () => {
    render(
      <RelatorioVendasEvolucaoChart
        evolucao={{
          granularidade: "dia",
          pontos: [
            { periodo: "2026-08-01", label: "01/08", faturamento: 1500, quantidade: 2 },
            { periodo: "2026-08-02", label: "02/08", faturamento: 0, quantidade: 0 },
          ],
        }}
      />,
    );
    expect(screen.getByText("Desempenho no período")).toBeInTheDocument();
    expect(screen.getByLabelText(/Evolução do faturamento/)).toBeInTheDocument();
    expect(screen.getByTitle(/01\/08: .* · 2 venda/)).toBeInTheDocument();
  });

  it("exibe estado vazio sem inventar dados", () => {
    render(
      <RelatorioVendasEvolucaoChart
        evolucao={{ granularidade: "dia", pontos: [{ periodo: "2026-08-01", label: "01/08", faturamento: 0, quantidade: 0 }] }}
      />,
    );
    expect(
      screen.getByText("Nenhuma venda encontrada para os filtros selecionados."),
    ).toBeInTheDocument();
  });
});
