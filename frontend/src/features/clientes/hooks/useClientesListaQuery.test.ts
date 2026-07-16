import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
}));

import { useClientesListaQuery } from "./useClientesListaQuery";
import { createQueryWrapper } from "@/test-utils/reactQuery";

beforeEach(() => apiGet.mockReset());

describe("useClientesListaQuery", () => {
  it("monta a query com paginação e busca", async () => {
    apiGet.mockResolvedValue({ clientes: [{ id: 1 }], total: 1 });
    const { result } = renderHook(
      () => useClientesListaQuery({ busca: "abc", page: 2, pageSize: 20 }),
      { wrapper: createQueryWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.total).toBe(1);
    const url = apiGet.mock.calls[0][0] as string;
    expect(url).toContain("take=20");
    expect(url).toContain("skip=40");
    expect(url).toContain("busca=abc");
    expect(url).toContain("ativo=true");
  });

  it("omite busca quando vazia", async () => {
    apiGet.mockResolvedValue({ clientes: [], total: 0 });
    const { result } = renderHook(
      () => useClientesListaQuery({ busca: "", page: 0, pageSize: 10 }),
      { wrapper: createQueryWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiGet.mock.calls[0][0]).not.toContain("busca=");
  });
});
