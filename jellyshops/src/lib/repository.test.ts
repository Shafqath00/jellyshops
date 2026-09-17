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
});
