import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listStarterPacks } from "@jelly/storefront-themes";
import { galleryTemplate, templateDisplayName, usedCategories } from "./template-gallery";

describe("store design gallery", () => {
  const templates = listStarterPacks().map(galleryTemplate);

  it("gives every store design a cover photo that exists, a shop type and style tags", () => {
    for (const template of templates) {
      expect(template.cover, template.id).toMatch(/^\/templates\/[a-z-]+\.webp$/);
      expect(existsSync(join(process.cwd(), "public", template.cover!)), template.cover).toBe(true);
      expect(template.category, template.id).toBeDefined();
      expect(template.tags.length, template.id).toBeGreaterThan(0);
    }
  });

  it("shows short names without Jelly and keeps other names", () => {
    expect(templateDisplayName("Jelly Minimal")).toBe("Minimal");
    expect(templateDisplayName("Fresh Market")).toBe("Fresh Market");
    expect(templates.some((template) => template.name.startsWith("Jelly "))).toBe(false);
  });

  it("lists only the shop types in use", () => {
    expect(usedCategories(templates).length).toBeGreaterThan(1);
    expect(usedCategories([])).toEqual([]);
  });
});
