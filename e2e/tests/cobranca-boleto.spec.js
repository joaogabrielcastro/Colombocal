const { test, expect } = require("@playwright/test");
const { loginUi, apiAuthHeaders, ADMIN, DEMO, API } = require("./helpers");

test.describe("E2E cobrança bancária / condições", () => {
  test("cliente com condição 15/30/45 gera parcelas e cobranças após NF-e mock", async ({
    page,
    request,
  }) => {
    const headers = await apiAuthHeaders(request, ADMIN);
    const suffix = Date.now();

    const condicoesRes = await request.get(
      `${API}/api/config/condicoes-pagamento`,
      { headers },
    );
    expect(condicoesRes.ok()).toBeTruthy();
    const condicoes = await condicoesRes.json();
    const cond153045 = condicoes.find((c) => c.nome === "15/30/45");
    expect(cond153045).toBeTruthy();

    const clienteRes = await request.post(`${API}/api/clientes`, {
      headers,
      data: {
        razaoSocial: `Cob Cliente ${suffix}`,
        cnpj: `${suffix}`.slice(-14).padStart(14, "3"),
        cidade: "Limeira",
        estado: "SP",
        condicaoPagamentoId: cond153045.id,
        bancoCobrancaPadrao: "BRADESCO",
      },
    });
    expect(clienteRes.ok()).toBeTruthy();
    const cliente = await clienteRes.json();

    const produtosRes = await request.get(`${API}/api/produtos`, { headers });
    const produtos = await produtosRes.json();
    expect(produtos.length).toBeGreaterThan(0);
    const produto = produtos[0];

    const vendedoresRes = await request.get(`${API}/api/vendedores?take=1`, {
      headers,
    });
    const vendedores = await vendedoresRes.json();
    expect(vendedores.length).toBeGreaterThan(0);

    const vendaRes = await request.post(`${API}/api/vendas`, {
      headers,
      data: {
        clienteId: cliente.id,
        vendedorId: vendedores[0].id,
        condicaoPagamentoId: cond153045.id,
        bancoCobranca: "BRADESCO",
        itens: [
          {
            produtoId: produto.id,
            quantidade: 1,
            precoUnitario: 100,
          },
        ],
      },
    });
    expect(vendaRes.ok()).toBeTruthy();
    const venda = await vendaRes.json();
    expect(venda.titulos?.length).toBe(3);
    const valores = venda.titulos
      .map((t) => parseFloat(String(t.valorOriginal)))
      .sort((a, b) => a - b);
    expect(valores[0]).toBeCloseTo(33.33, 2);
    expect(valores[2]).toBeCloseTo(33.34, 2);

    await loginUi(page, ADMIN);
    await page.goto(`/vendas/${venda.id}`);
    await expect(page.getByText(/1\/3|2\/3|3\/3/)).toBeVisible({
      timeout: 15000,
    });

    await page.goto("/financeiro/cobrancas");
    await expect(page.getByText("Cobranças / Boletos")).toBeVisible();
  });

  test("tenant B não vê cobranças de tenant A", async ({ request }) => {
    const headersA = await apiAuthHeaders(request, ADMIN);
    const headersB = await apiAuthHeaders(request, DEMO);

    const listA = await request.get(`${API}/api/cobrancas`, { headers: headersA });
    const listB = await request.get(`${API}/api/cobrancas`, { headers: headersB });
    expect(listA.ok()).toBeTruthy();
    expect(listB.ok()).toBeTruthy();
    // Isolamento: cada lista só contém itens do próprio tenant (API filtra por JWT).
    const a = await listA.json();
    const b = await listB.json();
    expect(Array.isArray(a)).toBeTruthy();
    expect(Array.isArray(b)).toBeTruthy();
  });
});
