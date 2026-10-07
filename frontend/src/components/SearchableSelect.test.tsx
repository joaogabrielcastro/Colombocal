import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SearchableSelect from "./SearchableSelect";

describe("SearchableSelect", () => {
  it("associa o rótulo visível ao combobox", () => {
    render(
      <SearchableSelect
        label="Cliente"
        value=""
        onChange={vi.fn()}
        loadOptions={vi.fn(async () => [])}
      />,
    );

    expect(screen.getByLabelText("Cliente")).toHaveAttribute("role", "combobox");
  });

  it("mantém nome acessível quando o rótulo visual é oculto", () => {
    render(
      <SearchableSelect
        label="Produto"
        hideLabel
        value=""
        onChange={vi.fn()}
        loadOptions={vi.fn(async () => [])}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Produto" })).toBeInTheDocument();
  });
});
