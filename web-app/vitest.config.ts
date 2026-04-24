import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Teach Vitest about the Next.js-style `@/*` alias used throughout `src/`.
 *
 * Before this config existed, the test runner succeeded only by accident —
 * no test file imported a module that transitively used `@/...`. Adding the
 * LLM concurrency gate to `tools/shared.ts` broke that invariant, because
 * `shared.ts` now reaches into `@/lib/llm/gate` and `@/lib/llm/providers`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", "tests/e2e/**", ".next"],
  },
});
