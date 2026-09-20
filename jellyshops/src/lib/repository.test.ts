import { createRepository, type StorageLike } from "./repository";

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

describe("shop repository", () => {
  it("supports an empty runtime catalog before backend hydration", () => {
    const repo = createRepository(memoryStorage(), { runtime: true });
    expect(repo.listProducts("sweet-bakes")).toEqual([]);
    expect(repo.getStoreBySlug("sweet-bakes")?.name).toBe("Sweet Bakes");
  });

  it("persists product changes across repository instances", () => {
    const storage = memoryStorage();
    const first = createRepository(storage);
    const product = first.getProduct("product-vanilla-cake")!;
    first.saveProduct({ ...product, name: "Vanilla Party Cake" });

    expect(createRepository(storage).getProduct(product.id)?.name).toBe("Vanilla Party Cake");
  });

  it("keeps checkout authority on the server and only mutates local cart state", () => {
    const repo = createRepository(memoryStorage());
    const cart = repo.createCart("sweet-bakes");
    repo.updateCartItem(cart.id, "vanilla-cake", 2);

    expect("checkout" in repo).toBe(false);
    expect("transitionOrder" in repo).toBe(false);
    expect(repo.getCartForStore("sweet-bakes")?.items).toEqual([{ variantId: "vanilla-cake", quantity: 2 }]);
    expect(repo.getVariant("vanilla-cake")?.stock).toBe(9);
    expect(repo.listOrders("store-sweet-bakes")).toHaveLength(2);
  });

  it("scopes metadata to stores and rejects duplicate siblings", () => {
    const repo = createRepository(memoryStorage());
    const first = repo.createCategory({ storeId: "store-sweet-bakes", name: "Seasonal" });
    expect(repo.getCategories("store-sweet-bakes")).toContainEqual(first);
    expect(repo.getCategories("store-bloom-home")).not.toContainEqual(first);
    expect(() => repo.createCategory({ storeId: "store-sweet-bakes", name: " seasonal " })).toThrow("CATEGORY_DUPLICATE");
    const other = repo.createCategory({ storeId: "store-sweet-bakes", name: "Seasonal", parentId: first.id });
    expect(other.parentId).toBe(first.id);
  });

  it("manages category option definitions", () => {
    const repo = createRepository(memoryStorage());
    const definition = repo.createCategoryOptionDefinition({ storeId: "store-sweet-bakes", categoryId: "category-cakes", name: "Size", optionKind: "variant", displayType: "buttons", required: false, position: 0 });
    expect(repo.getCategoryOptionDefinitions("category-cakes")).toContainEqual(definition);
    const updated = repo.updateCategoryOptionDefinition(definition.id, { name: "Cake size", required: true });
    expect(updated.name).toBe("Cake size");
    repo.deleteCategoryOptionDefinition(definition.id);
    expect(repo.getCategoryOptionDefinitions("category-cakes")).toEqual([]);
  });

  it("normalizes legacy unscoped metadata and option money", () => {
    const storage = memoryStorage();
    const legacy = createRepository(storage).getState();
    legacy.categories = [{ id: "legacy-category", name: "Cakes", slug: "cakes" } as typeof legacy.categories[number]];
    legacy.brands = [{ id: "legacy-brand", name: "Old Brand" } as typeof legacy.brands[number]];
    legacy.products[0].options = [{ id: "legacy-option", name: "Size", type: "configuration", display: "buttons", required: false, position: 0, values: [{ id: "legacy-value", label: "Large", priceAdjustment: 50, position: 0 } as never] }];
    storage.setItem("jelly-shop-state-v1", JSON.stringify(legacy));
    const reloaded = createRepository(storage);
    expect(reloaded.getCategories("store-sweet-bakes")).toHaveLength(1);
    expect(reloaded.getProduct(legacy.products[0].id)?.options?.[0].values[0].priceAdjustmentMinor).toBe(5000);
  });

  it("stores recent categories per store with a five-item limit", () => {
    const repo = createRepository(memoryStorage());
    for (let index = 0; index < 6; index += 1) repo.createCategory({ storeId: "store-sweet-bakes", name: `Recent ${index}` });
    const ids = repo.getCategories("store-sweet-bakes").slice(-6).map((category) => category.id);
    ids.forEach((id) => repo.recordRecentCategory("store-sweet-bakes", id));
    expect(repo.getRecentCategoryIds("store-sweet-bakes")).toHaveLength(5);
    expect(repo.getRecentCategoryIds("store-bloom-home")).toEqual([]);
    repo.recordRecentCategory("store-sweet-bakes", ids[0]);
    expect(repo.getRecentCategoryIds("store-sweet-bakes")[0]).toBe(ids[0]);
  });
});
