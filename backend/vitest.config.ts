import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./test/unit-environment.ts"],
    maxWorkers: 2,
    testTimeout: 15000,
    hookTimeout: 20000,
    exclude: [...configDefaults.exclude, "test/integration/**"],
  },
});
