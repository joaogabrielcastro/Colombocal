import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ClientShell from "./ClientShell";

let pathname = "/esqueci-senha";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const apiGet = vi.fn();
vi.mock("@/lib/api", () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
  ApiError: class ApiError extends Error {
    status = 0;
  },
}));

vi.mock("@/lib/features", () => ({ REQUIRE_LOGIN: true }));

describe("ClientShell em telas públicas", () => {
  beforeEach(() => {
    apiGet.mockReset();
    localStorage.clear();
  });

  it.each(["/esqueci-senha", "/redefinir-senha", "/login", "/cadastro"])(
    "%s renderiza sem consultar a API (sem token não pode haver 401 → login)",
    async (path) => {
      pathname = path;
      render(
        <ClientShell>
          <p>conteúdo público</p>
        </ClientShell>,
      );
      expect(await screen.findByText("conteúdo público")).toBeInTheDocument();
      expect(apiGet).not.toHaveBeenCalled();
    },
  );
});
