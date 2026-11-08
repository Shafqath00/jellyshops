export function mergeWishlistIds(...lists: string[][]): string[] {
  return [...new Set(lists.flat().filter((id) => typeof id === "string" && id.length > 0 && id.length <= 160))].slice(0, 100);
}
export function readGuestWishlist(storeId: string): string[] {
  try { const data: unknown = JSON.parse(localStorage.getItem(`jelly:wishlist:${storeId}`) ?? "[]"); return Array.isArray(data) ? mergeWishlistIds(data) : []; } catch { return []; }
}
export function writeGuestWishlist(storeId: string, ids: string[]): void {
  localStorage.setItem(`jelly:wishlist:${storeId}`, JSON.stringify(mergeWishlistIds(ids)));
  window.dispatchEvent(new Event("jelly:wishlist"));
}
