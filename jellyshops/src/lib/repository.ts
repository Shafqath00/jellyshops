import { migrateStoreDesignDocument, type StoreDesignDocument } from "@jelly/storefront-schema";
import { validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { Brand, Cart, Category, CategoryOptionDefinition, Collection, ConfiguredOptionSelection, Customer, Order, Product, ProductOption, ProductOptionValue, ProductVariant, ShopState, Store, StoreDesignPublication, StoreDesignRecord } from "./domain";
import { majorToMinor, slugify } from "./domain";
import { createCartConfigurationKey } from "./product-configuration";
import { createRuntimeState, createSeedState } from "./seed";

const STORAGE_KEY = "jelly-shop-state-v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SaveStoreDesignDraftInput { storeId: string; expectedRevision: number; document: StoreDesignDocument }
export type SaveStoreDesignDraftResult = { ok: true; record: StoreDesignRecord } | { ok: false; code: "DRAFT_REVISION_CONFLICT"; currentRevision: number };
export type PublishStoreDesignResult = { ok: true; publication: StoreDesignPublication } | { ok: false; code: "DRAFT_REVISION_CONFLICT"; currentRevision: number };

export interface ShopRepository {
  getState(): ShopState;
  subscribe(listener: () => void): () => void;
  getStore(id: string): Store | undefined;
  getStoreBySlug(slug: string): Store | undefined;
  saveStore(store: Store): Store;
  getStoreDesign(storeId: string): StoreDesignRecord | undefined;
  saveStoreDesignDraft(input: SaveStoreDesignDraftInput): SaveStoreDesignDraftResult;
  publishStoreDesign(storeId: string, expectedRevision: number): PublishStoreDesignResult;
  getPublishedStoreDesign(storeId: string): StoreDesignPublication | undefined;
  listProducts(storeSlug?: string): Product[];
  replaceCatalog(storeId: string, products: Product[]): void;
  getProduct(id: string): Product | undefined;
  getProductBySlug(storeId: string, slug: string): Product | undefined;
  getVariant(id: string): ProductVariant | undefined;
  saveProduct(product: Product): Product;
  getCategories(storeId: string): Category[];
  createCategory(input: Omit<Category, "id" | "slug"> & { slug?: string }): Category;
  getBrands(storeId: string): Brand[];
  createBrand(input: Omit<Brand, "id" | "slug"> & { slug?: string }): Brand;
  getCollections(storeId: string): Collection[];
  createCollection(input: Omit<Collection, "id" | "slug"> & { slug?: string }): Collection;
  getCategoryOptionDefinitions(categoryId: string): CategoryOptionDefinition[];
  createCategoryOptionDefinition(input: Omit<CategoryOptionDefinition, "id">): CategoryOptionDefinition;
  updateCategoryOptionDefinition(id: string, patch: Partial<Omit<CategoryOptionDefinition, "id" | "storeId" | "categoryId">>): CategoryOptionDefinition;
  deleteCategoryOptionDefinition(id: string): void;
  getRecentCategoryIds(storeId: string): string[];
  recordRecentCategory(storeId: string, categoryId: string): string[];
  archiveProduct(id: string): void;
  listOrders(storeId?: string): Order[];
  getOrder(id: string): Order | undefined;
  listCustomers(storeId?: string): Customer[];
  createCart(storeSlug: string): Cart;
  getCartForStore(storeSlug: string): Cart | undefined;
  updateCartItem(cartId: string, variantId: string, quantity: number, configurationSelections?: ConfiguredOptionSelection[], unitPriceMinor?: number): Cart;
  reset(): void;
}

export function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); }
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function normalizeOptionValue(value: ProductOptionValue & { priceAdjustment?: number }): ProductOptionValue {
  const legacy = value.priceAdjustment;
  const priceAdjustmentMinor = Number.isFinite(value.priceAdjustmentMinor)
    ? value.priceAdjustmentMinor
    : legacy === undefined
      ? 0
      : majorToMinor(legacy);
  const { priceAdjustment: _legacy, ...rest } = value;
  return { ...rest, priceAdjustmentMinor: Number.isFinite(priceAdjustmentMinor) ? priceAdjustmentMinor : 0 };
}

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    variants: (product.variants ?? []).map((variant) => ({ ...variant })),
    options: (product.options ?? []).map((option: ProductOption) => ({ ...option, values: (option.values ?? []).map((value) => normalizeOptionValue(value as ProductOptionValue & { priceAdjustment?: number })) })),
    additionalCategoryIds: product.additionalCategoryIds ?? [],
    collectionIds: product.collectionIds ?? [],
  };
}

