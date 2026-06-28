import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@members": path.resolve(__dirname, "./members.ts"),
      "@site.config": path.resolve(__dirname, "./site.config.ts"),
    },
  },
});
