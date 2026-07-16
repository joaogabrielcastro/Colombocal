import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const apiFetchWithMeta = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetchWithMeta: (...args: unknown[]) => apiFetchWithMeta(...args),
}));

import { useRelatorioVendasQuery } from "./useRelatorioVendasQuery";
import { createQueryWrapper } from "@/test-utils/reactQuery";
import type { RelatorioVendasParams } from "../types";

const params: RelatorioVendasParams = {
  dataInicio: "2026-01-01",
  dataFim: "2026-12-31",
  busca: "  cal  ",
  vendedorId: "3",
  clienteId: "4",
  produtoId: "5",
};

beforeEach(() => apiFetchWithMeta.mockReset());

describe("useRelatorioVendasQuery", () => {
  it("não busca quando enabled é false", async () => {
    const { result } = renderHook(() => useRelatorioVendasQuery(params, false), {
      wrapper: createQueryWrapper(),
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.fetchStatus).toBe("idle");
    expect(apiFetchWithMeta).not.toHaveBeenCalled();
  });

  it("busca e aplica totalRegistros do meta", async () => {
    apiFetchWithMeta.mockResolvedValue({
      data: { vendas: [], totalFaturamento: 0, quantidade: 0, totalRegistros: 2 },
      meta: { totalCount: 99 },
    });
    const { result } = renderHook(() => useRelatorioVendasQuery(params, true), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalRegistros).toBe(99);

    const url = apiFetchWithMeta.mock.calls[0][0] as string;
    expect(url).toContain("busca=cal");
    expect(url).toContain("vendedorId=3");
    expect(url).toContain("take=500");
  });

  it("omite parâmetros vazios", async () => {
    apiFetchWithMeta.mockResolvedValue({
      data: { vendas: [], totalFaturamento: 0, quantidade: 0, totalRegistros: 0 },
      meta: {},
    });
    const vazio: RelatorioVendasParams = {
      dataInicio: "",
      dataFim: "",
      busca: "   ",
      vendedorId: "",
      clienteId: "",
      produtoId: "",
    };
    const { result } = renderHook(() => useRelatorioVendasQuery(vazio, true), {
      wrapper: createQueryWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalRegistros).toBe(0);

    const url = apiFetchWithMeta.mock.calls[0][0] as string;
    expect(url).not.toContain("busca=");
    expect(url).not.toContain("vendedorId=");
    expect(url).not.toContain("dataInicio=");
    expect(url).toContain("take=500");
  });
});
