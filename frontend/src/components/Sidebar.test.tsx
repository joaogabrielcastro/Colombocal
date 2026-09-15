import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import Sidebar from "./Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/hooks/useTenantFeatures", () => ({
  useTenantFeatures: () => ({ freteEnabled: false }),
}));

vi.mock("@/lib/auth-token", () => ({
  AUTH_SESSION_EVENT: "auth-session",
  clearAuthToken: vi.fn(),
  getAuthToken: () => "token",
}));

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(async () => ({
      user: { role: "admin", navPermissions: null },
      tenant: { name: "Colombocal", slug: "default" },
    })),
  },
}));

describe("Sidebar mobile drawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fora da tela quando fechado e overlay ao abrir", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Sidebar mobileOpen={false} onCloseMobile={onClose} />,
    );

    const mobile = await screen.findByTestId("sidebar-mobile");
    expect(mobile.className).toContain("-translate-x-full");
    expect(screen.queryByTestId("mobile-nav-overlay")).toBeNull();

    rerender(<Sidebar mobileOpen onCloseMobile={onClose} />);
    expect(await screen.findByTestId("mobile-nav-overlay")).toBeInTheDocument();
    expect((await screen.findByTestId("sidebar-mobile")).className).toContain(
      "translate-x-0",
    );
  });

  it("fecha ao clicar no overlay e ao pressionar Escape", async () => {
    const onClose = vi.fn();
    render(<Sidebar mobileOpen onCloseMobile={onClose} />);

    fireEvent.click(await screen.findByTestId("mobile-nav-overlay"));
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("fecha ao clicar em um link de navegação", async () => {
    const onClose = vi.fn();
    render(<Sidebar mobileOpen onCloseMobile={onClose} />);

    const mobile = await screen.findByTestId("sidebar-mobile");
    const link = await within(mobile).findByRole("link", { name: /Clientes/i });
    fireEvent.click(link);
    expect(onClose).toHaveBeenCalled();
  });
});
