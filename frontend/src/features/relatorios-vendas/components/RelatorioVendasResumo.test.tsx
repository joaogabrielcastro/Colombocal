import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LIMITE_LISTA_ABA, RelatorioVendasResumo } from "./RelatorioVendasResumo";

describe("RelatorioVendasResumo", () => {
  it("na aba mostra recorte de clientes; o resto fica para o PDF", () => {
    const clientes = Array.from({ length: LIMITE_LISTA_ABA + 3 }, (_, i) => ({
      nome: `Cliente ${i + 1}`,
      total: 1000 - i,
      quantidade: 1,
    }));
    render(
      <RelatorioVendasResumo
        totalRegistros={1}
        totalFaturamento={1000}
        totalFrete={0}
        resumoRepresentantesOrdenado={[]}
        resumoClientes={clientes}
        resumoProdutos={[]}
        resumoClienteProdutos={[]}
        onSortRep={vi.fn()}
        sortIndicator={() => ""}
        onExportPdfSecao={vi.fn()}
      />,
    );
    expect(screen.getByText("Cliente 1")).toBeInTheDocument();
    expect(screen.getByText("Cliente 8")).toBeInTheDocument();
    expect(screen.queryByText("Cliente 9")).not.toBeInTheDocument();
    expect(
      screen.getByText(`8 de ${clientes.length} clientes na tela. Lista completa no PDF desta seção.`),
    ).toBeInTheDocument();
  });
});
