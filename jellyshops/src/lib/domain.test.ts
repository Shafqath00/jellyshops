import { canTransitionOrder, formatMoney } from "./domain";
import { createSeedState } from "./seed";

describe("commerce domain", () => {
  it("formats integer minor units in the requested currency", () => {
    expect(formatMoney(49999, "INR")).toBe("₹499.99");
  });

  it("accepts only explicit order transitions", () => {
    expect(canTransitionOrder("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransitionOrder("DELIVERED", "PENDING")).toBe(false);
    expect(canTransitionOrder("SHIPPED", "CANCELLED")).toBe(false);
  });

  it("seeds a rich demo catalog with distinct stores", () => {
    const state = createSeedState();
    expect(state.stores).toHaveLength(2);
    expect(state.products).toHaveLength(8);
    expect(state.products.some((product) => product.variants.some((variant) => variant.stock <= 3))).toBe(true);
  });
});
