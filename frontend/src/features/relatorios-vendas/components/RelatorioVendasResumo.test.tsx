import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { LIMITE_LISTA_ABA, RelatorioVendasResumo } from "./RelatorioVendasResumo";

const evolucaoVazia = { granularidade: "dia" as const, pontos: [] };

function renderResumo(
  over: Partial<ComponentProps<typeof RelatorioVendasResumo>> = {},
) {
  return render(
    <RelatorioVendasResumo
      totalRegistros={1}
      totalFaturamento={1000}
      totalFrete={0}
      evolucao={evolucaoVazia}
      resumoRepresentantesOrdenado={[]}
      resumoClientes={[]}
      resumoProdutos={[]}
      resumoClienteProdutos={[]}
      onSortRep={vi.fn()}
      sortIndicator={() => ""}
      onExportPdfSecao={vi.fn()}
      {...over}
    />,
  );
}

describe("RelatorioVendasResumo", () => {
  it("mostra recorte de clientes e permite ver a lista completa", async () => {
    const user = userEvent.setup();
    const clientes = Array.from({ length: LIMITE_LISTA_ABA + 3 }, (_, i) => ({
      nome: `Cliente ${i + 1}`,
      total: 1000 - i,
      quantidade: 1,
      participacao: 10,
    }));
    renderResumo({ resumoClientes: clientes });
    expect(screen.getByText("Cliente 1")).toBeInTheDocument();
    expect(screen.getByText(`Cliente ${LIMITE_LISTA_ABA}`)).toBeInTheDocument();
    expect(screen.queryByText(`Cliente ${LIMITE_LISTA_ABA + 1}`)).not.toBeInTheDocument();
    expect(
      screen.getByText(`Exibindo ${LIMITE_LISTA_ABA} de ${clientes.length} clientes`),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver lista completa" }));
    expect(screen.getByText(`Cliente ${clientes.length}`)).toBeInTheDocument();
  });

  it("calcula ticket médio e destaca SEM COMISSÃO com os totais existentes", () => {
    renderResumo({
      totalRegistros: 10,
      totalFaturamento: 1000,
      resumoRepresentantesOrdenado: [
        {
          nome: "SEM COMISSÃO",
          total: 400,
          frete: 0,
          quantidade: 4,
          ticketMedio: 100,
          participacao: 40,
        },
        {
          nome: "LUISTA REPRESENTAÇÕES",
          total: 600,
          frete: 0,
          quantidade: 6,
          ticketMedio: 100,
          participacao: 60,
        },
      ],
    });
    expect(screen.getByText("Vendas no período")).toBeInTheDocument();
    expect(screen.getAllByText("Vendas sem comissão").length).toBeGreaterThan(0);
    expect(screen.getByText("40.00% das vendas")).toBeInTheDocument();
    expect(screen.getByText("SEM COMISSÃO")).toBeInTheDocument();
    expect(screen.getByText("LUISTA REPRESENTAÇÕES")).toBeInTheDocument();
  });

  it("ticket médio usa o total de registros do período", () => {
    renderResumo({ totalRegistros: 4, totalFaturamento: 200 });
    expect(screen.getByText("Ticket médio")).toBeInTheDocument();
    expect(screen.getByText(/50,00/)).toBeInTheDocument();
  });
});
