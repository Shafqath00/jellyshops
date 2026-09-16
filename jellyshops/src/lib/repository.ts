import { migrateStoreDesignDocument, type StoreDesignDocument } from "@jelly/storefront-schema";
import { validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { Cart, Customer, Order, Product, ProductVariant, ShopState, Store, StoreDesignPublication, StoreDesignRecord } from "./domain";
import { slugify } from "./domain";
import { createSeedState } from "./seed";

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
  getProduct(id: string): Product | undefined;
  getProductBySlug(storeId: string, slug: string): Product | undefined;
  getVariant(id: string): ProductVariant | undefined;
  saveProduct(product: Product): Product;
  archiveProduct(id: string): void;
  listOrders(storeId?: string): Order[];
  getOrder(id: string): Order | undefined;
  listCustomers(storeId?: string): Customer[];
  createCart(storeSlug: string): Cart;
  getCartForStore(storeSlug: string): Cart | undefined;
  updateCartItem(cartId: string, variantId: string, quantity: number): Cart;
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

function addMissingStoreDesigns(state: ShopState): ShopState {
  const existing = Array.isArray(state.storeDesigns) ? state.storeDesigns : [];
  return {
    ...state,
    storeDesigns: state.stores.map((store) => existing.find((record) => record.storeId === store.id) ?? {
      storeId: store.id,
      draftDocument: migrateStoreDesignDocument(createSeedState().storeDesigns.find((record) => record.storeId === store.id)!.draftDocument),
      draftRevision: 1,
      publications: []
    })
  };
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

export function createRepository(storage: StorageLike): ShopRepository {
  let state = readState(storage);
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
    getProduct: (id) => state.products.find((product) => product.id === id),
    getProductBySlug: (storeId, slug) => state.products.find((product) => product.storeId === storeId && product.slug === slug),
    getVariant: findVariant,
    saveProduct(product) {
      const id = product.id || `product-${crypto.randomUUID()}`;
      const normalized: Product = {
        ...product,
        id,
        slug: slugify(product.slug || product.name),
        variants: product.variants.map((variant, index) => ({ ...variant, id: variant.id || `${id}-variant-${index + 1}` }))
      };
      const index = state.products.findIndex((item) => item.id === id);
      if (index >= 0) state.products[index] = normalized;
      else state.products.unshift(normalized);
      commit();
      return normalized;
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
    updateCartItem(cartId, variantId, quantity) {
      const cart = state.carts.find((item) => item.id === cartId);
      if (!cart) throw new Error("CART_NOT_FOUND");
      if (!findVariant(variantId)) throw new Error("VARIANT_NOT_FOUND");
      const existing = cart.items.find((item) => item.variantId === variantId);
      if (quantity <= 0) cart.items = cart.items.filter((item) => item.variantId !== variantId);
      else if (existing) existing.quantity = quantity;
      else cart.items.push({ variantId, quantity });
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
