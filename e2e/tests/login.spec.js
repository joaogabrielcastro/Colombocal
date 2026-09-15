const { test, expect } = require("@playwright/test");
const { loginUi, apiAuthHeaders, ADMIN, DEMO, API } = require("./helpers");

test.describe("E2E login", () => {
  test("admin autentica e vê o dashboard do tenant", async ({ page }) => {
    await loginUi(page, ADMIN);
    await expect(page.getByTestId("dashboard-title")).toBeVisible();
    await expect(page.getByTestId("sidebar-desktop")).toContainText("Colombocal");
  });

  test("credenciais inválidas permanecem no login", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#login-email").fill("naoexiste@local");
    await page.locator("#login-password").fill("errada");
    await page.getByRole("button", { name: /Entrar|entrar/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("E2E multi-tenant", () => {
  test("demo autentica no tenant Demonstração e não vê clientes do tenant default", async ({
    page,
    request,
  }) => {
    await loginUi(page, DEMO);
    await expect(page.getByTestId("dashboard-title")).toBeVisible();
    await expect(page.getByTestId("sidebar-desktop")).toContainText("Demonstração");

    const adminHeaders = await apiAuthHeaders(request, ADMIN);
    const demoHeaders = await apiAuthHeaders(request, DEMO);

    const create = await request.post(`${API}/api/clientes`, {
      headers: adminHeaders,
      data: {
        razaoSocial: `AdminOnly ${Date.now()}`,
        cnpj: `${Date.now()}`.slice(-14).padStart(14, "9"),
        cidade: "Limeira",
        estado: "SP",
      },
    });
    expect(create.ok()).toBeTruthy();
    const adminCliente = await create.json();

    const demoGet = await request.get(`${API}/api/clientes/${adminCliente.id}`, {
      headers: demoHeaders,
    });
    expect(demoGet.status()).toBe(404);

    const demoListRes = await request.get(`${API}/api/clientes`, {
      headers: demoHeaders,
    });
    expect(demoListRes.ok()).toBeTruthy();
    const demoList = await demoListRes.json();
    const demoArr = Array.isArray(demoList) ? demoList : demoList.clientes || [];
    expect(demoArr.some((c) => c.id === adminCliente.id)).toBeFalsy();
  });
});
