import { describe, expect, it } from "vitest";
import { nextPathFromSearch, safeInternalPath } from "./safe-next-path";

describe("safeInternalPath", () => {
  it("aceita caminhos internos", () => {
    expect(safeInternalPath("/vendas")).toBe("/vendas");
    expect(safeInternalPath("/vendas?page=2")).toBe("/vendas?page=2");
  });

  it("bloqueia open redirect", () => {
    expect(safeInternalPath("https://evil.test")).toBe("/");
    expect(safeInternalPath("//evil.test")).toBe("/");
    expect(safeInternalPath("/\\evil.test")).toBe("/");
    expect(safeInternalPath("/login")).toBe("/");
    expect(safeInternalPath("/setup/novo-tenant")).toBe("/");
  });
});

describe("nextPathFromSearch", () => {
  it("lê next da query", () => {
    expect(nextPathFromSearch("?next=%2Fclientes")).toBe("/clientes");
    expect(nextPathFromSearch("")).toBe("/");
  });
});
