import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const waitForAsyncExportDownloadUrl = vi.fn();
vi.mock("@/lib/async-export", () => ({
  waitForAsyncExportDownloadUrl: (...args: unknown[]) =>
    waitForAsyncExportDownloadUrl(...args),
}));
vi.mock("@/lib/api", () => ({ default: {} }));

import { useExportCsvAsync } from "./useExportCsvAsync";

beforeEach(() => {
  waitForAsyncExportDownloadUrl.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useExportCsvAsync", () => {
  it("abre a URL de download em sucesso", async () => {
    waitForAsyncExportDownloadUrl.mockResolvedValue("/download/1");
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const { result } = renderHook(() => useExportCsvAsync({ startPath: "/start" }));
    await act(async () => {
      await result.current.exportCsv({ a: 1 });
    });

    expect(openSpy).toHaveBeenCalledWith("/download/1", "_blank");
    expect(result.current.isExporting).toBe(false);
    expect(result.current.error).toBe("");
  });

  it("define erro e chama fallback em falha", async () => {
    waitForAsyncExportDownloadUrl.mockRejectedValue(new Error("timeout"));
    const fallback = vi.fn();

    const { result } = renderHook(() =>
      useExportCsvAsync({ startPath: "/start", fallback }),
    );
    await act(async () => {
      await result.current.exportCsv({});
    });

    await waitFor(() => expect(result.current.error).toBe("timeout"));
    expect(fallback).toHaveBeenCalled();
  });

  it("setError limpa a mensagem", async () => {
    waitForAsyncExportDownloadUrl.mockRejectedValue(new Error("x"));
    const { result } = renderHook(() => useExportCsvAsync({ startPath: "/s" }));
    await act(async () => {
      await result.current.exportCsv({});
    });
    act(() => result.current.setError(""));
    expect(result.current.error).toBe("");
  });
});
