const { test, expect } = require("@playwright/test");
const { loginUi, apiAuthHeaders, ADMIN, API } = require("./helpers");

test.describe("E2E Fiscal transporte CT-e / MDF-e / CIOT", () => {
  test("login → CT-e / MDF-e / CIOT listar", async ({ page, request }) => {
    const headers = await apiAuthHeaders(request, ADMIN);

    const feat = await request.put(`${API}/api/config/tenant-features`, {
      headers,
      data: { nfe: true, cte: true, mdfe: true, ciot: true },
    });
    expect(feat.ok()).toBeTruthy();

    await request.put(`${API}/api/config/emitente-fiscal`, {
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
        rntrc: "12345678",
        serieCte: 1,
        serieMdfe: 1,
      },
    });

    await loginUi(page, ADMIN);
    const sidebar = page.getByTestId("sidebar-desktop");
    await expect(sidebar.getByText("Fiscal")).toBeVisible({ timeout: 20_000 });
    await sidebar.getByText("Fiscal").click();

    await sidebar.getByRole("link", { name: "CT-e" }).click();
    await expect(page).toHaveURL(/\/fiscal\/cte/);
    await expect(page.getByRole("heading", { name: /CT-e/i })).toBeVisible();

    await sidebar.getByRole("link", { name: "MDF-e" }).click();
    await expect(page).toHaveURL(/\/fiscal\/mdfe/);
    await expect(page.getByRole("heading", { name: /MDF-e/i })).toBeVisible();

    await sidebar.getByRole("link", { name: "CIOT" }).click();
    await expect(page).toHaveURL(/\/fiscal\/ciot/);
    await expect(page.getByRole("heading", { name: /CIOT/i })).toBeVisible();
  });

  test("isolamento API: CT-e de outro tenant → 404", async ({ request }) => {
    const headers = await apiAuthHeaders(request, ADMIN);
    await request.put(`${API}/api/config/tenant-features`, {
      headers,
      data: { cte: true },
    });
    const missing = await request.get(`${API}/api/fiscal/cte/999999001`, {
      headers,
    });
    expect(missing.status()).toBe(404);
  });
});
