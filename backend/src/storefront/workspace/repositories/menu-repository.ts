import type { WorkspaceTransaction } from "../concurrency.js";

export type MenuResourceType = "product" | "collection" | "page" | "blog" | "article";

export type MenuTarget =
  | { kind: "home" }
  | { kind: "search" }
  | { kind: MenuResourceType; resourceId: string }
  | { kind: "external"; url: string }
  | { kind: "anchor"; anchor: string };

export interface MenuItem {
  id: string;
  label: string;
  target: MenuTarget;
  children: MenuItem[];
}

export interface NavigationMenuRecord {
  id: string;
  storeId: string;
  revision: number;
  name: string;
  handle: string;
  items: MenuItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMenuInput {
  storeId: string;
  name: string;
  handle: string;
  items: MenuItem[];
}

export interface UpdateMenuInput {
  name?: string;
  handle?: string;
  items?: MenuItem[];
}

export interface MenuRepository {
  getMenu(storeId: string, id: string): Promise<NavigationMenuRecord | null>;
  listMenus(storeId: string): Promise<NavigationMenuRecord[]>;
  resourceExists(
    transaction: WorkspaceTransaction,
    storeId: string,
    type: MenuResourceType,
    resourceId: string,
  ): Promise<boolean>;
  createMenu(transaction: WorkspaceTransaction, input: CreateMenuInput): Promise<NavigationMenuRecord>;
  updateMenu(
    transaction: WorkspaceTransaction,
    storeId: string,
    id: string,
    expectedRevision: number,
    patch: UpdateMenuInput,
  ): Promise<NavigationMenuRecord | null>;
}