function normalizeMetadata(state: ShopState): ShopState {
  const fallbackStoreId = state.activeStoreId || state.stores[0]?.id || "legacy-store";
  const products = (state.products ?? []).map(normalizeProduct);
  const storeForCategory = (category: { id: string; name: string; storeId?: string }): string => {
    if (category.storeId) return category.storeId;
    const referencing = products.filter((product) => product.primaryCategoryId === category.id || product.additionalCategoryIds?.includes(category.id));
    if (referencing.length === 1) return referencing[0].storeId;
    const named = products.filter((product) => product.category.trim().toLowerCase() === category.name.trim().toLowerCase());
    return named.length === 1 ? named[0].storeId : fallbackStoreId;
  };
  const categories = (state.categories ?? []).map((category) => ({ ...category, storeId: storeForCategory(category), name: category.name.trim(), slug: slugify(category.slug || category.name) }));
  const categoriesById = new Map(categories.map((category) => [category.id, category.storeId]));
  const brands = (state.brands ?? []).map((brand) => ({ ...brand, storeId: brand.storeId || fallbackStoreId, name: brand.name.trim(), slug: slugify(brand.slug || brand.name) }));
  const collections = (state.collections ?? []).map((collection) => ({ ...collection, storeId: collection.storeId || fallbackStoreId, name: collection.name.trim(), slug: slugify(collection.slug || collection.name) }));
  const categoryOptionDefinitions = (state.categoryOptionDefinitions ?? []).map((definition) => ({
    ...definition,
    storeId: definition.storeId || categoriesById.get(definition.categoryId) || fallbackStoreId,
  }));
  return { ...state, products, categories, brands, collections, categoryOptionDefinitions };
}

function addMissingStoreDesigns(state: ShopState): ShopState {
  const existing = Array.isArray(state.storeDesigns) ? state.storeDesigns : [];
  state = normalizeMetadata({
    ...state,
    categories: Array.isArray(state.categories) ? state.categories : [],
    brands: Array.isArray(state.brands) ? state.brands : [],
    collections: Array.isArray(state.collections) ? state.collections : [],
    categoryOptionDefinitions: Array.isArray(state.categoryOptionDefinitions) ? state.categoryOptionDefinitions : [],
    recentCategoryIdsByStore: state.recentCategoryIdsByStore ?? {},
    storeDesigns: state.stores.map((store) => existing.find((record) => record.storeId === store.id) ?? {
      storeId: store.id,
      draftDocument: migrateStoreDesignDocument(createSeedState().storeDesigns.find((record) => record.storeId === store.id)!.draftDocument),
      draftRevision: 1,
      publications: []
    })
  });
  return state;
}

function readState(storage: StorageLike): ShopState {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return createSeedState();
  try {
    const parsed = JSON.parse(raw) as ShopState;
    return parsed.version === 1 ? addMissingStoreDesigns(parsed) : createSeedState();
  } catch {
    return createSeedState();
  }
}

