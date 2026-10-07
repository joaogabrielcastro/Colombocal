import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./empty-state";

describe("EmptyState", () => {
  it("expõe a mensagem como status e aceita apresentação compacta", () => {
    render(<EmptyState compact title="Nenhum resultado" description="Ajuste os filtros." />);
    const status = screen.getByRole("status");
    expect(status).toHaveClass("py-6");
    expect(status).toHaveTextContent("Nenhum resultado");
    expect(status).toHaveTextContent("Ajuste os filtros.");
  });
});
