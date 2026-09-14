import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchTodasPaginas } from "./fetchPaginas";
import { CONTAS_EXPORT_TAKE } from "../constants";

const { apiFetchWithMeta } = vi.hoisted(() => ({
  apiFetchWithMeta: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiFetchWithMeta,
}));

describe("fetchTodasPaginas", () => {
  beforeEach(() => {
    apiFetchWithMeta.mockReset();
  });

  it("concatena páginas até acabar", async () => {
    apiFetchWithMeta
      .mockResolvedValueOnce({
        data: { titulos: [{ id: 1 }, { id: 2 }], resumo: { totalTitulos: 2 } },
        meta: { totalCount: 2 },
      })
      .mockResolvedValueOnce({
        data: { titulos: [], resumo: { totalTitulos: 2 } },
        meta: { totalCount: 2 },
      });

    const { items, truncated } = await fetchTodasPaginas<{
      titulos: { id: number }[];
      resumo: { totalTitulos: number };
    }>({
      path: "/relatorios/titulos",
      params: new URLSearchParams({ vendedorId: "3" }),
      pick: (d) => d.titulos,
      totalFrom: (d, meta) => meta ?? d.resumo.totalTitulos,
    });

    expect(items).toHaveLength(2);
    expect(truncated).toBe(false);
    const url = String(apiFetchWithMeta.mock.calls[0][0]);
    expect(url).toContain("vendedorId=3");
    expect(url).toContain(`take=${CONTAS_EXPORT_TAKE}`);
    expect(url).toContain("skip=0");
  });

  it("repassa situacao e ordenar do filtro", async () => {
    apiFetchWithMeta.mockResolvedValueOnce({
      data: { clientesDevedores: [{ id: 1 }], clientesDevedoresCount: 1 },
      meta: { totalCount: 1 },
    });

    type FinPage = {
      clientesDevedores: { id: number }[];
      clientesDevedoresCount: number;
    };

    await fetchTodasPaginas<FinPage>({
      path: "/relatorios/financeiro",
      params: new URLSearchParams({ ordenar: "atraso", busca: "carbo" }),
      pick: (d) => d.clientesDevedores,
      totalFrom: (d, meta) => meta ?? d.clientesDevedoresCount,
    });

    const url = String(apiFetchWithMeta.mock.calls[0][0]);
    expect(url).toContain("ordenar=atraso");
    expect(url).toContain("busca=carbo");
  });
});
