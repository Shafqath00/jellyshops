import { expect, it } from "vitest";
import { mergeWishlistIds, readGuestWishlist, writeGuestWishlist } from "./wishlist";
it("isolates guest wishlists by store and handles corrupt browser storage", () => {
  writeGuestWishlist("a", ["one", "one", "two"]);
  expect(readGuestWishlist("a")).toEqual(["one", "two"]);
  expect(readGuestWishlist("b")).toEqual([]);
  localStorage.setItem("jelly:wishlist:b", "broken");
  expect(readGuestWishlist("b")).toEqual([]);
  expect(mergeWishlistIds(["one"], ["one", "three"])).toEqual(["one", "three"]);
});
