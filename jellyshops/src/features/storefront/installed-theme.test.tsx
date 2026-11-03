import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getThemeDefinition, resolveTheme } from "@jelly/storefront-themes";
import { InstalledThemeProvider } from "./installed-theme-provider";
import { installedThemeCss, loadInstalledTheme } from "./installed-theme";

// A small, valid theme manifest the way the platform serves it.
const manifest = (id: string, version = "1.0.0") => ({
  id, name: "Loaded Theme", version, description: "x", assetPrefix: `/themes/${id}/`, layout: "standard", enabled: true,
  settingsDefaults: { colors: { primary: "#112233", background: "#ffffff", text: "#111111", surface: "#ffffff", accent: "#cc8800" }, typography: { headingFont: "Georgia", bodyFont: "Arial" } },
  settingsSchema: [], assets: { stylesheets: [], scripts: [], fonts: [], icons: [], assets: [] },
});
const served = (id: string, versionId: string, version = "1.0.0") => ({ version: { id: versionId, themeId: id, version, status: "active", css: `[data-jelly-theme="${id}"]{color:red}`, manifest: manifest(id, version), starter: null, assets: [] } });
const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("uploaded themes in the storefront", () => {
  it("keeps cached versions pinned and limits each legacy stylesheet to its own version wrapper", async () => {
    for (const version of ["2.0.0", "1.0.0"]) await loadInstalledTheme(`parallel-${version}`, { baseUrl: "http://api.test", fetch: answer(served("parallel-theme", `parallel-${version}`, version)) as never });
    const fetcher = answer({}, 500);
    await loadInstalledTheme("parallel-1.0.0", { baseUrl: "http://api.test", fetch: fetcher as never });
    expect(fetcher).not.toHaveBeenCalled();
    for (const version of ["1.0.0", "2.0.0"]) {
      expect(resolveTheme("parallel-theme", {}, version)).toMatchObject({ id: "parallel-theme", version });
      const css = installedThemeCss(`parallel-${version}`);
      expect(css).toContain(`[data-jelly-theme="parallel-theme"][data-jelly-theme-version="${version}"]`);
      expect(css).not.toContain(`[data-jelly-theme-version="${version === "1.0.0" ? "2.0.0" : "1.0.0"}"]`);
    }
  });
  it("loads a version from the platform, registers it so the theme resolves, and keeps its stylesheet", async () => {
    const fetcher = answer(served("loaded-one", "v-1"));
    const theme = await loadInstalledTheme("v-1", { baseUrl: "http://api.test/", fetch: fetcher as never });
    expect(theme).toMatchObject({ themeId: "loaded-one", version: "1.0.0" });
    expect(fetcher).toHaveBeenCalledWith("http://api.test/api/public/theme-versions/v-1", expect.anything());
    expect(getThemeDefinition("loaded-one").id).toBe("loaded-one");
    const resolved = resolveTheme("loaded-one", {}, "1.0.0");
    expect(resolved).toMatchObject({ id: "loaded-one", version: "1.0.0" });
    expect(resolved.fallbackReason).toBeUndefined();
    expect(installedThemeCss("v-1")).toContain('[data-jelly-theme="loaded-one"]');
    // A second load is answered from memory.
    await loadInstalledTheme("v-1", { baseUrl: "http://api.test", fetch: fetcher as never });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns nothing, and leaves the default theme in charge, when the version cannot be loaded", async () => {
    expect(await loadInstalledTheme(null, { baseUrl: "http://api.test" })).toBeNull();
    expect(await loadInstalledTheme("gone", { baseUrl: "http://api.test", fetch: answer({}, 404) as never })).toBeNull();
    expect(await loadInstalledTheme("mismatch", { baseUrl: "http://api.test", fetch: answer(served("other", "different-id")) as never })).toBeNull();
    expect(await loadInstalledTheme("down", { baseUrl: "http://api.test", fetch: vi.fn(async () => { throw new Error("offline"); }) as never })).toBeNull();
    expect(resolveTheme("never-loaded")).toMatchObject({ id: "minimal", fallbackReason: "theme-unavailable" });
  });

  it("the provider registers the theme before its children render and draws the stylesheet", () => {
    let seen = "";
    function Child() { seen = resolveTheme("provided-theme").id; return <p>child</p>; }
    const theme = { versionId: "v-p", themeId: "provided-theme", version: "1.0.0", css: '[data-jelly-theme="provided-theme"]{color:blue}', manifest: manifest("provided-theme"), starter: null };
    const view = render(<InstalledThemeProvider theme={theme}><Child /></InstalledThemeProvider>);
    expect(seen).toBe("provided-theme");
    expect(view.container.querySelector("style[data-installed-theme='v-p']")?.textContent).toContain("color:blue");
  });

  it("renders its children unchanged for a store on a built-in theme", () => {
    const view = render(<InstalledThemeProvider theme={null}><p>plain</p></InstalledThemeProvider>);
    expect(view.container.innerHTML).toBe("<p>plain</p>");
  });
});
