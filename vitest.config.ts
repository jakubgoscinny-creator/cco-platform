import { defineConfig } from "vitest/config";

// CCO-T034 introduced the repo's first test runner. Scoped to *.test.ts unit
// tests (pure logic / Podio field mappers); no jsdom/RTL needed yet.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
