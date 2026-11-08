import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { PRODUCT_CARD_PARTS, StorefrontProductCard } from "./product-card";

const product = { name: "Linen shirt", href: "/shop/products/linen-shirt", imageUrl: "", price: "£40.00" };
const badges = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>(".jelly-product-card-badge")].map((badge) => [badge.textContent, badge.dataset.badge ?? null]);

it("adds a sale badge (shown by the theme setting) to discounted products without their own badge", () => {
  expect(badges(render(<StorefrontProductCard product={{ ...product, compareAtPrice: "£55.00" }} />).container)).toEqual([["Sale", "sale"]]);
  expect(badges(render(<StorefrontProductCard product={{ ...product, compareAtPrice: "£55.00", badge: "New" }} />).container)).toEqual([["New", null]]);
  expect(badges(render(<StorefrontProductCard product={product} />).container)).toEqual([]);
});

it("is built from the fixed set of parts, in order", () => {
  const { container } = render(<StorefrontProductCard product={{ ...product, vendor: "Jelly Basics", compareAtPrice: "£55.00", saving: "£15.00", chip: "New colours", swatches: [{ label: "Sage", color: "#9aa48f" }] }} />);
  expect([...container.querySelectorAll<HTMLElement>("[data-card-part]")].map((part) => part.dataset.cardPart)).toEqual([...PRODUCT_CARD_PARTS]);
  // Parts without data are left out instead of drawn empty.
  const bare = render(<StorefrontProductCard product={product} />).container;
  expect([...bare.querySelectorAll<HTMLElement>("[data-card-part]")].map((part) => part.dataset.cardPart)).toEqual(["media", "title", "price", "button"]);
});

it("draws up to five safe colour swatches with a spoken summary", () => {
  const swatches = [
    { label: "Sage", color: "#9aa48f" }, { label: "Bad", color: "red;}" }, { label: "Linen", image: "https://cdn.example.com/linen.jpg" },
    { label: "Script", image: "javascript:alert(1)" }, { label: "A", color: "#111111" }, { label: "B", color: "#222222" }, { label: "C", color: "#333333" }, { label: "D", color: "#444444" },
  ];
  const { container } = render(<StorefrontProductCard product={{ ...product, swatches, moreSwatches: 2 }} />);
  const dots = [...container.querySelectorAll<HTMLElement>(".jelly-product-card-swatch")];
  expect(dots.map((dot) => dot.title)).toEqual(["Sage", "Linen", "A", "B", "C"]);
  expect(dots[0].style.background).toContain("rgb(154, 164, 143)");
  expect(dots[1].style.backgroundImage).toContain("https://cdn.example.com/linen.jpg");
  expect(container.querySelector(".jelly-product-card-swatches")).toHaveTextContent("Available in 7 colours");
  expect(container.querySelector(".jelly-product-card-swatch-more")).toHaveTextContent("+2");
});

it("is the only product card markup: every product list uses StorefrontProductCard", () => {
  const app = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return ["node_modules", "dist", ".next"].includes(entry.name) ? [] : files(path);
    return /\.tsx$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });
  const own = [...files(join(app, "src")), ...files(join(app, "packages/storefront-renderer/src"))]
    .filter((file) => /className="jelly-product-card(-media)?"/.test(readFileSync(file, "utf8")));
  expect(own).toEqual([]);
});
