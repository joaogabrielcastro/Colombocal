import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html"],
      // Foco na lógica de negócio: libs utilitárias, hooks e serviços de features.
      include: [
        "src/lib/**/*.{ts,tsx}",
        "src/hooks/**/*.{ts,tsx}",
        "src/features/**/hooks/**/*.{ts,tsx}",
        "src/features/**/services/**/*.{ts,tsx}",
      ],
      // Exclui infraestrutura/assets/conteúdo estático e código de UI puro.
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "src/lib/brand.ts",
        "src/lib/help-texts.ts",
        "src/features/relatorios-vendas/types.ts",
        "**/types.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 80,
      },
    },
  },
});
