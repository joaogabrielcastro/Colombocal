import { describe, expect, it } from "vitest";
import {
  MAIN_NAV,
  REPORT_NAV,
  NAV_PERMISSION_OPTIONS,
  canAccessNavKey,
  filterMainNavForSidebar,
  advancedMainNavItems,
  filterReportsForSidebar,
  advancedReportItems,
  hasVisibleReports,
} from "./navigation";

describe("canAccessNavKey", () => {
  it("admin sempre pode", () => {
    expect(canAccessNavKey("auditoria", { isAdmin: true })).toBe(true);
  });
  it("sem permissões definidas libera tudo", () => {
    expect(canAccessNavKey("clientes", { navPermissions: null })).toBe(true);
    expect(canAccessNavKey("clientes", { navPermissions: [] })).toBe(true);
  });
  it("respeita lista de permissões", () => {
    expect(canAccessNavKey("clientes", { navPermissions: ["clientes"] })).toBe(true);
    expect(canAccessNavKey("auditoria", { navPermissions: ["clientes"] })).toBe(false);
  });
});

describe("filterMainNavForSidebar", () => {
  it("esconde itens avançados quando hideAdvanced", () => {
    const out = filterMainNavForSidebar(MAIN_NAV, true, { isAdmin: true });
    expect(out.some((i) => i.advancedOnly)).toBe(false);
  });
  it("esconde itens adminOnly para não-admin", () => {
    const out = filterMainNavForSidebar(MAIN_NAV, false, { isAdmin: false });
    expect(out.some((i) => i.adminOnly)).toBe(false);
  });
  it("mostra adminOnly para admin", () => {
    const out = filterMainNavForSidebar(MAIN_NAV, false, { isAdmin: true });
    expect(out.some((i) => i.adminOnly)).toBe(true);
  });
  it("filtra por navPermissions", () => {
    const out = filterMainNavForSidebar(MAIN_NAV, false, {
      isAdmin: false,
      navPermissions: ["clientes"],
    });
    expect(out.every((i) => i.navKey === "clientes")).toBe(true);
  });
});

describe("advancedMainNavItems / advancedReportItems", () => {
  it("retorna apenas itens avançados", () => {
    expect(advancedMainNavItems(MAIN_NAV).every((i) => i.advancedOnly)).toBe(true);
    expect(advancedReportItems(REPORT_NAV).every((i) => i.advancedOnly)).toBe(true);
  });
});

describe("filterReportsForSidebar / hasVisibleReports", () => {
  it("esconde relatórios avançados", () => {
    const out = filterReportsForSidebar(REPORT_NAV, true, { isAdmin: true });
    expect(out.some((i) => i.advancedOnly)).toBe(false);
  });
  it("hasVisibleReports true para admin", () => {
    expect(hasVisibleReports(false, { isAdmin: true })).toBe(true);
  });
  it("hasVisibleReports false quando nenhuma permissão de relatório", () => {
    expect(
      hasVisibleReports(false, { isAdmin: false, navPermissions: ["clientes"] }),
    ).toBe(false);
  });
});

describe("NAV_PERMISSION_OPTIONS", () => {
  it("inclui grupos esperados", () => {
    const grupos = new Set(NAV_PERMISSION_OPTIONS.map((o) => o.group));
    expect(grupos.has("Principal")).toBe(true);
    expect(grupos.has("Relatórios")).toBe(true);
  });
});
