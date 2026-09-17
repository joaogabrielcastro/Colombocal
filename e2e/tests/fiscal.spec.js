const { test, expect } = require("@playwright/test");
const { loginUi, apiAuthHeaders, ADMIN, API } = require("./helpers");

/**
 * Fluxo mínimo Fiscal (Fase 5.1).
 * Habilita NF-e via API (seed deixa desligado por padrão) e valida navegação.
 */
test.describe("E2E Fiscal", () => {
  test("login → notas → detalhe → fechamento", async ({ page, request }) => {
    const headers = await apiAuthHeaders(request, ADMIN);

    const feat = await request.put(`${API}/api/config/tenant-features`, {
      headers,
      data: { nfe: true },
    });
    expect(feat.ok()).toBeTruthy();

    const emitente = await request.put(`${API}/api/config/emitente-fiscal`, {
      headers,
      data: {
        cnpj: "11222333000181",
        inscricaoEstadual: "123456789",
        razaoSocial: "Colombocal E2E LTDA",
        nomeFantasia: "Colombocal",
        crt: 1,
        logradouro: "Rua da Cal",
        numero: "10",
        bairro: "Centro",
        municipio: "Limeira",
        codigoMunicipio: "3526902",
        uf: "SP",
        cep: "13480000",
        ambiente: "homologacao",
        modalidadeFrete: 9,
        serieNfe: 1,
      },
    });
    expect(emitente.ok()).toBeTruthy();

    await loginUi(page, ADMIN);

    // Menu Fiscal (feature nfe)
    const sidebar = page.getByTestId("sidebar-desktop");
    await expect(sidebar.getByText("Fiscal")).toBeVisible({ timeout: 20_000 });
    await sidebar.getByText("Fiscal").click();
    await sidebar.getByRole("link", { name: "NF-e" }).click();
    await expect(page).toHaveURL(/\/fiscal\/notas/);
    await expect(page.getByRole("heading", { name: /^NF-e$|Notas fiscais/i })).toBeVisible();
    await expect(page.getByText(/AMBIENTE DE HOMOLOGAÇÃO/i)).toBeVisible();
    await expect(page.getByText(/Total de NF-e/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Consultar/i })).toBeVisible();

    await sidebar.getByRole("link", { name: "Fechamento fiscal" }).click();
    await expect(page).toHaveURL(/\/fiscal\/fechamento/);
    await expect(page.getByRole("heading", { name: /Fechamento fiscal/i })).toBeVisible();
    await expect(page.getByText(/AMBIENTE DE HOMOLOGAÇÃO/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Consultar|Gerar fechamento/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Exportar Excel/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /pacote contábil/i })).toBeVisible();
    await expect(
      page.getByText(/conferência e envio à contabilidade/i).first(),
    ).toBeVisible();
  });
});
