import { randomUUID } from "node:crypto";
import { ApiError } from "../http/errors.js";
import type { CategoryRecord, CategoryTemplateRecord, TaxonomyRepository, TemplateInput } from "./repository.js";
import { PLATFORM_CATEGORY_SEED, type SeedCategory } from "./seed.js";

export const MAX_CATEGORY_DEPTH = 4;

export function slugify(text: string): string {
  return text.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "category";
}

/** Expands the platform seed into rows for one store. Pure, so it is easy to test. */
export function buildSeedRows(storeId: string, seed: SeedCategory[] = PLATFORM_CATEGORY_SEED, newId: () => string = randomUUID) {
  const categories: CategoryRecord[] = [];
  const templates: CategoryTemplateRecord[] = [];
  const walk = (nodes: SeedCategory[], parentId: string | null, parentKey: string) => {
    nodes.forEach((node, position) => {
      const slug = slugify(node.name);
      const seedKey = parentKey ? `${parentKey}/${slug}` : slug;
      const id = newId();
      categories.push({ id, storeId, parentId, name: node.name, slug, position, source: "platform", seedKey });
      (node.templates ?? []).forEach((template, order) => templates.push({
        id: newId(), storeId, categoryId: id, name: template.name, optionKind: template.kind, displayType: template.display ?? "buttons",
        required: template.required ?? false, multiple: template.multiple ?? false, defaultValues: template.values ?? [], position: order, seedKey: `${seedKey}#${slugify(template.name)}`,
      }));
      walk(node.children ?? [], id, seedKey);
    });
  };
  walk(seed, null, "");
  return { categories, templates };
}

export class TaxonomyService {
  constructor(private readonly repository: TaxonomyRepository, private readonly newId: () => string = randomUUID) {}

  /** Returns the flat category list and template list; the first call for a store copies the platform seed. */
  async tree(storeId: string) {
    if (await this.repository.countPlatformCategories(storeId) === 0) {
      const rows = buildSeedRows(storeId, PLATFORM_CATEGORY_SEED, this.newId);
      await this.repository.seed(storeId, rows.categories, rows.templates);
    }
    const [categories, templates] = await Promise.all([this.repository.listCategories(storeId), this.repository.listTemplates(storeId)]);
    return { categories, templates };
  }

  private depthOf(id: string | null, byId: Map<string, CategoryRecord>): number {
    let depth = 0;
    for (let current = id ? byId.get(id) : undefined; current; current = current.parentId ? byId.get(current.parentId) : undefined) {
      depth += 1;
      if (depth > MAX_CATEGORY_DEPTH + 1) break;
    }
    return depth;
  }

  private subtreeHeight(id: string, categories: CategoryRecord[]): number {
    const children = categories.filter((category) => category.parentId === id);
    return 1 + Math.max(0, ...children.map((child) => this.subtreeHeight(child.id, categories)));
  }

  private uniqueSlug(base: string, parentId: string | null, categories: CategoryRecord[], ignoreId?: string): string {
    const taken = new Set(categories.filter((category) => category.parentId === parentId && category.id !== ignoreId).map((category) => category.slug));
    if (!taken.has(base)) return base;
    for (let n = 2; ; n += 1) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }

  async createCategory(storeId: string, input: { name: string; parentId?: string | null }): Promise<CategoryRecord> {
    const { categories } = await this.tree(storeId);
    const parentId = input.parentId ?? null;
    const byId = new Map(categories.map((category) => [category.id, category]));
    if (parentId && !byId.has(parentId)) throw new ApiError(404, "CATEGORY_NOT_FOUND", "Parent category not found");
    if (this.depthOf(parentId, byId) >= MAX_CATEGORY_DEPTH) throw new ApiError(422, "CATEGORY_TOO_DEEP", `Categories can be at most ${MAX_CATEGORY_DEPTH} levels deep`);
    const siblings = categories.filter((category) => category.parentId === parentId);
    return this.repository.insertCategory({
      id: this.newId(), storeId, parentId, name: input.name.trim(), slug: this.uniqueSlug(slugify(input.name), parentId, categories),
      position: Math.max(-1, ...siblings.map((category) => category.position)) + 1, source: "merchant", seedKey: null,
    });
  }

