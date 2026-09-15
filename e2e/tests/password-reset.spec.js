const { test, expect } = require("@playwright/test");
const { loginUi, apiLogin, ADMIN, API } = require("./helpers");

async function clearOutbox(request) {
  const res = await request.post(`${API}/api/auth/__test__/email-outbox/clear`);
  expect(res.ok()).toBeTruthy();
}

async function waitForResetMail(request, email, { timeoutMs = 15_000 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await request.get(`${API}/api/auth/__test__/email-outbox`);
    expect(res.ok()).toBeTruthy();
    const { items } = await res.json();
    const mail = (items || []).find(
      (m) => String(m.to).toLowerCase() === String(email).toLowerCase(),
    );
    if (mail?.text) {
      const m = String(mail.text).match(/token=([^\s&]+)/);
      if (m) return decodeURIComponent(m[1]);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("e-mail de reset não apareceu no outbox de teste");
}

test.describe("E2E password reset", () => {
  test("fluxo UI: esqueci senha → outbox → redefinir → login; JWT antigo inválido", async ({
    page,
    request,
  }) => {
    await clearOutbox(request);

    const loginBefore = await apiLogin(request, ADMIN);
    const oldToken = loginBefore.token;

    await page.goto("/esqueci-senha");
    await page.getByTestId("forgot-password-email").fill(ADMIN.email);
    await page.getByTestId("forgot-password-submit").click();
    await expect(page.getByTestId("forgot-password-success")).toBeVisible();

    const rawToken = await waitForResetMail(request, ADMIN.email);
    const newPassword = `Nova${Date.now()}!a`;

    await page.goto(`/redefinir-senha?token=${encodeURIComponent(rawToken)}`);
    await page.getByTestId("reset-password-input").fill(newPassword);
    await page.getByTestId("reset-password-confirm").fill(newPassword);
    await page.getByTestId("reset-password-submit").click();
    await expect(page.getByTestId("reset-password-success")).toBeVisible();

    const reuse = await request.post(`${API}/api/auth/reset-password`, {
      data: { token: rawToken, password: "OutraSenha99" },
    });
    expect(reuse.status()).toBe(400);

    const oldLogin = await request.post(`${API}/api/auth/login`, {
      data: { email: ADMIN.email, password: ADMIN.password },
    });
    expect(oldLogin.status()).toBe(401);

    await page.goto("/login");
    await page.locator("#login-email").fill(ADMIN.email);
    await page.locator("#login-password").fill(newPassword);
    await page.getByRole("button", { name: /Entrar|entrar/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 30_000,
    });
    await expect(page.getByTestId("dashboard-title")).toBeVisible();

    const meOld = await request.get(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${oldToken}` },
    });
    expect(meOld.status()).toBe(401);

    // Restaura senha do seed para não quebrar outros E2E no mesmo worker.
    await clearOutbox(request);
    await page.goto("/esqueci-senha");
    await page.getByTestId("forgot-password-email").fill(ADMIN.email);
    await page.getByTestId("forgot-password-submit").click();
    await expect(page.getByTestId("forgot-password-success")).toBeVisible();
    const restoreToken = await waitForResetMail(request, ADMIN.email);
    const restore = await request.post(`${API}/api/auth/reset-password`, {
      data: { token: restoreToken, password: ADMIN.password },
    });
    expect(restore.ok()).toBeTruthy();
  });

  test("anti-enumeração: e-mail inexistente mostra mesma mensagem de sucesso", async ({
    page,
  }) => {
    await page.goto("/esqueci-senha");
    await page.getByTestId("forgot-password-email").fill("naoexiste-e2e@local");
    await page.getByTestId("forgot-password-submit").click();
    await expect(page.getByTestId("forgot-password-success")).toBeVisible();
  });

  test("token inválido na UI de redefinição", async ({ page }) => {
    await page.goto("/redefinir-senha?token=token-invalido-sem-chance");
    await page.getByTestId("reset-password-input").fill("abcdef1");
    await page.getByTestId("reset-password-confirm").fill("abcdef1");
    await page.getByTestId("reset-password-submit").click();
    await expect(page.getByTestId("reset-password-success")).not.toBeVisible({
      timeout: 5_000,
    });
    await expect(page).toHaveURL(/redefinir-senha/);
  });
});
