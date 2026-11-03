import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scopeCustomCss } from "@jelly/storefront-schema";
// @ts-expect-error plain JavaScript module
import { run } from "./cli.mjs";

let directory: string;
let output: string;
let errors: string;
const original = process.cwd();

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "jelly-cli-"));
  process.chdir(directory);
  output = ""; errors = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => { output += String(chunk); return true; });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => { errors += String(chunk); return true; });
});
afterEach(() => { process.chdir(original); vi.restoreAllMocks(); });

describe("jelly-theme", () => {
  it("shows help and refuses an unknown command", async () => {
    expect(await run(["--help"])).toBe(0);
    expect(output).toContain("jelly-theme create <name>");
    expect(await run(["bake"])).toBe(2);
    expect(errors).toContain('Unknown command "bake"');
  });

  describe("create", () => {
    it("makes a theme folder named after the folder, with every file the preview needs", async () => {
      expect(await run(["create", "Coastal Home"])).toBe(0);
      const folder = join(directory, "Coastal Home");
      for (const file of ["theme.json", "starter.json", "theme.css", "package.json", ".gitignore", "assets/preview.svg", "assets/mark.svg"]) expect(existsSync(join(folder, file)), file).toBe(true);
      const manifest = JSON.parse(readFileSync(join(folder, "theme.json"), "utf8"));
      expect(manifest).toMatchObject({ id: "coastal-home", name: "Coastal Home", assetPrefix: "/themes/coastal-home/" });
      expect(readFileSync(join(folder, "theme.css"), "utf8")).toContain("& {");
      expect(JSON.parse(readFileSync(join(folder, "package.json"), "utf8")).scripts).toMatchObject({ dev: "jelly-theme dev", validate: "jelly-theme validate", test: "jelly-theme test" });
      expect(readFileSync(join(folder, "theme.json"), "utf8")).not.toContain("__ID__");
    });
    it("writes a stylesheet the platform can scope to the theme (the same step the preview and uploads use)", async () => {
      await run(["create", "scoped"]);
      const scoped = scopeCustomCss(readFileSync(join(directory, "scoped", "theme.css"), "utf8"), '[data-jelly-theme="scoped"]', 150_000);
      expect(scoped).not.toBeNull();
      expect(scoped).toContain('[data-jelly-theme="scoped"] .jelly-button');
      expect(scoped).toMatch(/\[data-jelly-theme="scoped"\]\s*\{[^}]*background/);
      // No rule is left unscoped: every rule starts with the theme's scope or an @-rule.
      expect(scoped).not.toMatch(/(^|\})\s*h1/);
    });
    it("refuses a folder that already has files, and a name that cannot be an id", async () => {
      writeFileSync(join(directory, "taken.txt"), "x");
      expect(await run(["create", "."])).toBe(1);
      expect(await run(["create", "123"])).toBe(2);
      expect(await run(["create"])).toBe(2);
    });
  });

  describe("package", () => {
    it("writes <id>-<version>.jellytheme.json with the manifest, starter, css and every asset", async () => {
      await run(["create", "boxed"]);
      process.chdir(join(directory, "boxed"));
      expect(await run(["package"])).toBe(0);
      const file = join(directory, "boxed", "dist", "boxed-1.0.0.jellytheme.json");
      expect(existsSync(file)).toBe(true);
      const built = JSON.parse(readFileSync(file, "utf8"));
      expect(built).toMatchObject({ format: 1, manifest: { id: "boxed" } });
      expect(built.starter.templates.home).toBeDefined();
      expect(built.css).toContain("& {");
      expect(built.assets.map((asset: { path: string; contentType: string }) => [asset.path, asset.contentType]).sort()).toEqual([["mark.svg", "image/svg+xml"], ["preview.svg", "image/svg+xml"]]);
      expect(Buffer.from(built.assets[0].base64, "base64").toString("utf8")).toContain("<svg");
    });
    it("honours --out, and refuses a theme that does not validate or holds a file type that is not allowed", async () => {
      await run(["create", "boxed"]);
      process.chdir(join(directory, "boxed"));
      expect(await run(["package", ".", "--out", join(directory, "elsewhere")])).toBe(0);
      expect(existsSync(join(directory, "elsewhere", "boxed-1.0.0.jellytheme.json"))).toBe(true);
      writeFileSync(join(directory, "boxed", "assets", "app.js"), "alert(1)");
      expect(await run(["package"])).toBe(1);
      expect(errors).toContain("not allowed");
      errors = "";
      const starter = JSON.parse(readFileSync(join(directory, "boxed", "starter.json"), "utf8"));
      starter.templates.home.type = "homepage";
      writeFileSync(join(directory, "boxed", "starter.json"), JSON.stringify(starter));
      expect(await run(["package"])).toBe(1);
      expect(errors).toContain("jelly-theme validate");
    });
  });

  describe("upload", () => {
    const answer = (status: number, body: unknown) => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
    afterEach(() => vi.unstubAllGlobals());

    it("needs a store and a token", async () => {
      await run(["create", "up"]);
      process.chdir(join(directory, "up"));
      expect(await run(["upload"])).toBe(2);
      expect(errors).toContain("--store");
    });
    it("posts the package with the bearer token and reports what was stored", async () => {
      await run(["create", "up"]);
      process.chdir(join(directory, "up"));
      answer(201, { package: { id: "p1", themeId: "up", name: "Up" }, version: { id: "v1", version: "1.0.0", status: "active" }, created: true });
      expect(await run(["upload", ".", "--store", "store-1", "--token", "secret", "--api", "http://api.test/"])).toBe(0);
      const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://api.test/api/stores/store-1/theme-packages");
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer secret");
      expect(JSON.parse(init.body as string).manifest.id).toBe("up");
      expect(output).toContain("Uploaded up-1.0.0.jellytheme.json");
      expect(output).toContain("version 1.0.0");
    });
    it("prints the platform's plain message and its issues when it refuses the theme", async () => {
      await run(["create", "up"]);
      process.chdir(join(directory, "up"));
      answer(400, { error: { code: "INVALID_PACKAGE", message: "1 problem in the theme: theme.css: nope.", issues: [{ path: "theme.css", message: "nope" }] } });
      expect(await run(["upload", "--store", "s", "--token", "t"])).toBe(1);
      expect(errors).toContain("1 problem in the theme");
      expect(errors).toContain("theme.css: nope");
    });
    it("says so when the platform cannot be reached", async () => {
      await run(["create", "up"]);
      process.chdir(join(directory, "up"));
      vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("connect ECONNREFUSED"); }));
      expect(await run(["upload", "--store", "s", "--token", "t"])).toBe(1);
      expect(errors).toContain("Could not reach");
    });
  });

  describe("validate", () => {
    it("passes the scaffolded theme", async () => {
      await run(["create", "plain"]);
      process.chdir(join(directory, "plain"));
      expect(await run(["validate"])).toBe(0);
      expect(output).toContain("is valid");
    });
    it("reports plain-language errors and exits 1 when something is wrong", async () => {
      await run(["create", "broken"]);
      const file = join(directory, "broken", "starter.json");
      const starter = JSON.parse(readFileSync(file, "utf8"));
      starter.templates.home.sections.push({ kind: "inline", section: { id: "x", type: "does-not-exist", enabled: true, settings: {}, blocks: [] } });
      writeFileSync(file, JSON.stringify(starter));
      process.chdir(join(directory, "broken"));
      expect(await run(["validate"])).toBe(1);
      expect(output).toMatch(/error\s+.*does-not-exist|SECTION_NOT_REGISTERED|not registered/i);
      output = "";
      expect(await run(["validate", "--json"])).toBe(1);
      expect(JSON.parse(output).some((issue: { code: string }) => issue.code === "SECTION_NOT_REGISTERED")).toBe(true);
    });
    it("says what is missing when run outside a theme folder", async () => {
      expect(await run(["validate"])).toBe(2);
      expect(errors).toContain("theme.json was not found");
    });
  });
});
