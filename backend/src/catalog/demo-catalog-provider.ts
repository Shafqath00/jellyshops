import type { DemoCatalog, DemoCollection, DemoProduct } from "./types.js";

const productNames = [
  ["strawberry", "Strawberry Jelly"],
  ["blueberry", "Blueberry Jelly"],
  ["mango", "Mango Jelly"],
  ["grape", "Grape Jelly"],
  ["peach", "Peach Jelly"],
  ["raspberry", "Raspberry Jelly"],
  ["orange", "Orange Marmalade"],
  ["apple", "Apple Jelly"],
] as const;

const products: DemoProduct[] = productNames.map(([slug, name], index) => ({
  id: `product-${slug}`,
  slug,
  name,
  imageUrl: `/demo/products/${slug}.svg`,
  priceMinor: 900 + index * 125,
  currency: "USD",
}));

const collections: DemoCollection[] = [
  { id: "collection-fruit", slug: "fruit-favorites", name: "Fruit Favorites", imageUrl: "/demo/collections/fruit.svg", productIds: products.slice(0, 4).map(({ id }) => id) },
  { id: "collection-bright", slug: "bright-flavors", name: "Bright Flavors", imageUrl: "/demo/collections/bright.svg", productIds: [products[2].id, products[4].id, products[6].id, products[7].id] },
  { id: "collection-all", slug: "all-jellies", name: "All Jellies", imageUrl: "/demo/collections/all.svg", productIds: products.map(({ id }) => id) },
];

export function getDemoCatalog(): DemoCatalog {
  return structuredClone({ products, collections });
}
