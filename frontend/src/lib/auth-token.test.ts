import { afterEach, describe, expect, it } from "vitest";
import {
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  getAuthTenantId,
} from "./auth-token";
import {
  clearTenantFeaturesCache,
  getTenantFeaturesCache,
  setTenantFeaturesCache,
} from "./tenant-features-cache";

afterEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  clearTenantFeaturesCache();
});

describe("auth-token", () => {
  it("retorna null quando não há token", () => {
    expect(getAuthToken()).toBeNull();
  });

  it("armazena, lê e limpa o token", () => {
    setAuthToken("abc123");
    expect(getAuthToken()).toBe("abc123");
    clearAuthToken();
    expect(getAuthToken()).toBeNull();
  });

  it("limpa cache de features ao trocar sessão", () => {
    setTenantFeaturesCache({ clienteCpf: true, frete: false }, 1);
    setAuthToken("novo");
    expect(getTenantFeaturesCache(1)).toBeNull();
  });

  it("lê tid do JWT para isolamento de cache", () => {
    const payload = btoa(JSON.stringify({ tid: 7, sub: 1 }));
    setAuthToken(`hdr.${payload}.sig`);
    expect(getAuthTenantId()).toBe(7);
  });
});
