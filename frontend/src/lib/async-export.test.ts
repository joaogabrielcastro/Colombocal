import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForAsyncExportDownloadUrl } from "./async-export";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function makeApi(statuses: Array<{ status: string; downloadUrl?: string | null; error?: string }>) {
  let i = 0;
  return {
    post: vi.fn().mockResolvedValue({ jobId: "job-1", status: "pending" }),
    get: vi.fn().mockImplementation(async () => statuses[Math.min(i++, statuses.length - 1)]),
  };
}

describe("waitForAsyncExportDownloadUrl", () => {
  it("retorna a URL quando o job completa", async () => {
    const api = makeApi([
      { status: "running" },
      { status: "completed", downloadUrl: "/download/1" },
    ]);
    vi.useFakeTimers();
    const promise = waitForAsyncExportDownloadUrl(api, "/start", { a: 1 }, { pollIntervalMs: 10 });
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe("/download/1");
    expect(api.post).toHaveBeenCalledWith("/start", { a: 1 });
  });

  it("lança erro quando o job falha", async () => {
    const api = makeApi([{ status: "failed", error: "explodiu" }]);
    vi.useFakeTimers();
    const promise = waitForAsyncExportDownloadUrl(api, "/start", {}, { pollIntervalMs: 10 });
    const assertion = expect(promise).rejects.toThrow("explodiu");
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("lança timeout ao exceder tentativas", async () => {
    const api = makeApi([{ status: "running" }]);
    vi.useFakeTimers();
    const promise = waitForAsyncExportDownloadUrl(api, "/start", {}, {
      pollIntervalMs: 10,
      maxAttempts: 3,
    });
    const assertion = expect(promise).rejects.toThrow(/demorou mais/);
    await vi.runAllTimersAsync();
    await assertion;
    expect(api.get).toHaveBeenCalledTimes(3);
  });
});
