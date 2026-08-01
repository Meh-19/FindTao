import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// JSX transform for component tests; existing .ts logic tests are unaffected.
// Environment defaults to node — component tests opt into jsdom per-file with a
// `// @vitest-environment jsdom` docblock, so the pure-logic suite keeps its
// fast node env.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    setupFiles: ["./vitest.setup.ts"],
  },
});
