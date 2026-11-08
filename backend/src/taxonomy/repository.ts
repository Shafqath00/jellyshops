export type OptionKind = "variant" | "configuration" | "addon";
export type OptionDisplay = "buttons" | "dropdown" | "color" | "image";

export interface CategoryRecord {
  id: string;
  storeId: string;
  parentId: string | null;
  name: string;
  slug: string;
  position: number;
  source: "platform" | "merchant";
  seedKey: string | null;
}

export interface CategoryTemplateRecord {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  optionKind: OptionKind;
  displayType: OptionDisplay;
  required: boolean;
  multiple: boolean;
  defaultValues: string[];
  position: number;
  seedKey: string | null;
}

export type TemplateInput = Omit<CategoryTemplateRecord, "id" | "storeId" | "seedKey">;

export interface TaxonomyRepository {
  listCategories(storeId: string): Promise<CategoryRecord[]>;
  listTemplates(storeId: string): Promise<CategoryTemplateRecord[]>;
  /** Counts platform rows including archived ones, so a deliberately hidden category never reseeds. */
  countPlatformCategories(storeId: string): Promise<number>;
  /** Insert-if-missing by seedKey; safe to call concurrently. Parents precede children. */
  seed(storeId: string, categories: CategoryRecord[], templates: CategoryTemplateRecord[]): Promise<void>;
  getCategory(storeId: string, id: string): Promise<CategoryRecord | null>;
  insertCategory(category: CategoryRecord): Promise<CategoryRecord>;
  updateCategory(storeId: string, id: string, patch: Partial<Pick<CategoryRecord, "name" | "slug" | "parentId" | "position">>): Promise<CategoryRecord | null>;
  archiveCategory(storeId: string, id: string): Promise<boolean>;
  getTemplate(storeId: string, id: string): Promise<CategoryTemplateRecord | null>;
  insertTemplate(template: CategoryTemplateRecord): Promise<CategoryTemplateRecord>;
  updateTemplate(storeId: string, id: string, patch: Partial<TemplateInput>): Promise<CategoryTemplateRecord | null>;
  deleteTemplate(storeId: string, id: string): Promise<boolean>;
}
