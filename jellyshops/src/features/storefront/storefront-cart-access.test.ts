import { expect, it } from "vitest";
import { variantSelections } from "./storefront-cart-access";

it("records a variant's stock choices (Size) on the bag line, and nothing for plain products", () => {
  const product = { options: [
    { id: "size", name: "Size", type: "variant", required: true, values: [] },
    { id: "extras", name: "Extras", type: "addon", required: false, values: [] },
  ] } as never;
  expect(variantSelections(product, { id: "v", options: { size: "size-king" } } as never)).toEqual([{ optionId: "size", valueId: "size-king" }]);
  expect(variantSelections({ options: [] } as never, { id: "v" } as never)).toEqual([]);
});
