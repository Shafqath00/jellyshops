import { resolveMediaUrls } from "@/lib/media-urls";
import type { MenuItem, NavigationMenu } from "./api/client";

const MEDIA_PATH = "/api/public/media/";

/** Menus as the Navigation page shows them: uploaded photos get the API's full address so they display. */
export function menuWithShownPhotos(menu: NavigationMenu, apiOrigin: string): NavigationMenu {
  return { ...menu, items: resolveMediaUrls(menu.items, apiOrigin) };
}

/**
 * Menu items as they are saved: an uploaded photo goes back to its API path ("/api/public/media/…"), so the
 * saved menu does not depend on the address of the API it was uploaded through. Other links are untouched.
 */
export function menuItemsForSaving(items: MenuItem[]): MenuItem[] {
  return items.map((item) => {
    const url = item.image?.url;
    const start = url ? url.indexOf(MEDIA_PATH) : -1;
    const image = item.image && url && start > 0 ? { ...item.image, url: url.slice(start) } : item.image;
    return { ...item, ...(image ? { image } : {}), children: menuItemsForSaving(item.children) };
  });
}
