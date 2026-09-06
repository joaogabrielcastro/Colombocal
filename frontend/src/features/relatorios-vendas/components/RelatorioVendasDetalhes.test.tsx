import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RelatorioVendasDetalhes } from "./RelatorioVendasDetalhes";
import type { Venda } from "@/lib/utils";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: unknown; href: string }) => (
    <a href={href}>{children as never}</a>
  ),
}));

function vendaFake(over: Partial<Venda> & { id: number }): Venda {
  return {
    clienteId: 1,
    vendedorId: 1,
    frete: 10,
    freteRecibo: false,
    valorTotal: 100,
    dataVenda: "2026-08-01T12:00:00.000Z",
    cliente: { nomeFantasia: "Cliente A", razaoSocial: "Cliente A LTDA" },
    vendedor: { nome: "Rep 1" },
    itens: [],
    ...over,
  } as unknown as Venda;
}

describe("RelatorioVendasDetalhes", () => {
  it("filtra a lista local por cliente, ordem e observação", async () => {
    const user = userEvent.setup();
    render(
      <RelatorioVendasDetalhes
        vendas={[
          vendaFake({ id: 1, numeroVenda: 10, observacoes: "pedido especial", cliente: { nomeFantasia: "Alpha", razaoSocial: "A" } as Venda["cliente"] }),
          vendaFake({ id: 2, numeroVenda: 20, cliente: { nomeFantasia: "Beta", razaoSocial: "B" } as Venda["cliente"] }),
        ]}
        onExportPdfSecao={vi.fn()}
      />,
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Buscar no detalhamento"), "especial");
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
  });

  it("pagina a partir de 20 registros sem descartar o restante", async () => {
    const user = userEvent.setup();
    const vendas = Array.from({ length: 21 }, (_, i) =>
      vendaFake({
        id: i + 1,
        numeroVenda: i + 1,
        dataVenda: `2026-08-${String((i % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
        cliente: { nomeFantasia: `Cli ${i + 1}`, razaoSocial: `Cli ${i + 1}` } as Venda["cliente"],
      }),
    );
    render(
      <RelatorioVendasDetalhes vendas={vendas} totalRegistros={21} onExportPdfSecao={vi.fn()} />,
    );
    expect(screen.getByText("Cli 21")).toBeInTheDocument();
    expect(screen.queryByText("Cli 1")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.getByText("Cli 1")).toBeInTheDocument();
  });
});
