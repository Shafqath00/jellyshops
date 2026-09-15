export type MenuTarget =
  | { kind: "home" }
  | { kind: "search" }
  | { kind: "product" | "collection" | "page" | "blog" | "article"; resourceId: string }
  | { kind: "external"; url: string }
  | { kind: "anchor"; anchor: string };

export interface MenuItem {
  id: string;
  label: string;
  target: MenuTarget;
  children: MenuItem[];
}

export interface NavigationMenu {
  id: string;
  storeId: string;
  revision: number;
  name: string;
  handle: string;
  items: MenuItem[];
}

export interface NavigationMutationResult {
  menu: NavigationMenu;
  generation: number;
}

export interface NavigationApi {
  listMenus(storeId: string): Promise<NavigationMenu[]>;
  createMenu(storeId: string, input: { name: string; handle: string; items: MenuItem[] }): Promise<NavigationMutationResult>;
  updateMenu(storeId: string, menuId: string, expectedRevision: number, patch: { name?: string; handle?: string; items?: MenuItem[] }): Promise<NavigationMutationResult>;
}

export function createNavigationApi({
  baseUrl,
  token,
  fetch: fetcher = fetch,
}: {
  baseUrl: string;
  token: string;
  fetch?: typeof fetch;
}): NavigationApi {
  const origin = baseUrl.replace(/\/$/, "");
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetcher(`${origin}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });
    if (!response.ok) throw new Error(`Navigation request failed (${response.status})`);
    return await response.json() as T;
  };
  const base = (storeId: string) => `/api/stores/${encodeURIComponent(storeId)}/storefront/menus`;

  return {
    listMenus: (storeId) => request(base(storeId)),
    createMenu: (storeId, input) => request(base(storeId), { method: "POST", body: JSON.stringify(input) }),
    updateMenu: (storeId, menuId, expectedRevision, patch) => request(`${base(storeId)}/${encodeURIComponent(menuId)}`, {
      method: "PATCH",
      body: JSON.stringify({ expectedRevision, ...patch }),
    }),
  };
}