  async updateCategory(storeId: string, id: string, patch: { name?: string; parentId?: string | null; position?: number }): Promise<CategoryRecord> {
    const { categories } = await this.tree(storeId);
    const byId = new Map(categories.map((category) => [category.id, category]));
    const current = byId.get(id);
    if (!current) throw new ApiError(404, "CATEGORY_NOT_FOUND", "Category not found");
    const parentId = patch.parentId === undefined ? current.parentId : patch.parentId;
    if (parentId !== current.parentId) {
      if (parentId) {
        if (!byId.has(parentId)) throw new ApiError(404, "CATEGORY_NOT_FOUND", "Parent category not found");
        for (let ancestor: CategoryRecord | undefined = byId.get(parentId); ancestor; ancestor = ancestor.parentId ? byId.get(ancestor.parentId) : undefined) {
          if (ancestor.id === id) throw new ApiError(422, "CATEGORY_CYCLE", "A category cannot be moved inside itself");
        }
      }
      if (this.depthOf(parentId, byId) + this.subtreeHeight(id, categories) > MAX_CATEGORY_DEPTH) throw new ApiError(422, "CATEGORY_TOO_DEEP", `Categories can be at most ${MAX_CATEGORY_DEPTH} levels deep`);
    }
    const name = patch.name?.trim();
    const slug = name !== undefined || parentId !== current.parentId ? this.uniqueSlug(slugify(name ?? current.name), parentId, categories, id) : undefined;
    const updated = await this.repository.updateCategory(storeId, id, { name, slug, parentId: parentId !== current.parentId ? parentId : undefined, position: patch.position });
    if (!updated) throw new ApiError(404, "CATEGORY_NOT_FOUND", "Category not found");
    return updated;
  }

  async archiveCategory(storeId: string, id: string): Promise<void> {
    const { categories } = await this.tree(storeId);
    if (!categories.some((category) => category.id === id)) throw new ApiError(404, "CATEGORY_NOT_FOUND", "Category not found");
    if (categories.some((category) => category.parentId === id)) throw new ApiError(409, "CATEGORY_HAS_CHILDREN", "Move or remove the sub-categories first");
    await this.repository.archiveCategory(storeId, id);
  }

  async createTemplate(storeId: string, categoryId: string, input: Omit<TemplateInput, "position" | "categoryId"> & { position?: number }): Promise<CategoryTemplateRecord> {
    const { categories, templates } = await this.tree(storeId);
    if (!categories.some((category) => category.id === categoryId)) throw new ApiError(404, "CATEGORY_NOT_FOUND", "Category not found");
    const own = templates.filter((template) => template.categoryId === categoryId);
    if (own.some((template) => template.name.trim().toLowerCase() === input.name.trim().toLowerCase())) throw new ApiError(409, "TEMPLATE_EXISTS", `"${input.name}" is already suggested for this category`);
    return this.repository.insertTemplate({
      ...input, name: input.name.trim(), id: this.newId(), storeId, categoryId, seedKey: null,
      defaultValues: normaliseValues(input.defaultValues), position: input.position ?? Math.max(-1, ...own.map((template) => template.position)) + 1,
    });
  }

  async updateTemplate(storeId: string, id: string, patch: Partial<Omit<TemplateInput, "categoryId">>): Promise<CategoryTemplateRecord> {
    const current = await this.repository.getTemplate(storeId, id);
    if (!current) throw new ApiError(404, "TEMPLATE_NOT_FOUND", "Template not found");
    const updated = await this.repository.updateTemplate(storeId, id, {
      ...patch, name: patch.name?.trim(), defaultValues: patch.defaultValues ? normaliseValues(patch.defaultValues) : undefined,
    });
    if (!updated) throw new ApiError(404, "TEMPLATE_NOT_FOUND", "Template not found");
    return updated;
  }

  async deleteTemplate(storeId: string, id: string): Promise<void> {
    if (!await this.repository.deleteTemplate(storeId, id)) throw new ApiError(404, "TEMPLATE_NOT_FOUND", "Template not found");
  }
}

function normaliseValues(values: string[]): string[] {
  const seen = new Set<string>();
  return values.map((value) => value.trim()).filter((value) => value && !seen.has(value.toLowerCase()) && seen.add(value.toLowerCase())).slice(0, 100);
}
