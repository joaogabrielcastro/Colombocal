import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, apiFetch, apiFetchWithMeta, ApiError, API_BASE } from "./api";

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    headers: {
      get: (name: string) => init.headers?.[name.toLowerCase()] ?? null,
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("apiFetch", () => {
  it("faz GET e devolve JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await apiFetch<{ ok: number }>("/x");
    expect(res).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/x`, expect.any(Object));
  });

  it("inclui Authorization quando há token", async () => {
    window.localStorage.setItem("colombocal_auth_token", "tkn");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/y");
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe("Bearer tkn");
  });

  it("lança ApiError em 4xx definitivo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: "inválido" }, { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/z")).rejects.toMatchObject({
      status: 400,
      message: "inválido",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("repete em status transitório e depois sucede", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "indisponível" }, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    const promise = apiFetch<{ ok: boolean }>("/retry", { retries: 1 });
    await vi.runAllTimersAsync();
    const res = await promise;
    vi.useRealTimers();

    expect(res).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("redireciona no 401 (handleUnauthorized limpa token)", async () => {
    window.localStorage.setItem("colombocal_auth_token", "tkn");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: "nao auth" }, { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { pathname: "/vendas", search: "", assign: assignMock },
      writable: true,
    });

    await expect(apiFetch("/prot")).rejects.toBeInstanceOf(ApiError);
    expect(window.localStorage.getItem("colombocal_auth_token")).toBeNull();
    expect(assignMock).toHaveBeenCalled();
  });

  it("usa mensagem padrão quando corpo sem error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse("", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch("/e")).rejects.toMatchObject({ message: "Erro 500" });
  });

  it("usa corpo string como mensagem de erro", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse("falha em texto", { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch("/s")).rejects.toMatchObject({ message: "falha em texto" });
  });

  it("repete em erro de rede (fetch rejeita) e depois sucede", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    const promise = apiFetch<{ ok: boolean }>("/net", { retries: 1 });
    await vi.runAllTimersAsync();
    const res = await promise;
    vi.useRealTimers();
    expect(res).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("propaga erro de rede após esgotar retentativas", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("network"));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    const promise = apiFetch("/net2", { retries: 0 });
    const assertion = expect(promise).rejects.toThrow("network");
    await vi.runAllTimersAsync();
    await assertion;
    vi.useRealTimers();
  });
});

describe("apiFetchWithMeta", () => {
  it("extrai metadados dos headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse([{ id: 1 }], {
        headers: {
          "x-total-count": "42",
          "x-page-size": "10",
          "x-page-offset": "0",
          "x-sum-valor-total": "1234.5",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { data, meta } = await apiFetchWithMeta<{ id: number }[]>("/m");
    expect(data).toEqual([{ id: 1 }]);
    expect(meta).toEqual({
      totalCount: 42,
      pageSize: 10,
      pageOffset: 0,
      sumValorTotal: 1234.5,
    });
  });

  it("headers ausentes viram null", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    const { meta } = await apiFetchWithMeta("/m2");
    expect(meta).toEqual({
      totalCount: null,
      pageSize: null,
      pageOffset: null,
      sumValorTotal: null,
    });
  });

  it("lança ApiError em erro definitivo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: "ops" }, { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetchWithMeta("/m3")).rejects.toBeInstanceOf(ApiError);
  });

  it("repete em status transitório e depois sucede", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "x" }, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse([{ id: 9 }]));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    const promise = apiFetchWithMeta<{ id: number }[]>("/mr", { retries: 1 });
    await vi.runAllTimersAsync();
    const { data } = await promise;
    vi.useRealTimers();
    expect(data).toEqual([{ id: 9 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("dispara handleUnauthorized em 401", async () => {
    window.localStorage.setItem("colombocal_auth_token", "tkn");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: "no" }, { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      value: { pathname: "/cheques", search: "?x=1", assign },
      writable: true,
    });
    await expect(apiFetchWithMeta("/mp")).rejects.toBeInstanceOf(ApiError);
    expect(assign).toHaveBeenCalled();
  });

  it("propaga erro de rede após retentativas", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("net"));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    const promise = apiFetchWithMeta("/mn", { retries: 0 });
    const assertion = expect(promise).rejects.toThrow("net");
    await vi.runAllTimersAsync();
    await assertion;
    vi.useRealTimers();
  });
});

describe("api helpers", () => {
  it("post/put/patch/delete usam o método correto", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: 1 }));
    vi.stubGlobal("fetch", fetchMock);

    await api.post("/a", { x: 1 });
    await api.put("/b", { y: 2 });
    await api.patch("/c", { z: 3 });
    await api.delete("/d");
    await api.get("/e");

    const methods = fetchMock.mock.calls.map((c) => c[1].method);
    expect(methods).toEqual(["POST", "PUT", "PATCH", "DELETE", "GET"]);
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ x: 1 }));
  });
});
