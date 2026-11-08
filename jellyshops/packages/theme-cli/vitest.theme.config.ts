import { defineConfig } from "vitest/config";

// Used by `jelly-theme test`: runs the conformance suite against the theme folder named in JELLY_THEME_DIR.
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/conformance-entry.tsx"],
    setupFiles: ["./src/test-setup.ts"],
    server: { deps: { inline: [/@jelly\//] } },
  },
});
