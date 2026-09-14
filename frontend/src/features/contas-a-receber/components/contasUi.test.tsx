import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContasAgingFaixas } from "./ContasAgingFaixas";
import { SituacaoVencimento } from "./SituacaoVencimento";
import { kpisCarteiraClientes } from "./ContasKpiCards";

describe("ContasAgingFaixas", () => {
  it("mostra as cinco faixas da API", () => {
    render(
      <ContasAgingFaixas
        faixas={{
          vencidos: 100,
          ate30: 200,
          de31a60: 0,
          de61a90: 0,
          acima90: 0,
        }}
      />,
    );
    expect(screen.getByText("Vencido")).toBeInTheDocument();
    expect(screen.getByText("0–30 dias")).toBeInTheDocument();
    expect(screen.getByText("31–60 dias")).toBeInTheDocument();
    expect(screen.getByText("61–90 dias")).toBeInTheDocument();
    expect(screen.getByText("90+ dias")).toBeInTheDocument();
  });
});

describe("SituacaoVencimento", () => {
  it("não usa vermelho para valor a vencer", () => {
    const { container } = render(
      <SituacaoVencimento
        aberto={7950.9}
        diasAtraso={0}
        diasAteVencer={5}
        venceHoje={false}
      />,
    );
    expect(container.textContent).toMatch(/vence em 5 dias/);
    expect(container.querySelector(".text-red-700")).toBeNull();
  });

  it("marca atraso em vermelho", () => {
    const { container } = render(
      <SituacaoVencimento
        aberto={7950.9}
        diasAtraso={11}
        diasAteVencer={0}
        venceHoje={false}
      />,
    );
    expect(container.textContent).toMatch(/11 dias em atraso/);
    expect(container.querySelector(".text-red-700")).not.toBeNull();
  });
});

describe("kpisCarteiraClientes", () => {
  it("monta indicadores do conjunto filtrado, não da página", () => {
    const kpis = kpisCarteiraClientes({
      totalEmAberto: 1000,
      clientes: 12,
      totalVencido: 250,
      totalAVencer: 750,
      pctVencido: 25,
      filtrado: true,
    });
    expect(kpis).toHaveLength(5);
    expect(kpis[0].label).toMatch(/filtro/);
    expect(kpis[2].tone).toBe("danger");
    expect(kpis[3].tone).toBe("muted");
  });
});
