import type { CustomerInput } from "./domain";
import { createRepository, type StorageLike } from "./repository";

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

const customer: CustomerInput = {
  name: "Nina Shah",
  email: "nina@example.com",
  phone: "+91 90000 00000",
  address: { line1: "4 Lake View", city: "Bengaluru", region: "Karnataka", postalCode: "560001", country: "India" }
};

describe("shop repository", () => {
  it("persists product changes across repository instances", () => {
    const storage = memoryStorage();
    const first = createRepository(storage);
    const product = first.getProduct("product-vanilla-cake")!;
    first.saveProduct({ ...product, name: "Vanilla Party Cake" });

    expect(createRepository(storage).getProduct(product.id)?.name).toBe("Vanilla Party Cake");
  });

  it("prices checkout from live variants and snapshots the purchased item", async () => {
    const repo = createRepository(memoryStorage());
    const cart = repo.createCart("sweet-bakes");
    repo.updateCartItem(cart.id, "vanilla-cake", 2);

    const order = await repo.checkout({ cartId: cart.id, customer });

    expect(order.paymentStatus).toBe("PAID");
    expect(order.items[0]).toMatchObject({ productName: "Vanilla Celebration Cake", unitPriceMinor: 149900, quantity: 2 });
    expect(order.subtotalMinor).toBe(299800);
    expect(repo.getVariant("vanilla-cake")?.stock).toBe(7);
  });

  it("rejects a cart quantity above live stock", async () => {
    const repo = createRepository(memoryStorage());
    const cart = repo.createCart("sweet-bakes");
    repo.updateCartItem(cart.id, "berry-cloud", 4);

    await expect(repo.checkout({ cartId: cart.id, customer })).rejects.toThrow("OUT_OF_STOCK");
  });

  it("enforces state transitions and restores inventory once on cancellation", async () => {
    const repo = createRepository(memoryStorage());
    const cart = repo.createCart("sweet-bakes");
    repo.updateCartItem(cart.id, "lemon-tart", 1);
    const order = await repo.checkout({ cartId: cart.id, customer });

    expect(() => repo.transitionOrder(order.id, "DELIVERED")).toThrow("INVALID_ORDER_TRANSITION");
    repo.transitionOrder(order.id, "CANCELLED");
    expect(repo.getVariant("lemon-tart")?.stock).toBe(7);
    expect(() => repo.transitionOrder(order.id, "CANCELLED")).toThrow("INVALID_ORDER_TRANSITION");
    expect(repo.getVariant("lemon-tart")?.stock).toBe(7);
  });
});
