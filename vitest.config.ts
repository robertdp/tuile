import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "tuile/jsx-runtime": path.resolve(__dirname, "src/jsx-runtime.ts"),
    },
  },
});
