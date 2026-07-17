import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
}));

beforeEach(() => {
  apiGet.mockReset();
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchTenantFeatures", () => {
  it("mapeia features vindas da API", async () => {
    apiGet.mockResolvedValue({ features: { clienteCpf: true, frete: false } });
    const { fetchTenantFeatures, clearTenantFeaturesCache } = await import("./useTenantFeatures");
    clearTenantFeaturesCache();
    const f = await fetchTenantFeatures();
    expect(f).toEqual({ clienteCpf: true, frete: false });
  });

  it("frete assume true quando ausente", async () => {
    apiGet.mockResolvedValue({ features: {} });
    const { fetchTenantFeatures, clearTenantFeaturesCache } = await import("./useTenantFeatures");
    clearTenantFeaturesCache();
    const f = await fetchTenantFeatures();
    expect(f).toEqual({ clienteCpf: false, frete: true });
  });

  it("usa defaults quando a API falha", async () => {
    apiGet.mockRejectedValue(new Error("500"));
    const { fetchTenantFeatures, clearTenantFeaturesCache } = await import("./useTenantFeatures");
    clearTenantFeaturesCache();
    const f = await fetchTenantFeatures();
    expect(f).toEqual({ clienteCpf: false, frete: true });
  });

  it("reaproveita cache em chamadas subsequentes", async () => {
    apiGet.mockResolvedValue({ features: { clienteCpf: true, frete: true } });
    const { fetchTenantFeatures, clearTenantFeaturesCache } = await import("./useTenantFeatures");
    clearTenantFeaturesCache();
    await fetchTenantFeatures();
    await fetchTenantFeatures();
    expect(apiGet).toHaveBeenCalledTimes(1);
  });
});

describe("useTenantFeatures", () => {
  it("expõe features após carregamento", async () => {
    apiGet.mockResolvedValue({ features: { clienteCpf: false, frete: true } });
    const { useTenantFeatures, clearTenantFeaturesCache } = await import("./useTenantFeatures");
    clearTenantFeaturesCache();
    const { result } = renderHook(() => useTenantFeatures());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.freteEnabled).toBe(true);
    expect(result.current.clienteCpfEnabled).toBe(false);
  });
});
