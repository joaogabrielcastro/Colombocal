import { afterEach, describe, expect, it, vi } from "vitest";

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

import { reportApiError } from "./report-api-error";
import { ApiError } from "./api";

afterEach(() => {
  toastError.mockClear();
});

describe("reportApiError", () => {
  it("formata ApiError com status", () => {
    reportApiError(new ApiError("inválido", 400));
    const [, opts] = toastError.mock.calls[0];
    expect(opts.description).toBe("[400] inválido");
  });

  it("usa mensagem de Error comum", () => {
    reportApiError(new Error("falhou"));
    expect(toastError.mock.calls[0][1].description).toBe("falhou");
  });

  it("descreve erro desconhecido", () => {
    reportApiError("string qualquer");
    expect(toastError.mock.calls[0][1].description).toBe("Erro desconhecido");
  });

  it("inclui ação de retry quando fornecida", async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);
    reportApiError(new Error("x"), { title: "Custom", onRetry });
    const opts = toastError.mock.calls[0][1];
    expect(toastError.mock.calls[0][0]).toBe("Custom");
    expect(opts.action.label).toBe("Tentar novamente");
    opts.action.onClick();
    expect(onRetry).toHaveBeenCalled();
  });

  it("sem retry não adiciona ação", () => {
    reportApiError(new Error("x"));
    expect(toastError.mock.calls[0][1].action).toBeUndefined();
  });
});
