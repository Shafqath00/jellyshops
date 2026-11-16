import { describe, expect, it } from "vitest";
import type { MenuRecord } from "./api/types";
import { carriedThemeSettings, menusToRestore, withCarriedSettings } from "./design-switch";

const menu = (id: string, handle: string, items: unknown[]): MenuRecord => ({ id, storeId: "s", revision: 1, name: handle, handle, items } as MenuRecord);

describe("switching designs keeps the store's own content", () => {
  it("carries the logo, social links and languages, but not colours or fonts", () => {
    const carried = carriedThemeSettings({
      branding: { logoUrl: "/api/public/media/s/logo", faviconUrl: "" },
      social: { instagram: "https://instagram.com/shop", tiktok: "" },
      languages: { extra: "fr" },
      colors: { primary: "#000" },
    });
    expect(carried).toEqual({ branding: { logoUrl: "/api/public/media/s/logo" }, social: { instagram: "https://instagram.com/shop" }, languages: { extra: "fr" } });
  });

  it("puts carried values over the new design's settings and keeps the rest", () => {
    const next = withCarriedSettings({ branding: { logoUrl: "", faviconUrl: "/fav" }, colors: { primary: "#fff" } }, { branding: { logoUrl: "/logo" } });
    expect(next).toEqual({ branding: { logoUrl: "/logo", faviconUrl: "/fav" }, colors: { primary: "#fff" } });
  });

  it("carries nothing from a store without its own values", () => {
    expect(carriedThemeSettings(null)).toEqual({});
    expect(carriedThemeSettings({ branding: { logoUrl: "  " } })).toEqual({});
  });

  it("gives the new main and footer menus the store's links, ignoring earlier-version menus", () => {
    const own = [{ id: "1", label: "Beds" }];
    const before = [menu("old-main", "main", own), menu("old-footer", "footer", []), menu("older", "previous-abc", [{ id: "x" }])];
    const after = [menu("new-main", "main", [{ id: "home" }]), menu("new-footer", "footer", [{ id: "about" }]), menu("new-extra", "help", [])];
    expect(menusToRestore(before, after)).toEqual([{ menu: after[0], items: own }]);
  });
});
