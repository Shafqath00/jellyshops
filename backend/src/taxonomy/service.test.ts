import { describe, expect, it } from "vitest";
import type { CategoryRecord, CategoryTemplateRecord, TaxonomyRepository } from "./repository.js";
import { buildSeedRows, MAX_CATEGORY_DEPTH, slugify, TaxonomyService } from "./service.js";

class MemoryRepository implements TaxonomyRepository {
  categories: CategoryRecord[] = [];
  templates: CategoryTemplateRecord[] = [];
  archived = new Set<string>();
  seeds = 0;
  async listCategories(storeId: string) { return this.categories.filter((c) => c.storeId === storeId && !this.archived.has(c.id)); }
  async listTemplates(storeId: string) { return this.templates.filter((t) => t.storeId === storeId); }
  async countPlatformCategories(storeId: string) { return this.categories.filter((c) => c.storeId === storeId && c.source === "platform").length; }
  async seed(_storeId: string, categories: CategoryRecord[], templates: CategoryTemplateRecord[]) { this.seeds += 1; this.categories.push(...categories); this.templates.push(...templates); }
  async getCategory(storeId: string, id: string) { return this.categories.find((c) => c.storeId === storeId && c.id === id) ?? null; }
  async insertCategory(category: CategoryRecord) { this.categories.push(category); return category; }
  async updateCategory(storeId: string, id: string, patch: Partial<CategoryRecord>) {
    const current = await this.getCategory(storeId, id);
    if (!current) return null;
    Object.assign(current, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
    return current;
  }
  async archiveCategory(_storeId: string, id: string) { this.archived.add(id); return true; }
  async getTemplate(storeId: string, id: string) { return this.templates.find((t) => t.storeId === storeId && t.id === id) ?? null; }
  async insertTemplate(template: CategoryTemplateRecord) { this.templates.push(template); return template; }
  async updateTemplate(storeId: string, id: string, patch: Partial<CategoryTemplateRecord>) {
    const current = await this.getTemplate(storeId, id);
    if (!current) return null;
    Object.assign(current, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
    return current;
  }
  async deleteTemplate(storeId: string, id: string) { const before = this.templates.length; this.templates = this.templates.filter((t) => !(t.storeId === storeId && t.id === id)); return this.templates.length < before; }
}

function setup() {
  let n = 0;
  const repository = new MemoryRepository();
  return { repository, service: new TaxonomyService(repository, () => `id-${++n}`) };
}
const named = (categories: CategoryRecord[], path: string) => {
  let parent: string | null = null;
  let found: CategoryRecord | undefined;
  for (const name of path.split(" > ")) {
    found = categories.find((c) => c.name === name && c.parentId === parent);
    parent = found?.id ?? null;
  }
  return found!;
};

describe("platform seed", () => {
  it("builds a consistent tree with parents before children and unique seed keys", () => {
    let n = 0;
    const { categories, templates } = buildSeedRows("s1", undefined, () => `i${++n}`);
    const seen = new Set<string>();
    for (const c of categories) {
      if (c.parentId) expect(seen.has(c.parentId)).toBe(true);
      seen.add(c.id);
    }
    expect(new Set(categories.map((c) => c.seedKey)).size).toBe(categories.length);
    expect(new Set(templates.map((t) => t.seedKey)).size).toBe(templates.length);
    expect(templates.every((t) => seen.has(t.categoryId))).toBe(true);
    const siblings = new Set(categories.map((c) => `${c.parentId}/${c.slug}`));
    expect(siblings.size).toBe(categories.length);
  });
  it("suggests the spec examples: T-shirt size and colour, bed size and storage", () => {
    const { categories, templates } = buildSeedRows("s1");
    const tee = named(categories, "Fashion > Men > T-Shirts");
    expect(templates.filter((t) => t.categoryId === tee.id).map((t) => t.name)).toEqual(["Size", "Colour"]);
    const bed = named(categories, "Furniture > Bedroom > Beds");
    const bedTemplates = templates.filter((t) => t.categoryId === bed.id);
    expect(bedTemplates.map((t) => t.name)).toEqual(["Bed size", "Storage", "Material", "Mattress firmness", "Extras"]);
    expect(bedTemplates.find((t) => t.name === "Extras")).toMatchObject({ optionKind: "addon", multiple: true });
    expect(bedTemplates.find((t) => t.name === "Bed size")).toMatchObject({ optionKind: "variant", required: true });
  });
});

describe("TaxonomyService", () => {
  it("seeds a store once and never reseeds it", async () => {
    const { service, repository } = setup();
    await service.tree("s1");
    await service.tree("s1");
    expect(repository.seeds).toBe(1);
    await service.tree("s2");
    expect(repository.seeds).toBe(2);
  });
  it("does not resurrect a platform category the merchant archived", async () => {
    const { service, repository } = setup();
    const { categories } = await service.tree("s1");
    await service.archiveCategory("s1", named(categories, "Other").id);
    const again = await service.tree("s1");
    expect(repository.seeds).toBe(1);
    expect(again.categories.some((c) => c.name === "Other")).toBe(false);
  });
  it("creates merchant categories with unique sibling slugs", async () => {
    const { service } = setup();
    const { categories } = await service.tree("s1");
    const men = named(categories, "Fashion > Men");
    const first = await service.createCategory("s1", { name: "Hoodies", parentId: men.id });
    const second = await service.createCategory("s1", { name: "Hoodies", parentId: men.id });
    expect([first.slug, second.slug]).toEqual(["hoodies", "hoodies-2"]);
    expect(first).toMatchObject({ source: "merchant", seedKey: null });
    await expect(service.createCategory("s1", { name: "X", parentId: "ghost" })).rejects.toMatchObject({ status: 404 });
  });
  it("enforces the depth limit", async () => {
    const { service } = setup();
    let parentId: string | null = null;
    for (let depth = 1; depth <= MAX_CATEGORY_DEPTH; depth += 1) parentId = (await service.createCategory("s1", { name: `L${depth}`, parentId })).id;
    await expect(service.createCategory("s1", { name: "too deep", parentId })).rejects.toMatchObject({ code: "CATEGORY_TOO_DEEP" });
  });
  it("renames, moves and rejects cycles and over-deep moves", async () => {
    const { service } = setup();
    const a = await service.createCategory("s1", { name: "A" });
    const b = await service.createCategory("s1", { name: "B", parentId: a.id });
    const c = await service.createCategory("s1", { name: "C", parentId: b.id });
    await expect(service.updateCategory("s1", a.id, { parentId: c.id })).rejects.toMatchObject({ code: "CATEGORY_CYCLE" });
    await expect(service.updateCategory("s1", a.id, { parentId: a.id })).rejects.toMatchObject({ code: "CATEGORY_CYCLE" });
    expect(await service.updateCategory("s1", c.id, { name: "Renamed", parentId: null })).toMatchObject({ name: "Renamed", slug: "renamed", parentId: null });
    const { categories } = await service.tree("s1");
    const deep = named(categories, "Furniture > Bedroom > Beds");
    const chain = await service.createCategory("s1", { name: "Chain", parentId: deep.id });
    await expect(service.updateCategory("s1", a.id, { parentId: chain.id })).rejects.toMatchObject({ code: "CATEGORY_TOO_DEEP" });
  });
  it("refuses to archive a category that still has sub-categories", async () => {
    const { service } = setup();
    const { categories } = await service.tree("s1");
    await expect(service.archiveCategory("s1", named(categories, "Fashion").id)).rejects.toMatchObject({ code: "CATEGORY_HAS_CHILDREN" });
    await expect(service.archiveCategory("s1", "ghost")).rejects.toMatchObject({ status: 404 });
  });
  it("manages templates, rejecting duplicate names and cleaning values", async () => {
    const { service } = setup();
    const { categories } = await service.tree("s1");
    const hats = await service.createCategory("s1", { name: "Hats" });
    const template = await service.createTemplate("s1", hats.id, { name: " Size ", optionKind: "variant", displayType: "buttons", required: true, multiple: false, defaultValues: [" S", "s", "M", ""] });
    expect(template).toMatchObject({ name: "Size", defaultValues: ["S", "M"], position: 0, seedKey: null });
    await expect(service.createTemplate("s1", hats.id, { name: "size", optionKind: "variant", displayType: "buttons", required: false, multiple: false, defaultValues: [] })).rejects.toMatchObject({ code: "TEMPLATE_EXISTS" });
    expect(await service.updateTemplate("s1", template.id, { required: false })).toMatchObject({ required: false });
    await service.deleteTemplate("s1", template.id);
    await expect(service.deleteTemplate("s1", template.id)).rejects.toMatchObject({ status: 404 });
    await expect(service.createTemplate("s1", "ghost", { name: "x", optionKind: "addon", displayType: "buttons", required: false, multiple: false, defaultValues: [] })).rejects.toMatchObject({ status: 404 });
    expect(categories.length).toBeGreaterThan(30);
  });
});

describe("slugify", () => {
  it("handles ampersands, punctuation and empty input", () => {
    expect(slugify("Home & Living")).toBe("home-and-living");
    expect(slugify("  T-Shirts! ")).toBe("t-shirts");
    expect(slugify("???")).toBe("category");
  });
});
