import { defineConfig, devices } from "@playwright/test";

const frontendPort = process.env.JELLY_E2E_FRONTEND_PORT ?? "3000";
const backendPort = process.env.JELLY_E2E_BACKEND_PORT ?? "3001";
const frontendUrl = `http://127.0.0.1:${frontendPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  use: { baseURL: frontendUrl, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], ...(process.platform === "win32" ? { channel: "chrome" as const } : {}) } }],
  webServer: {
    command: `npm run dev -- -p ${frontendPort}`,
    url: frontendUrl,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      JELLY_E2E_NEXT_DIST_DIR: ".next/e2e",
      NEXT_PUBLIC_STORE_EDITOR_API_URL: `http://127.0.0.1:${backendPort}`,
      NEXT_PUBLIC_DEMO_STOREFRONT_ID: "store-sweet-bakes"
    }
  }
});
