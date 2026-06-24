import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// CCO-T034 introduced the repo's first test runner. Scoped to *.test.ts unit
// tests (pure logic / Podio field mappers); no jsdom/RTL needed yet.
//
// CCO-T065 added the `@/` path alias so tests can exercise modules that use the
// app's `@/lib/...` imports (e.g. the exam-start server action). Existing leaf
// tests use relative imports and are unaffected.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
