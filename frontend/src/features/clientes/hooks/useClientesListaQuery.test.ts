import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
}));

import { useClientesListaQuery } from "./useClientesListaQuery";
import { createQueryWrapper } from "@/test-utils/reactQuery";

function setTestJwt(tenantId: number) {
  const payload = btoa(JSON.stringify({ tid: tenantId, sub: 1 }));
  localStorage.setItem("colombocal_auth_token", `hdr.${payload}.sig`);
}

beforeEach(() => {
  apiGet.mockReset();
  localStorage.clear();
  setTestJwt(1);
});

afterEach(() => {
  localStorage.clear();
});

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
