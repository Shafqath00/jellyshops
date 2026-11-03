import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
      expect(readFileSync(join(folder, "theme.css"), "utf8")).toContain('[data-jelly-theme="coastal-home"]');
      expect(JSON.parse(readFileSync(join(folder, "package.json"), "utf8")).scripts).toMatchObject({ dev: "jelly-theme dev", validate: "jelly-theme validate", test: "jelly-theme test" });
      expect(readFileSync(join(folder, "theme.json"), "utf8")).not.toContain("__ID__");
    });
    it("refuses a folder that already has files, and a name that cannot be an id", async () => {
      writeFileSync(join(directory, "taken.txt"), "x");
      expect(await run(["create", "."])).toBe(1);
      expect(await run(["create", "123"])).toBe(2);
      expect(await run(["create"])).toBe(2);
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
