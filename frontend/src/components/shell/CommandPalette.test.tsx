import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CommandPalette, matchesQuery, normalizeSearch, parseOrdemQuery } from "./CommandPalette";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
  ApiError: class ApiError extends Error {
    status = 0;
  },
}));

describe("helpers da busca", () => {
  it("normaliza acentos e caixa", () => {
    expect(normalizeSearch("  Configurações ")).toBe("configuracoes");
  });

  it("casa por rótulo e palavras-chave", () => {
    expect(matchesQuery({ label: "Contas a receber", keywords: "titulos vencidos" }, "vencid")).toBe(true);
    expect(matchesQuery({ label: "Produtos" }, "cliente")).toBe(false);
  });

  it("reconhece número de ordem", () => {
    expect(parseOrdemQuery("#12")).toBe(12);
    expect(parseOrdemQuery("12")).toBe(12);
    expect(parseOrdemQuery("ordem 7")).toBe(7);
    expect(parseOrdemQuery("12a")).toBeNull();
    expect(parseOrdemQuery("0")).toBeNull();
  });
});

describe("CommandPalette", () => {
  beforeEach(() => {
    push.mockReset();
    apiGet.mockReset();
  });

  it("lista só telas permitidas ao membro", () => {
    render(
      <CommandPalette
        open
        onClose={() => {}}
        nav={{ isAdmin: false, navPermissions: ["vendas"] }}
      />,
    );
    expect(screen.getByRole("option", { name: /Nova venda/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Receber pagamento/ })).toBeNull();
    expect(screen.queryByRole("option", { name: /Usuários/ })).toBeNull();
  });

  it("busca ordem e navega com Enter", async () => {
    apiGet.mockResolvedValue({ id: 55, numeroVenda: 9, valorTotal: 100, cliente: { razaoSocial: "ACME" } });
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} nav={{ isAdmin: true }} />);
    const input = screen.getByRole("combobox", { name: "Buscar" });
    fireEvent.change(input, { target: { value: "#9" } });
    await screen.findByRole("option", { name: /Ordem #9/ }, { timeout: 2000 });
    expect(apiGet).toHaveBeenCalledWith("/vendas/por-ordem/9");
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/vendas/55"));
    expect(onClose).toHaveBeenCalled();
  });

  it("não consulta clientes sem permissão", async () => {
    render(<CommandPalette open onClose={() => {}} nav={{ isAdmin: false, navPermissions: ["vendas"] }} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Buscar" }), { target: { value: "acme" } });
    await new Promise((r) => setTimeout(r, 300));
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("fecha com Escape", () => {
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} nav={{ isAdmin: true }} />);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Buscar" }), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
