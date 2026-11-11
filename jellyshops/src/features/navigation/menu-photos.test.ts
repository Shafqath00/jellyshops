import { expect, it } from "vitest";
import { menuItemsForSaving, menuWithShownPhotos } from "./menu-photos";

const menu = { id: "m", storeId: "s", revision: 1, name: "Main", handle: "main", items: [
  { id: "rooms", label: "Rooms", target: { kind: "external" as const, url: "/pages/rooms" }, children: [
    { id: "bed", label: "Bedroom", target: { kind: "home" as const }, image: { url: "/api/public/media/s/1", alt: "Bedroom" }, children: [] },
    { id: "cdn", label: "Living", target: { kind: "home" as const }, image: { url: "https://cdn.example.com/living.webp" }, children: [] },
  ] },
] };

it("shows uploaded photos from the API and saves them back as API paths", () => {
  const shown = menuWithShownPhotos(menu, "http://127.0.0.1:3001");
  expect(shown.items[0].children[0].image?.url).toBe("http://127.0.0.1:3001/api/public/media/s/1");
  expect(shown.items[0].target).toEqual({ kind: "external", url: "/pages/rooms" });
  const saved = menuItemsForSaving(shown.items);
  expect(saved[0].children[0].image).toEqual({ url: "/api/public/media/s/1", alt: "Bedroom" });
  expect(saved[0].children[1].image).toEqual({ url: "https://cdn.example.com/living.webp" });
  expect(saved[0]).not.toHaveProperty("image");
});
