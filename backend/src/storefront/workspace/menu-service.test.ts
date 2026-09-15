import { describe, expect, it, vi } from "vitest";
import type { WorkspaceTransaction } from "./concurrency.js";
import { MenuService } from "./menu-service.js";
import type { MenuRepository } from "./repositories/menu-repository.js";

const tx = {} as WorkspaceTransaction;

function setup(resourceExists = true) {
  let generation = 0;
  const repository: MenuRepository = {
    getMenu: vi.fn(async () => null),
    listMenus: vi.fn(async () => []),
    resourceExists: vi.fn(async () => resourceExists),
    createMenu: vi.fn(async (_tx, input) => ({
      id: "menu-1", revision: 0, createdAt: new Date(0), updatedAt: new Date(0), ...structuredClone(input),
    })),
    updateMenu: vi.fn(async (_tx, storeId, _id, _revision, patch) => ({
      id: "menu-1", storeId, revision: 1, name: patch.name ?? "Main", handle: patch.handle ?? "main",
      items: structuredClone(patch.items ?? []), createdAt: new Date(0), updatedAt: new Date(1),
    })),
  };
  const coordinator = {
    async run<T>(_storeId: string, operation: (transaction: WorkspaceTransaction) => Promise<T>) {
      const result = await operation(tx);
      generation += 1;
      return { result, generation };
    },
  };
  return { repository, service: new MenuService(repository, coordinator) };
}

describe("MenuService", () => {
  it("preserves nested internal targets as stable resource IDs", async () => {
    const { service } = setup();
    const result = await service.createMenu("store-a", {
      name: "Main",
      handle: "main",
      items: [{
        id: "shop",
        label: "Shop",
        target: { kind: "collection", resourceId: "collection-1" },
        children: [{
          id: "featured",
          label: "Featured",
          target: { kind: "product", resourceId: "product-1" },
          children: [],
        }],
      }],
    });

    expect(result.menu.items[0].target).toEqual({ kind: "collection", resourceId: "collection-1" });
    expect(result.menu.items[0].children[0].target).toEqual({ kind: "product", resourceId: "product-1" });
  });

  it("rejects an internal target that does not belong to the store", async () => {
    const { service } = setup(false);

    await expect(service.createMenu("store-a", {
      name: "Main",
      handle: "main",
      items: [{
        id: "other-store-product",
        label: "Other",
        target: { kind: "product", resourceId: "product-b" },
        children: [],
      }],
    })).rejects.toThrow(/belong to this store/i);
  });

  it("accepts external URLs and anchors without resource lookup", async () => {
    const { service, repository } = setup();

    await service.createMenu("store-a", {
      name: "Footer",
      handle: "footer",
      items: [
        { id: "docs", label: "Docs", target: { kind: "external", url: "https://example.com/docs" }, children: [] },
        { id: "faq", label: "FAQ", target: { kind: "anchor", anchor: "#faq" }, children: [] },
      ],
    });

    expect(repository.resourceExists).not.toHaveBeenCalled();
  });
});
