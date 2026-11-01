import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { StorefrontProductCard } from "./product-card";

const product = { name: "Linen shirt", href: "/shop/products/linen-shirt", imageUrl: "", price: "£40.00" };
const badges = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>(".jelly-product-card-badge")].map((badge) => [badge.textContent, badge.dataset.badge ?? null]);

it("adds a sale badge (shown by the theme setting) to discounted products without their own badge", () => {
  expect(badges(render(<StorefrontProductCard product={{ ...product, compareAtPrice: "£55.00" }} />).container)).toEqual([["Sale", "sale"]]);
  expect(badges(render(<StorefrontProductCard product={{ ...product, compareAtPrice: "£55.00", badge: "New" }} />).container)).toEqual([["New", null]]);
  expect(badges(render(<StorefrontProductCard product={product} />).container)).toEqual([]);
});
