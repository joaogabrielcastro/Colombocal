/**
 * Helpers E2E — credenciais do seed (não usar em produção).
 */
const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL || "admin@local",
  password: process.env.E2E_ADMIN_PASSWORD || "admin123",
};

const MEMBER = {
  email: process.env.E2E_MEMBER_EMAIL || "membro@local",
  password: process.env.E2E_MEMBER_PASSWORD || "admin123",
};

const DEMO = {
  email: process.env.E2E_DEMO_EMAIL || "demo@local",
  password: process.env.E2E_DEMO_PASSWORD || "admin123",
};

const API = process.env.E2E_API_URL || "http://127.0.0.1:3011";

async function loginUi(page, { email, password, tenantSlug } = ADMIN) {
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  if (tenantSlug) {
    const select = page.locator('select, [name="tenantSlug"]');
    if (await select.count()) {
      await select.first().selectOption(tenantSlug);
    }
  }
  await page.getByRole("button", { name: /Entrar|entrar/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 30_000,
  });
}

async function apiLogin(request, creds = ADMIN) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: {
      email: creds.email,
      password: creds.password,
      ...(creds.tenantSlug ? { tenantSlug: creds.tenantSlug } : {}),
    },
  });
  if (!res.ok()) {
    throw new Error(`login API falhou: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return body;
}

async function apiAuthHeaders(request, creds = ADMIN) {
  const { token } = await apiLogin(request, creds);
  return { Authorization: `Bearer ${token}` };
}

module.exports = {
  ADMIN,
  MEMBER,
  DEMO,
  API,
  loginUi,
  apiLogin,
  apiAuthHeaders,
};
