import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const getWithMeta = vi.fn();
vi.mock("@/lib/api", () => ({
  default: { getWithMeta: (...args: unknown[]) => getWithMeta(...args) },
}));

import { useChequesQuery } from "./useChequesQuery";
import { createQueryWrapper } from "@/test-utils/reactQuery";

const filtros = {
  dataInicio: "2026-01-01",
  dataFim: "2026-12-31",
  cliente: "Cli",
  emitente: "Emi",
  banco: "001",
  numero: "123",
  valorMin: "10",
  valorMax: "1000",
  ordem: "#7",
  page: 2,
  pageSize: 25,
};

beforeEach(() => getWithMeta.mockReset());

describe("useChequesQuery", () => {
  it("normaliza payload em array", async () => {
    getWithMeta.mockResolvedValue({ data: [{ id: 1 }], meta: { totalCount: 1 } });
    const { result } = renderHook(() => useChequesQuery(filtros), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.cheques).toEqual([{ id: 1 }]);
    expect(result.current.data?.resumo).toBeNull();

    const url = getWithMeta.mock.calls[0][0] as string;
    expect(url).toContain("valorMax=1000");
    expect(url).toContain("ordem=7");
    expect(url).toContain("skip=25");
    expect(url).toContain("resumo=1");
  });

  it("normaliza payload com items e resumo", async () => {
    getWithMeta.mockResolvedValue({
      data: { items: [{ id: 2 }], resumo: { count: 1, total: 500 } },
      meta: { totalCount: null },
    });
    const { result } = renderHook(() => useChequesQuery(filtros), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.cheques).toEqual([{ id: 2 }]);
    expect(result.current.data?.resumo).toEqual({ count: 1, total: 500 });
    expect(result.current.data?.total).toBe(1);
  });

  it("ignora valorMax inválido", async () => {
    getWithMeta.mockResolvedValue({ data: [], meta: { totalCount: 0 } });
    const { result } = renderHook(
      () => useChequesQuery({ ...filtros, valorMax: "abc", ordem: "" }),
      { wrapper: createQueryWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = getWithMeta.mock.calls[0][0] as string;
    expect(url).not.toContain("valorMax=");
    expect(url).not.toContain("ordem=");
  });

  it("omite filtros vazios", async () => {
    getWithMeta.mockResolvedValue({ data: [], meta: { totalCount: 0 } });
    const vazio = {
      dataInicio: "",
      dataFim: "",
      cliente: "",
      emitente: "",
      banco: "",
      numero: "",
      valorMin: "",
      valorMax: "",
      ordem: "",
      page: 1,
      pageSize: 50,
    };
    const { result } = renderHook(() => useChequesQuery(vazio), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = getWithMeta.mock.calls[0][0] as string;
    expect(url).not.toContain("dataInicio=");
    expect(url).not.toContain("cliente=");
    expect(url).toContain("skip=0");
    expect(url).toContain("resumo=1");
  });
});
