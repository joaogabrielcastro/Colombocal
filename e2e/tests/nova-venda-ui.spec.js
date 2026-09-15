const { test, expect } = require("@playwright/test");
const { loginUi, apiAuthHeaders, ADMIN, DEMO, API } = require("./helpers");

test.describe("E2E nova venda pela UI", () => {
  test("cria venda no formulário e gera título a receber", async ({
    page,
    request,
  }) => {
    const headers = await apiAuthHeaders(request, ADMIN);
    const suffix = Date.now();
    const clienteRes = await request.post(`${API}/api/clientes`, {
      headers,
      data: {
        razaoSocial: `UI Cliente ${suffix}`,
        cnpj: `${suffix}`.slice(-14).padStart(14, "2"),
        cidade: "Limeira",
        estado: "SP",
      },
    });
    expect(clienteRes.ok()).toBeTruthy();
    const cliente = await clienteRes.json();

    const produtosRes = await request.get(`${API}/api/produtos`, { headers });
    const produtos = await produtosRes.json();
    expect(produtos.length).toBeGreaterThan(0);
    const produto = produtos[0];

    await loginUi(page, ADMIN);
    await page.goto("/vendas/nova");
    await expect(page.getByTestId("nova-venda-form")).toBeVisible();

    const clienteInput = page.getByTestId("nova-venda-cliente-input");
    await clienteInput.click();
    await clienteInput.fill(cliente.razaoSocial.slice(0, 12));
    await page.getByRole("option", { name: new RegExp(cliente.razaoSocial) }).click();

    const produtoInput = page.getByTestId("nova-venda-produto-input");
    await produtoInput.click();
    await produtoInput.fill(String(produto.nome || produto.codigo).slice(0, 8));
    await page.getByRole("option").first().click();

    await page.getByTestId("nova-venda-quantidade").fill("2");
    await expect(page.getByTestId("nova-venda-total")).not.toHaveText("R$ 0,00");

    await page.getByTestId("nova-venda-submit").click();
    await page.waitForURL(/\/vendas\/\d+/, { timeout: 45_000 });

    await expect(page.getByText(cliente.razaoSocial)).toBeVisible();
    await expect(page.getByText(/Títulos desta venda/i)).toBeVisible();

    const vendaId = Number(page.url().match(/\/vendas\/(\d+)/)?.[1]);
    expect(vendaId).toBeGreaterThan(0);

    const titulos = await request.get(
      `${API}/api/relatorios/titulos?somenteEmAberto=true&clienteId=${cliente.id}`,
      { headers },
    );
    expect(titulos.ok()).toBeTruthy();
    const body = await titulos.json();
    expect(body.resumo.valorEmAberto).toBeGreaterThan(0);
    expect(
      (body.titulos || []).some((t) => t.vendaId === vendaId || String(t.numero || "").includes("VENDA")),
    ).toBeTruthy();
  });
});

test.describe("E2E multi-tenant isolamento", () => {
  test("tenant B recebe 404 ao acessar cliente do tenant A", async ({ request }) => {
    const adminHeaders = await apiAuthHeaders(request, ADMIN);
    const demoHeaders = await apiAuthHeaders(request, DEMO);

    const create = await request.post(`${API}/api/clientes`, {
      headers: adminHeaders,
      data: {
        razaoSocial: `Iso A ${Date.now()}`,
        cnpj: `${Date.now()}`.slice(-14).padStart(14, "8"),
        cidade: "Limeira",
        estado: "SP",
      },
    });
    expect(create.ok()).toBeTruthy();
    const cliente = await create.json();

    const cross = await request.get(`${API}/api/clientes/${cliente.id}`, {
      headers: demoHeaders,
    });
    expect([403, 404]).toContain(cross.status());

    const vendasA = await request.get(`${API}/api/vendas?take=5`, {
      headers: adminHeaders,
    });
    const vendasB = await request.get(`${API}/api/vendas?take=5`, {
      headers: demoHeaders,
    });
    expect(vendasA.ok()).toBeTruthy();
    expect(vendasB.ok()).toBeTruthy();
  });
});
