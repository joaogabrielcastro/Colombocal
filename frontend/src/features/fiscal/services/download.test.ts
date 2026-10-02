import { afterEach, describe, expect, it, vi } from "vitest";
import api from "@/lib/api";
import { downloadFiscalFile } from "./download";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("downloadFiscalFile", () => {
  it("usa o cliente autenticado, respeita filename e revoga a URL", async () => {
    vi.useFakeTimers();
    const blob = new Blob(["xml"], { type: "application/xml" });
    vi.spyOn(api, "getBlob").mockResolvedValue({
      blob,
      contentType: "application/xml",
      filename: "cte.xml",
    });
    const createObjectURL = vi.fn(() => "blob:fiscal");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi.fn();
    vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      rel: "",
      target: "",
      download: "",
      click,
    } as unknown as HTMLAnchorElement);

    await downloadFiscalFile("/fiscal/cte/12/xml");

    expect(api.getBlob).toHaveBeenCalledWith("/fiscal/cte/12/xml");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
    await vi.runAllTimersAsync();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fiscal");
  });
});
