import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
}));

beforeEach(() => {
  apiGet.mockReset();
  vi.resetModules();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchTenantFeatures", () => {
  it("mapeia features vindas da API", async () => {
    apiGet.mockResolvedValue({ features: { clienteCpf: true, frete: false } });
    const { fetchTenantFeatures, clearTenantFeaturesCache } = await import("./useTenantFeatures");
    clearTenantFeaturesCache();
    const f = await fetchTenantFeatures(true);
    expect(f).toEqual({ clienteCpf: true, frete: false, fretePagoDefault: false });
  });

  it("frete false quando ausente (não assume Colombocal)", async () => {
    apiGet.mockResolvedValue({ features: {} });
    const { fetchTenantFeatures, clearTenantFeaturesCache } = await import("./useTenantFeatures");
    clearTenantFeaturesCache();
    const f = await fetchTenantFeatures(true);
    expect(f).toEqual({ clienteCpf: false, frete: false, fretePagoDefault: false });
  });

  it("usa defaults quando a API falha", async () => {
    apiGet.mockRejectedValue(new Error("500"));
    const { fetchTenantFeatures, clearTenantFeaturesCache } = await import("./useTenantFeatures");
    clearTenantFeaturesCache();
    const f = await fetchTenantFeatures(true);
    expect(f).toEqual({ clienteCpf: false, frete: false, fretePagoDefault: false });
  });

  it("reaproveita cache em chamadas subsequentes", async () => {
    const payload = btoa(JSON.stringify({ tid: 1, sub: 1 }));
    localStorage.setItem("colombocal_auth_token", `hdr.${payload}.sig`);
    apiGet.mockResolvedValue({
      features: { clienteCpf: true, frete: true, fretePagoDefault: true },
      user: { tenantId: 1 },
    });
    const { fetchTenantFeatures, clearTenantFeaturesCache } = await import("./useTenantFeatures");
    clearTenantFeaturesCache();
    await fetchTenantFeatures(true);
    await fetchTenantFeatures();
    expect(apiGet).toHaveBeenCalledTimes(1);
  });
});

describe("useTenantFeatures", () => {
  it("expõe features após carregamento", async () => {
    apiGet.mockResolvedValue({
      features: { clienteCpf: false, frete: true, fretePagoDefault: true },
    });
    const { useTenantFeatures, clearTenantFeaturesCache } = await import("./useTenantFeatures");
    clearTenantFeaturesCache();
    const { result } = renderHook(() => useTenantFeatures());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.freteEnabled).toBe(true);
    expect(result.current.clienteCpfEnabled).toBe(false);
    expect(result.current.fretePagoDefault).toBe(true);
  });
});
