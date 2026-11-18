import { beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
}));

let token: string | null = "tok-a";
vi.mock("@/lib/auth-token", () => ({
  AUTH_SESSION_EVENT: "auth-session-test",
  getAuthToken: () => token,
}));

beforeEach(() => {
  apiGet.mockReset();
  vi.resetModules();
  token = "tok-a";
});

const me = { user: { role: "member", navPermissions: ["vendas"] }, tenant: { name: "T", slug: "t" } };

describe("fetchSession", () => {
  it("reaproveita a resposta em cache para o mesmo token", async () => {
    apiGet.mockResolvedValue(me);
    const { fetchSession } = await import("./session");
    await fetchSession();
    await fetchSession();
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it("deduplica requisições simultâneas", async () => {
    apiGet.mockResolvedValue(me);
    const { fetchSession } = await import("./session");
    await Promise.all([fetchSession(), fetchSession(), fetchSession()]);
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it("busca de novo quando o token muda (outra sessão)", async () => {
    apiGet.mockResolvedValue(me);
    const { fetchSession, getCachedSession } = await import("./session");
    await fetchSession();
    token = "tok-b";
    expect(getCachedSession()).toBeNull();
    await fetchSession();
    expect(apiGet).toHaveBeenCalledTimes(2);
  });

  it("invalida o cache no evento de sessão (login/logout)", async () => {
    apiGet.mockResolvedValue(me);
    const { fetchSession, getCachedSession } = await import("./session");
    await fetchSession();
    expect(getCachedSession()).not.toBeNull();
    window.dispatchEvent(new Event("auth-session-test"));
    expect(getCachedSession()).toBeNull();
  });

  it("propaga erro e não grava cache", async () => {
    apiGet.mockRejectedValue(new Error("offline"));
    const { fetchSession, getCachedSession } = await import("./session");
    await expect(fetchSession()).rejects.toThrow("offline");
    expect(getCachedSession()).toBeNull();
  });

  it("force ignora o cache", async () => {
    apiGet.mockResolvedValue(me);
    const { fetchSession } = await import("./session");
    await fetchSession();
    await fetchSession({ force: true });
    expect(apiGet).toHaveBeenCalledTimes(2);
  });
});
