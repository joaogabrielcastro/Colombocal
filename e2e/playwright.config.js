const { defineConfig, devices } = require("@playwright/test");
const path = require("path");

const FRONTEND_URL = process.env.E2E_BASE_URL || "http://127.0.0.1:3010";
const BACKEND_URL = process.env.E2E_API_URL || "http://127.0.0.1:3011";
const root = path.resolve(__dirname, "..");

module.exports = defineConfig({
  testDir: "./tests",
  globalSetup: require.resolve("./global-setup.js"),
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: FRONTEND_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "node src/index.js",
      cwd: path.join(root, "backend"),
      url: `${BACKEND_URL}/ready`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || "test",
        PORT: "3011",
        AUTH_DISABLED: "false",
        JWT_SECRET: process.env.JWT_SECRET || "e2e-jwt-secret-not-for-prod",
        NFE_PROVIDER: "mock",
        NFE_WEBHOOK_SECRET: process.env.NFE_WEBHOOK_SECRET || "e2e-hook",
        EXPORT_QUEUE_MODE: "memory",
        EMAIL_TRANSPORT: "memory",
        ALLOW_EMAIL_OUTBOX_INSPECT: "true",
        FISCAL_TOKEN_ENCRYPTION_KEY:
          process.env.FISCAL_TOKEN_ENCRYPTION_KEY ||
          Buffer.from("0123456789abcdef0123456789abcdef").toString("base64"),
        APP_PUBLIC_URL: FRONTEND_URL,
        DATABASE_URL:
          process.env.DATABASE_URL ||
          process.env.TEST_DATABASE_URL ||
          "postgresql://postgres:colombocal_dev@127.0.0.1:5436/colombocal_test?schema=public",
      },
    },
    {
      command: "npm run start:e2e",
      cwd: path.join(root, "frontend"),
      url: FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: "3010",
        HOSTNAME: "127.0.0.1",
        NEXT_PUBLIC_API_ORIGIN: BACKEND_URL,
        NEXT_PUBLIC_REQUIRE_LOGIN: "true",
      },
    },
  ],
});
