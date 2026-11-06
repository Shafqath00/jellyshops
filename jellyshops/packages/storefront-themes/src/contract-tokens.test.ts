import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONTRACT_BREAKPOINTS, CONTRACT_PHONE_TOKENS, CONTRACT_SPACE, CONTRACT_TABLET_TOKENS, CONTRACT_TOKENS, CONTRACT_TYPE_PRESETS, contractTokenCss, isContractToken } from "./contract-tokens";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const themesCss = join(appRoot, "src/app/themes");
const read = (path: string) => readFileSync(path, "utf8");

function filesUnder(directory: string, pattern: RegExp): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === "dist" ? [] : filesUnder(path, pattern);
    return pattern.test(entry.name) ? [path] : [];
  });
}

describe("design contract tokens", () => {
  it("has the scales the contract documents", () => {
    expect(Object.values(CONTRACT_SPACE)).toEqual([2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96]);
    expect(CONTRACT_BREAKPOINTS).toEqual({ phoneMax: 767, tabletMax: 1023 });
    for (const preset of CONTRACT_TYPE_PRESETS) {
      for (const part of ["size", "line", "track", "case", "font"]) expect(isContractToken(`--j-type-${preset}-${part}`)).toBe(true);
    }
    for (const name of ["--j-page-edge", "--j-page-margin", "--j-section-md", "--j-color-text", "--j-font-heading", "--j-radius-card", "--j-touch-target"]) expect(isContractToken(name)).toBe(true);
    expect(Object.keys(CONTRACT_TABLET_TOKENS).every(isContractToken)).toBe(true);
    expect(Object.keys(CONTRACT_PHONE_TOKENS).every(isContractToken)).toBe(true);
  });

  it("only refers to contract tokens or existing token layers inside its own values", () => {
    for (const value of Object.values(CONTRACT_TOKENS)) {
      for (const [, name] of value.matchAll(/var\((--j-[a-z0-9-]+)/g)) expect(isContractToken(name), `${name} in ${value}`).toBe(true);
    }
  });

  it("is written into storefront-base.css exactly (node scripts/generate-contract-css.mjs)", () => {
    const css = read(join(themesCss, "storefront-base.css"));
    expect(css).toContain(`\n${contractTokenCss()}\n/* contract-tokens:end */`);
  });

  it("every --j-* name used by themes, shared CSS and the renderer is a contract token", () => {
    const files = [
      ...filesUnder(themesCss, /\.css$/),
      join(appRoot, "src/app/globals.css"),
      ...filesUnder(join(appRoot, "packages"), /\.(css|tsx?)$/).filter((file) => !/\.test\.|contract-tokens\.ts$/.test(file)),
    ];
    // A name followed by `${` is a template prefix (`--j-space-${gap}`); the layout primitives build names that way.
    const unknown = files.flatMap((file) => [...read(file).matchAll(/(--j-[a-z0-9-]+)(\$\{)?/g)].filter(([, , template]) => !template).map(([, name]) => name).filter((name) => !isContractToken(name)).map((name) => `${name} (${file.slice(appRoot.length + 1)})`));
    expect([...new Set(unknown)]).toEqual([]);
  });
});
