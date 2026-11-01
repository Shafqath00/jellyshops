import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MenuList } from "./sections/header";
import { createCollectionLinks } from "./runtime-context";

afterEach(cleanup);
it("looks up menu handles in ID-keyed snapshots and uses current collection handles", () => {
  const links = createCollectionLinks("store-a", "my shop", [{ id: "uuid", storeId: "store-a", slug: "new beds" }, { id: "other", storeId: "store-b", slug: "private" }]);
  render(<MenuList handle="main" context={{ mode: "published", storeSlug: "my shop", collectionLinks: links, commerce: { getProducts: async () => [] }, menus: {
    "menu-uuid": { id: "menu-uuid", handle: "main", items: [
      { id: "a", label: "Beds", target: { kind: "collection", resourceId: "uuid" }, children: [] },
      { id: "b", label: "Missing", target: { kind: "collection", resourceId: "missing" }, children: [] },
      { id: "c", label: "Other store", target: { kind: "collection", resourceId: "other" }, children: [] },
    ] },
  } }} />);
  expect(screen.getByRole("link", { name: "Beds" })).toHaveAttribute("href", "/my%20shop/collections/new%20beds");
  expect(screen.queryByRole("link", { name: "Missing" })).toBeNull();
  expect(screen.queryByRole("link", { name: "Other store" })).toBeNull();
});
it("uses resolved content links and preserves a stored anchor fragment", () => {
  render(<MenuList handle="main" context={{ mode: "published", storeSlug: "new", commerce: { getProducts: async () => [] }, resourceLinks: { "page:uuid": "/new/about" }, menus: { m: { id: "m", handle: "main", items: [
    { id: "a", label: "About", target: { kind: "page", resourceId: "uuid" }, children: [] },
    { id: "b", label: "Details", target: { kind: "anchor", anchor: "#details" }, children: [] },
  ] } } }} />);
  expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/new/about");
  expect(screen.getByRole("link", { name: "Details" })).toHaveAttribute("href", "#details");
});
