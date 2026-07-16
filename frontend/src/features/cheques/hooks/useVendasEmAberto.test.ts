import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

let getImpl: (url: string) => Promise<unknown> = async () => [];
const calls: string[] = [];

vi.mock("@/lib/api", () => ({
  default: {
    get: (url: string) => {
      calls.push(url);
      return getImpl(url);
    },
  },
}));

import { useVendasEmAberto } from "./useVendasEmAberto";

beforeEach(() => {
  calls.length = 0;
  getImpl = async () => [];
});

describe("useVendasEmAberto", () => {
  it("não busca sem clienteId", async () => {
    const { result } = renderHook(() => useVendasEmAberto(""));
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.vendas).toEqual([]);
    expect(calls.length).toBe(0);
  });

  it("carrega vendas do cliente", async () => {
    getImpl = async () => [{ id: 1 }, { id: 2 }];
    const { result } = renderHook(() => useVendasEmAberto("5"));
    await waitFor(() => expect(result.current.vendas.length).toBe(2));
    expect(result.current.loading).toBe(false);
    expect(calls[0]).toContain("clienteId=5");
  });

  it("em erro mantém lista vazia", async () => {
    getImpl = () => Promise.reject(new Error("falha"));
    const { result } = renderHook(() => useVendasEmAberto("9"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.vendas).toEqual([]);
  });

  it("ignora resposta após desmontar (cancelled)", async () => {
    let resolve!: (rows: unknown) => void;
    getImpl = () => new Promise((r) => (resolve = r));
    const { result, unmount } = renderHook(() => useVendasEmAberto("7"));
    unmount();
    resolve([{ id: 1 }]);
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current.vendas).toEqual([]);
  });
});