export function createRepository(storage: StorageLike, options: { runtime?: boolean } = {}): ShopRepository {
  let state = readState(storage);
  if (options.runtime && !storage.getItem(STORAGE_KEY)) state = createRuntimeState();
  const listeners = new Set<() => void>();

  const commit = () => {
    state = clone(state);
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    listeners.forEach((listener) => listener());
  };

  const storeForSlug = (slug: string) => state.stores.find((store) => store.slug === slug);
  const findVariant = (id: string) => state.products.flatMap((product) => product.variants).find((variant) => variant.id === id);
  const findStoreDesign = (storeId: string) => state.storeDesigns.find((record) => record.storeId === storeId);

  const validateDesign = (input: StoreDesignDocument) => {
    const document = migrateStoreDesignDocument(input);
    const issues = [
      ...validateSectionAgainstRegistry(document.header, "home"),
      ...validateSectionAgainstRegistry(document.footer, "home"),
      ...Object.values(document.pages).flatMap((page) => page.sections.flatMap((section) => validateSectionAgainstRegistry(section, page.type)))
    ];
    if (issues.length > 0) throw new Error(`Invalid Store Design registry entry: ${issues[0].code}`);
    return document;
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getStore: (id) => state.stores.find((store) => store.id === id),
    getStoreBySlug: storeForSlug,
    saveStore(store) {
      const normalized = { ...store, slug: slugify(store.slug || store.name) };
      const index = state.stores.findIndex((item) => item.id === normalized.id);
      if (index >= 0) state.stores[index] = normalized;
      else state.stores.push(normalized);
      commit();
      return normalized;
    },
    getStoreDesign(storeId) {
      const design = findStoreDesign(storeId);
      return design ? clone(design) : undefined;
    },
    saveStoreDesignDraft({ storeId, expectedRevision, document }) {
      const record = findStoreDesign(storeId);
      if (!record) throw new Error("STORE_DESIGN_NOT_FOUND");
      if (record.draftRevision !== expectedRevision) return { ok: false, code: "DRAFT_REVISION_CONFLICT", currentRevision: record.draftRevision };
      record.draftDocument = validateDesign(document);
      record.draftRevision += 1;
      commit();
      return { ok: true, record: clone(findStoreDesign(storeId)!) };
    },
    publishStoreDesign(storeId, expectedRevision) {
      const record = findStoreDesign(storeId);
      if (!record) throw new Error("STORE_DESIGN_NOT_FOUND");
      if (record.draftRevision !== expectedRevision) return { ok: false, code: "DRAFT_REVISION_CONFLICT", currentRevision: record.draftRevision };
      const publication: StoreDesignPublication = { id: `publication-${crypto.randomUUID()}`, revision: record.publications.length + 1, document: clone(record.draftDocument), publishedAt: new Date().toISOString() };
      record.publications.push(publication);
      record.currentPublicationId = publication.id;
      commit();
      return { ok: true, publication: clone(publication) };
    },
    getPublishedStoreDesign(storeId) {
      const record = findStoreDesign(storeId);
      const publication = record?.publications.find((item) => item.id === record.currentPublicationId);
      return publication ? clone(publication) : undefined;
    },
    listProducts(storeSlug) {
      if (!storeSlug) return state.products;
      const store = storeForSlug(storeSlug);
      return store ? state.products.filter((product) => product.storeId === store.id) : [];
    },
    replaceCatalog(storeId, products) {
      state.products = [
        ...state.products.filter((product) => product.storeId !== storeId),
        ...products.map((product) => clone(product)),
      ];
      commit();
    },
    getProduct: (id) => state.products.find((product) => product.id === id),
    getProductBySlug: (storeId, slug) => state.products.find((product) => product.storeId === storeId && product.slug === slug),
    getVariant: findVariant,
    saveProduct(product) {
      const id = product.id || `product-${crypto.randomUUID()}`;
      const normalized: Product = {
        ...product,
        id,
        slug: slugify(product.slug || product.name),
        variants: (product.variants ?? []).map((variant, index) => ({ ...variant, id: variant.id || `${id}-variant-${index + 1}` })),
        options: product.options ?? [],
        additionalCategoryIds: product.additionalCategoryIds ?? [],
        collectionIds: product.collectionIds ?? [],
      };
      const index = state.products.findIndex((item) => item.id === id);
      if (index >= 0) state.products[index] = normalized;
      else state.products.unshift(normalized);
      commit();
      return normalized;
    },
    getCategories: (storeId) => clone((state.categories ?? []).filter((category) => category.storeId === storeId)),
    createCategory(input) {
      const name = input.name.trim();
      const slug = slugify(input.slug || name);
      if (!name) throw new Error("CATEGORY_NAME_REQUIRED");
      if ((state.categories ?? []).some((item) => item.storeId === input.storeId && item.parentId === input.parentId && (item.slug === slug || item.name.trim().toLowerCase() === name.toLowerCase()))) throw new Error("CATEGORY_DUPLICATE");
      if (input.parentId && !(state.categories ?? []).some((item) => item.id === input.parentId && item.storeId === input.storeId)) throw new Error("CATEGORY_PARENT_NOT_FOUND");
      const category: Category = { id: `category-${crypto.randomUUID()}`, storeId: input.storeId, name, slug, ...(input.parentId ? { parentId: input.parentId } : {}) };
      state.categories.push(category); commit(); return clone(category);
    },
    getBrands: (storeId) => clone((state.brands ?? []).filter((brand) => brand.storeId === storeId)),
    createBrand(input) {
      const name = input.name.trim();
      const slug = slugify(input.slug || name);
      if (!name) throw new Error("BRAND_NAME_REQUIRED");
      if ((state.brands ?? []).some((item) => item.storeId === input.storeId && (item.slug === slug || item.name.trim().toLowerCase() === name.toLowerCase()))) throw new Error("BRAND_DUPLICATE");
      const brand: Brand = { ...input, id: `brand-${crypto.randomUUID()}`, name, slug };
      state.brands.push(brand); commit(); return clone(brand);
    },
    getCollections: (storeId) => clone((state.collections ?? []).filter((collection) => collection.storeId === storeId)),
    createCollection(input) {
      const name = input.name.trim();
      const slug = slugify(input.slug || name);
      if (!name) throw new Error("COLLECTION_NAME_REQUIRED");
      if ((state.collections ?? []).some((item) => item.storeId === input.storeId && (item.slug === slug || item.name.trim().toLowerCase() === name.toLowerCase()))) throw new Error("COLLECTION_DUPLICATE");
      const collection: Collection = { id: `collection-${crypto.randomUUID()}`, storeId: input.storeId, name, slug };
      state.collections.push(collection); commit(); return clone(collection);
    },
    getCategoryOptionDefinitions: (categoryId) => {
      const category = state.categories.find((item) => item.id === categoryId);
      return clone((state.categoryOptionDefinitions ?? []).filter((item) => item.categoryId === categoryId && (!category || item.storeId === category.storeId)));
    },
    createCategoryOptionDefinition(input) {
      const category = state.categories.find((item) => item.id === input.categoryId);
      if (!category || category.storeId !== input.storeId) throw new Error("CATEGORY_NOT_FOUND");
      const definition: CategoryOptionDefinition = { ...input, id: `category-option-${crypto.randomUUID()}` };
      state.categoryOptionDefinitions.push(definition); commit(); return clone(definition);
    },
    updateCategoryOptionDefinition(id, patch) {
      const index = state.categoryOptionDefinitions.findIndex((item) => item.id === id);
      if (index < 0) throw new Error("CATEGORY_OPTION_DEFINITION_NOT_FOUND");
      state.categoryOptionDefinitions[index] = { ...state.categoryOptionDefinitions[index], ...patch };
      commit(); return clone(state.categoryOptionDefinitions[index]);
    },
    deleteCategoryOptionDefinition(id) {
      const before = state.categoryOptionDefinitions.length;
      state.categoryOptionDefinitions = state.categoryOptionDefinitions.filter((item) => item.id !== id);
      if (state.categoryOptionDefinitions.length === before) throw new Error("CATEGORY_OPTION_DEFINITION_NOT_FOUND");
      commit();
    },
    getRecentCategoryIds: (storeId) => [...(state.recentCategoryIdsByStore?.[storeId] ?? [])],
    recordRecentCategory(storeId, categoryId) {
      if (!state.categories.some((category) => category.id === categoryId && category.storeId === storeId)) return [];
      const existing = state.recentCategoryIdsByStore?.[storeId] ?? [];
      const ids = [categoryId, ...existing.filter((id) => id !== categoryId)].slice(0, 5);
      state.recentCategoryIdsByStore = { ...(state.recentCategoryIdsByStore ?? {}), [storeId]: ids };
      commit();
      return [...ids];
    },
    archiveProduct(id) {
      const product = state.products.find((item) => item.id === id);
      if (!product) throw new Error("PRODUCT_NOT_FOUND");
      product.archived = true;
      product.published = false;
      commit();
    },
    listOrders(storeId) {
      const orders = storeId ? state.orders.filter((order) => order.storeId === storeId) : state.orders;
      return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    getOrder: (id) => state.orders.find((order) => order.id === id),
    listCustomers(storeId) {
      return storeId ? state.customers.filter((customer) => customer.storeId === storeId) : state.customers;
    },
    createCart(storeSlug) {
      const store = storeForSlug(storeSlug);
      if (!store) throw new Error("STORE_NOT_FOUND");
      const existing = state.carts.find((cart) => cart.storeId === store.id);
      if (existing) return existing;
      const cart: Cart = { id: `cart-${crypto.randomUUID()}`, storeId: store.id, items: [], createdAt: new Date().toISOString() };
      state.carts.push(cart);
      commit();
      return cart;
    },
    getCartForStore(storeSlug) {
      const store = storeForSlug(storeSlug);
      return store ? state.carts.find((cart) => cart.storeId === store.id) : undefined;
    },
    updateCartItem(cartId, variantId, quantity, configurationSelections = [], unitPriceMinor) {
      const cart = state.carts.find((item) => item.id === cartId);
      if (!cart) throw new Error("CART_NOT_FOUND");
      if (!findVariant(variantId)) throw new Error("VARIANT_NOT_FOUND");
      const lineKey = createCartConfigurationKey(variantId, configurationSelections);
      const existing = cart.items.find((item) => createCartConfigurationKey(item.variantId, item.configurationSelections) === lineKey);
      if (quantity <= 0) cart.items = cart.items.filter((item) => item.variantId !== variantId);
      else if (existing) existing.quantity = quantity;
      else cart.items.push({ variantId, quantity, configurationSelections, unitPriceMinor });
      commit();
      return cart;
    },
    reset() {
      state = createSeedState();
      storage.removeItem(STORAGE_KEY);
      commit();
    }
  };
}
