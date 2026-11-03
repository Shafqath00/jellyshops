import { describe, expect, it } from "vitest";
import { defineTheme } from "./define-theme";
import { listThemes } from "./theme-registry";
import { minimalTokens } from "./minimal/tokens";

describe("defineTheme", () => {
  it("builds a standard manifest from the tokens when none is given", () => {
    const theme = defineTheme({ id: "acme-plain", label: "Acme Plain", tokens: minimalTokens });
    expect(theme.id).toBe("acme-plain");
    expect(theme.sectionVariants.hero).toBe("acme-plain-hero");
    expect((theme.manifest as { assetPrefix: string }).assetPrefix).toBe("/themes/acme-plain/");
  });
  it("refuses a manifest that names another theme or does not match the schema", () => {
    const own = defineTheme({ id: "acme-plain", label: "Acme Plain", tokens: minimalTokens }).manifest as Record<string, unknown>;
    expect(() => defineTheme({ id: "acme-other", label: "Other", tokens: minimalTokens, manifest: own })).toThrow(/manifest for "acme-plain"/);
    expect(() => defineTheme({ id: "acme-plain", label: "Acme", tokens: minimalTokens, manifest: { ...own, flavour: "mint" } })).toThrow();
  });
  it("is how every registered theme is declared (each manifest names its own id)", () => {
    for (const theme of listThemes()) expect((theme.manifest as { id: string }).id, theme.id).toBe(theme.id);
  });
});
