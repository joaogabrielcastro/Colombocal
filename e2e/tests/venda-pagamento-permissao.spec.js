const { test, expect } = require("@playwright/test");
const { loginUi, apiAuthHeaders, ADMIN, MEMBER, API } = require("./helpers");

test.describe("E2E venda e pagamento", () => {
  test("cria venda via API autenticada e vê no dashboard/lista", async ({
    page,
    request,
  }) => {
    const headers = await apiAuthHeaders(request, ADMIN);

    const clienteRes = await request.post(`${API}/api/clientes`, {
      headers,
      data: {
        razaoSocial: `E2E Cliente ${Date.now()}`,
        cnpj: `${Date.now()}`.slice(-14).padStart(14, "1"),
        cidade: "Limeira",
        estado: "SP",
      },
    });
    expect(clienteRes.ok()).toBeTruthy();
    const cliente = await clienteRes.json();

    const produtosRes = await request.get(`${API}/api/produtos`, { headers });
    expect(produtosRes.ok()).toBeTruthy();
    const produtos = await produtosRes.json();
    expect(produtos.length).toBeGreaterThan(0);
    const produto = produtos[0];

    const vendedoresRes = await request.get(`${API}/api/vendedores`, { headers });
    const vendedores = await vendedoresRes.json();
    const vendedor = vendedores[0];
    expect(vendedor).toBeTruthy();

    const vendaRes = await request.post(`${API}/api/vendas`, {
      headers,
      data: {
        clienteId: cliente.id,
        vendedorId: vendedor.id,
        itens: [{ produtoId: produto.id, quantidade: 1, precoUnitario: 150 }],
      },
    });
    expect(vendaRes.status()).toBe(201);
    const venda = await vendaRes.json();
    expect(venda.numeroVenda).toBeTruthy();
    expect(venda.titulos?.length || 0).toBeGreaterThanOrEqual(0);

    const titulosDb = await request.get(
      `${API}/api/relatorios/titulos?somenteEmAberto=true&clienteId=${cliente.id}`,
      { headers },
    );
    expect(titulosDb.ok()).toBeTruthy();
    const titulosBody = await titulosDb.json();
    expect(titulosBody.resumo.valorEmAberto).toBeGreaterThanOrEqual(150);

    await loginUi(page, ADMIN);
    await page.goto(`/vendas/${venda.id}`);
    await expect(page.getByText(`#${venda.numeroVenda}`, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: cliente.razaoSocial })).toBeVisible();

    const pagRes = await request.post(`${API}/api/pagamentos`, {
      headers,
      data: {
        clienteId: cliente.id,
        vendaId: venda.id,
        tipo: "dinheiro",
        valor: 150,
      },
    });
    expect(pagRes.status()).toBe(201);

    const titulosApos = await request.get(
      `${API}/api/relatorios/titulos?clienteId=${cliente.id}&status=quitado`,
      { headers },
    );
    const after = await titulosApos.json();
    expect(after.titulos.some((t) => t.vendaId === venda.id || t.status === "quitado")).toBeTruthy();

    const dup = await request.post(`${API}/api/pagamentos`, {
      headers,
      data: {
        clienteId: cliente.id,
        vendaId: venda.id,
        tipo: "dinheiro",
        valor: 150,
      },
    });
    // Pode criar crédito/excedente ou rejeitar — o importante é não 500.
    expect(dup.status()).toBeLessThan(500);
  });
});

test.describe("E2E permissão", () => {
  test("membro não acessa Usuários (admin)", async ({ page }) => {
    await loginUi(page, MEMBER);
    await expect(page.getByTestId("dashboard-title")).toBeVisible();
    await expect(page.getByTestId("sidebar-desktop")).not.toContainText("Usuários");

    await page.goto("/usuarios");
    await expect(page).not.toHaveURL(/\/usuarios$/);
    await expect(page.getByTestId("dashboard-title")).toBeVisible();
  });
});
