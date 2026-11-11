import { MAX_MENU_DEPTH, normalizeMenuImage } from "@jelly/storefront-schema";
import type { WorkspaceMutationRunner } from "./mutation-runner.js";
import type {
  MenuItem,
  MenuRepository,
  MenuResourceType,
  MenuTarget,
  NavigationMenuRecord,
  UpdateMenuInput,
} from "./repositories/menu-repository.js";

export interface MenuMutationResult {
  menu: NavigationMenuRecord;
  generation: number;
}

function normalizeText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function normalizeHandle(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(normalized)) {
    throw new Error("Menu handle must use lowercase letters, numbers, hyphens, or underscores");
  }
  return normalized;
}

function normalizeTarget(target: MenuTarget): MenuTarget {
  switch (target.kind) {
    case "home":
    case "search":
      return { kind: target.kind };
    case "external": {
      // A page of this store ("/pages/faq", "/search?q=Beds"); the storefront puts it under the store's address.
      const path = target.url.trim();
      if (path.startsWith("/") && !path.startsWith("//")) {
        if (/[\s\x00-\x1f\x7f\\]/.test(path) || path.length > 500) throw new Error("Menu link path must not contain spaces");
        return { kind: "external", url: path };
      }
      const url = new URL(target.url);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("External menu URL must use http or https");
      }
      return { kind: "external", url: url.toString() };
    }
    case "anchor": {
      const anchor = target.anchor.trim();
      if (!/^#[A-Za-z][A-Za-z0-9_:\-.]*$/.test(anchor)) {
        throw new Error("Menu anchor must be a valid #fragment");
      }
      return { kind: "anchor", anchor };
    }
    default: {
      const resourceId = target.resourceId.trim();
      if (!resourceId) throw new Error("Menu resource id is required");
      return { kind: target.kind, resourceId };
    }
  }
}

function normalizeItems(items: MenuItem[]): MenuItem[] {
  const seen = new Set<string>();
  const visit = (item: MenuItem, depth: number): MenuItem => {
    const id = normalizeText(item.id, "Menu item id");
    if (seen.has(id)) throw new Error(`Duplicate menu item id: ${id}`);
    seen.add(id);
    const children = Array.isArray(item.children) ? item.children : [];
    if (depth >= MAX_MENU_DEPTH && children.length > 0) throw new Error(`Menus can be at most ${MAX_MENU_DEPTH} levels deep`);
    const image = normalizeMenuImage(item.image);
    return {
      id,
      label: normalizeText(item.label, "Menu item label"),
      target: normalizeTarget(item.target),
      ...(image ? { image } : {}),
      children: children.map((child) => visit(child, depth + 1)),
    };
  };
  return items.map((item) => visit(item, 1));
}

function isResourceTarget(target: MenuTarget): target is Extract<MenuTarget, { resourceId: string }> {
  return ["product", "collection", "page", "blog", "article"].includes(target.kind);
}

function collectResourceTargets(items: MenuItem[]): Array<{ type: MenuResourceType; resourceId: string }> {
  const targets: Array<{ type: MenuResourceType; resourceId: string }> = [];
  const visit = (item: MenuItem) => {
    if (isResourceTarget(item.target)) {
      targets.push({ type: item.target.kind, resourceId: item.target.resourceId });
    }
    item.children.forEach(visit);
  };
  items.forEach(visit);
  return targets;
}

export class MenuService {
  constructor(
    private readonly repository: MenuRepository,
    private readonly coordinator: WorkspaceMutationRunner,
  ) {}

  getMenu(storeId: string, id: string) {
    return this.repository.getMenu(storeId, id);
  }

  listMenus(storeId: string) {
    return this.repository.listMenus(storeId);
  }

  async createMenu(
    storeId: string,
    input: { name: string; handle: string; items: MenuItem[] },
  ): Promise<MenuMutationResult> {
    const items = normalizeItems(input.items);
    const mutation = await this.coordinator.run(storeId, async (transaction) => {
      await this.assertResourceTargets(transaction, storeId, items);
      return this.repository.createMenu(transaction, {
        storeId,
        name: normalizeText(input.name, "Menu name"),
        handle: normalizeHandle(input.handle),
        items,
      });
    });
    return { menu: mutation.result, generation: mutation.generation };
  }

  async updateMenu(
    storeId: string,
    id: string,
    expectedRevision: number,
    patch: UpdateMenuInput,
  ): Promise<MenuMutationResult> {
    const normalized: UpdateMenuInput = {
      ...(patch.name !== undefined ? { name: normalizeText(patch.name, "Menu name") } : {}),
      ...(patch.handle !== undefined ? { handle: normalizeHandle(patch.handle) } : {}),
      ...(patch.items !== undefined ? { items: normalizeItems(patch.items) } : {}),
    };
    const mutation = await this.coordinator.run(storeId, async (transaction) => {
      if (normalized.items) await this.assertResourceTargets(transaction, storeId, normalized.items);
      const menu = await this.repository.updateMenu(transaction, storeId, id, expectedRevision, normalized);
      if (!menu) throw new Error("Navigation menu was not found");
      return menu;
    });
    return { menu: mutation.result, generation: mutation.generation };
  }

  private async assertResourceTargets(
    transaction: Parameters<MenuRepository["resourceExists"]>[0],
    storeId: string,
    items: MenuItem[],
  ): Promise<void> {
    for (const target of collectResourceTargets(items)) {
      if (!await this.repository.resourceExists(transaction, storeId, target.type, target.resourceId)) {
        throw new Error(`Menu ${target.type} target does not belong to this store`);
      }
    }
  }
}
