const reserved = new Set(["products", "collections", "search", "cart", "blogs"]);

export function isReservedStorefrontPath(value: string): boolean {
  return reserved.has(value.trim().toLowerCase());
}
