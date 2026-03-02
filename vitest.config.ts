import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "tuile/jsx-runtime": new URL("src/jsx-runtime.ts", import.meta.url)
        .pathname,
    },
  },
});
