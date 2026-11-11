import { afterEach, expect, it, vi } from "vitest";
import { MAX_RECENTLY_VIEWED, createRecentlyViewedAccess, recordRecentlyViewed } from "./recently-viewed";

afterEach(() => { window.localStorage.clear(); });

it("keeps the newest product first, moves a product seen again and stops at the limit", () => {
  const access = createRecentlyViewedAccess("dreams");
  const listener = vi.fn();
  const stop = access.subscribe(listener);
  recordRecentlyViewed("dreams", "a");
  recordRecentlyViewed("dreams", "b");
  recordRecentlyViewed("dreams", "a");
  expect(access.ids()).toEqual(["a", "b"]);
  expect(access.ids()).toBe(access.ids());
  expect(listener).toHaveBeenCalledTimes(3);
  recordRecentlyViewed("dreams", "a");
  expect(listener).toHaveBeenCalledTimes(3);
  for (let index = 0; index < 20; index += 1) recordRecentlyViewed("dreams", `p${index}`);
  expect(access.ids()).toHaveLength(MAX_RECENTLY_VIEWED);
  expect(access.ids()[0]).toBe("p19");
  stop();
});

it("keeps each store's list apart and ignores broken storage", () => {
  recordRecentlyViewed("one", "x");
  expect(createRecentlyViewedAccess("two").ids()).toEqual([]);
  window.localStorage.setItem("jelly-recent:three", "{not json");
  expect(createRecentlyViewedAccess("three").ids()).toEqual([]);
  window.localStorage.setItem("jelly-recent:four", JSON.stringify(["ok", 5, "", "fine"]));
  expect(createRecentlyViewedAccess("four").ids()).toEqual(["ok", "fine"]);
});
