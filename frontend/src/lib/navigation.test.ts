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
  it("esconde itens de configuração do menu principal", () => {
    const out = filterMainNavForSidebar(MAIN_NAV, false, { isAdmin: true });
    expect(out.some((i) => i.configOnly)).toBe(false);
    expect(out.map((i) => i.href)).toEqual(["/", "/clientes", "/vendas", "/financeiro"]);
  });
  it("esconde itens adminOnly para não-admin", () => {
    const out = filterMainNavForSidebar(MAIN_NAV, false, { isAdmin: false });
    expect(out.some((i) => i.adminOnly)).toBe(false);
  });
  it("filtra por navPermissions com alias cheques → financeiro", () => {
    const out = filterMainNavForSidebar(MAIN_NAV, false, {
      isAdmin: false,
      navPermissions: ["cheques"],
    });
    expect(out.some((i) => i.navKey === "financeiro")).toBe(true);
  });
});

describe("advancedMainNavItems / advancedReportItems", () => {
  it("retorna apenas itens avançados (não configuração)", () => {
    expect(advancedMainNavItems(MAIN_NAV).every((i) => i.advancedOnly && !i.configOnly)).toBe(
      true,
    );
    const advancedReports = advancedReportItems(REPORT_NAV);
    expect(advancedReports.every((i) => i.advancedOnly)).toBe(true);
  });
});

describe("REPORT_NAV Contas a receber unificado", () => {
  it("tem uma entrada de contas a receber e nenhuma de títulos separada", () => {
    expect(REPORT_NAV.filter((i) => i.navKey === "rel_financeiro")).toHaveLength(1);
    expect(REPORT_NAV.some((i) => i.href.includes("/titulos"))).toBe(false);
  });
});

describe("canAccessNavKey alias rel_titulos", () => {
  it("rel_titulos legado libera Contas a receber", () => {
    expect(
      canAccessNavKey("rel_financeiro", {
        isAdmin: false,
        navPermissions: ["rel_titulos"],
      }),
    ).toBe(true);
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
    expect(grupos.has("Configurações")).toBe(true);
  });
});
