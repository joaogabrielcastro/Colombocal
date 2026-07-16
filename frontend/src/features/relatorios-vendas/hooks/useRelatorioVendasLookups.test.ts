import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
}));

import { useRelatorioVendasLookups } from "./useRelatorioVendasLookups";

beforeEach(() => apiGet.mockReset());

describe("useRelatorioVendasLookups", () => {
  it("carrega vendedores, clientes e produtos", async () => {
    // Promise.all preserva a ordem: vendedores, clientes, produtos
    apiGet
      .mockResolvedValueOnce([{ id: 1, nome: "V" }])
      .mockResolvedValueOnce({ clientes: [{ id: 2 }] })
      .mockResolvedValueOnce([{ id: 3 }]);

    const { result } = renderHook(() => useRelatorioVendasLookups());
    await waitFor(() => expect(result.current.vendedores.length).toBe(1));
    expect(result.current.clientes).toEqual([{ id: 2 }]);
    expect(result.current.produtos).toEqual([{ id: 3 }]);
  });
});
