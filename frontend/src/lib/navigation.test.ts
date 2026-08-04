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
  it("mostra menu clássico completo quando hideAdvanced=false", () => {
    const out = filterMainNavForSidebar(MAIN_NAV, false, { isAdmin: true });
    expect(out.map((i) => i.href)).toEqual([
      "/",
      "/clientes",
      "/produtos",
      "/vendas",
      "/financeiro",
      "/fretes",
      "/carregamento",
      "/motoristas",
      "/vendedores",
      "/auditoria",
      "/usuarios",
    ]);
  });
  it("rótulo Financeiro (não Recebimentos)", () => {
    expect(MAIN_NAV.find((i) => i.navKey === "financeiro")?.label).toBe("Financeiro");
  });
  it("esconde Fretes e Carregamento quando freteEnabled=false", () => {
    const out = filterMainNavForSidebar(MAIN_NAV, false, {
      isAdmin: true,
      freteEnabled: false,
    });
    expect(out.some((i) => i.navKey === "fretes")).toBe(false);
    expect(out.some((i) => i.navKey === "carregamento")).toBe(false);
  });
  it("Fretes e Carregamento ficam em Avançado quando hideAdvanced", () => {
    const main = filterMainNavForSidebar(MAIN_NAV, true, { isAdmin: true });
    expect(main.some((i) => i.navKey === "fretes")).toBe(false);
    expect(main.some((i) => i.navKey === "carregamento")).toBe(false);
    expect(advancedMainNavItems(MAIN_NAV).some((i) => i.navKey === "fretes")).toBe(true);
    expect(advancedMainNavItems(MAIN_NAV).some((i) => i.navKey === "carregamento")).toBe(true);
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
  it("retorna apenas itens avançados", () => {
    expect(advancedMainNavItems(MAIN_NAV).every((i) => i.advancedOnly)).toBe(true);
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
    expect(grupos.has("Avançado")).toBe(true);
    expect(grupos.has("Sistema")).toBe(true);
  });
});
