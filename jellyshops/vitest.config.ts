import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "packages/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"]
  }
});
