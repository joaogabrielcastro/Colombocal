import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "./pagination";

describe("Pagination", () => {
  it("exibe o intervalo e navega em paginação baseada em zero", async () => {
    const onPageChange = vi.fn();
    render(
      <Pagination page={1} totalPages={3} total={45} pageSize={20} zeroBased
        noun="cliente" onPageChange={onPageChange} />,
    );

    expect(screen.getByText(/21–40/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("desabilita os controles nos limites", () => {
    render(<Pagination page={1} totalPages={2} onPageChange={() => undefined} />);
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima página" })).toBeEnabled();
  });
});
