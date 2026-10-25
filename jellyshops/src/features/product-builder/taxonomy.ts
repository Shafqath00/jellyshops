export interface TaxonomyCategory { id: string; storeId: string; parentId: string | null; name: string; slug: string; position: number; source: "platform" | "merchant" }
export interface TaxonomyTemplate { id: string; categoryId: string; name: string; optionKind: "variant" | "configuration" | "addon"; displayType: "buttons" | "dropdown" | "color" | "image"; required: boolean; multiple: boolean; defaultValues: string[]; position: number }
export interface Taxonomy { categories: TaxonomyCategory[]; templates: TaxonomyTemplate[] }

export interface CategoryPath { id: string; names: string[]; label: string; hasChildren: boolean }

export function createTaxonomyClient({ baseUrl, token, fetch: fetcher = fetch }: { baseUrl: string; token: string; fetch?: typeof fetch }) {
  const call = async <T,>(storeId: string, path: string, init?: RequestInit): Promise<T> => {
    const response = await fetcher(`${baseUrl}/api/stores/${encodeURIComponent(storeId)}/taxonomy${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(body?.error?.message ?? `Request failed (${response.status})`);
    }
    return response.status === 204 ? undefined as T : await response.json() as T;
  };
  return {
    load: (storeId: string) => call<Taxonomy>(storeId, "/categories"),
    createCategory: (storeId: string, input: { name: string; parentId?: string | null }) => call<TaxonomyCategory>(storeId, "/categories", { method: "POST", body: JSON.stringify(input) }),
  };
}

/** Every category as a readable path ("Fashion › Men › T-Shirts"), tree order. */
export function buildCategoryPaths(categories: TaxonomyCategory[]): CategoryPath[] {
  const children = new Map<string | null, TaxonomyCategory[]>();
  for (const category of categories) children.set(category.parentId, [...(children.get(category.parentId) ?? []), category]);
  const ids = new Set(categories.map((category) => category.id));
  const sort = (list: TaxonomyCategory[]) => [...list].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  const out: CategoryPath[] = [];
  const walk = (parentId: string | null, trail: string[]) => {
    for (const category of sort(children.get(parentId) ?? [])) {
      const names = [...trail, category.name];
      out.push({ id: category.id, names, label: names.join(" › "), hasChildren: (children.get(category.id) ?? []).length > 0 });
      walk(category.id, names);
    }
  };
  walk(null, []);
  // Orphans (parent missing from the list) are still selectable rather than silently lost.
  for (const category of categories) if (category.parentId && !ids.has(category.parentId)) out.push({ id: category.id, names: [category.name], label: category.name, hasChildren: false });
  return out;
}

/** Case-insensitive match on any word of the path; leaves rank before groups. */
export function searchCategoryPaths(paths: CategoryPath[], query: string): CategoryPath[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return paths;
  return paths
    .filter((path) => terms.every((term) => path.label.toLowerCase().includes(term)))
    .sort((a, b) => Number(a.hasChildren) - Number(b.hasChildren));
}

/** Templates for a category, inherited from ancestors; a child overrides a parent's template of the same name. */
export function getCategoryTemplates(categoryId: string, taxonomy: Taxonomy): TaxonomyTemplate[] {
  const byId = new Map(taxonomy.categories.map((category) => [category.id, category]));
  const chain: string[] = [];
  for (let current = byId.get(categoryId); current && chain.length < 10; current = current.parentId ? byId.get(current.parentId) : undefined) chain.unshift(current.id);
  const byName = new Map<string, TaxonomyTemplate>();
  for (const id of chain) for (const template of taxonomy.templates.filter((item) => item.categoryId === id)) byName.set(template.name.trim().toLowerCase(), template);
  return [...byName.values()].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}
