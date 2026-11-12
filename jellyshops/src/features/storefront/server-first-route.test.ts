import type { RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import { SHOP_ALL_COLLECTION_ID } from "@jelly/storefront-renderer";
import { describe, expect, it, vi } from "vitest";
import { bindingKey } from "./dynamic-settings";
import { SHOP_ALL_COLLECTION } from "./page-context-loaders";
import {
  buildStorefrontRoute,
  deserializeRouteValues,
  loadStorefrontRouteValues,
  resolveStorefrontRoute,
  serializeRouteValues,
  type PublicStorefrontResource,
} from "./resource-loader";

const titleBinding = { kind: "resource_field" as const, resource: "product" as const, field: "title" };

function snapshot(): RuntimeStorefrontSnapshotV4 {
  const copy = (id: string, settings: Record<string, unknown>) => ({ kind: "inline", section: { id, type: "rich-text", enabled: true, settings, blocks: [] } });
  return {
    schemaVersion: 4,
    storeId: "store-1",
    sourceGeneration: 1,
    compilerVersion: "test",
    registryManifestHash: "hash",
    theme: { presetId: "minimal", settings: {}, artifactId: null },
    templates: {
      "product-default": { id: "product-default", type: "product", handle: "default", layout: { sections: [copy("plain", { heading: "Plain" })] } },
      "product-bound": { id: "product-bound", type: "product", handle: "bound", layout: { sections: [copy("bound", { heading: { kind: "dynamic", binding: titleBinding, fallback: "Fallback title" } })] } },
      cart: { id: "cart", type: "cart", handle: "default", layout: { sections: [] } },
      "not-found": { id: "not-found", type: "not-found", handle: "default", layout: { sections: [] } },
    },
    globalSections: {},
    menus: {},
    templateDefaults: { product: "product-default", cart: "cart", "not-found": "not-found" },
    assignments: [{ resourceType: "product", resourceId: "bound-product", templateId: "product-bound" }],
    dependencies: { edges: [] },
  };
}

const product = (id: string): PublicStorefrontResource => ({ type: "product", id, handle: id, visible: true, data: {} });

describe("server-first storefront routes", () => {
  it("lays a product page out synchronously with the template assigned to it", () => {
    const route = buildStorefrontRoute(snapshot(), { type: "product", handle: "bound-product" }, product("bound-product"));
    expect(route.status).toBe("ready");
    if (route.status !== "ready") return;
    expect(route.template.id).toBe("product-bound");
    expect(route.context).toEqual({ pageType: "product", resource: product("bound-product") });
  });

  it("uses custom-field values looked up earlier, and the fallback without them", () => {
    const values = new Map([[bindingKey(titleBinding), "Linden ottoman bed"]]);
    const withValues = buildStorefrontRoute(snapshot(), { type: "product", handle: "bound-product" }, product("bound-product"), values);
    const without = buildStorefrontRoute(snapshot(), { type: "product", handle: "bound-product" }, product("bound-product"));
    expect(withValues.status === "ready" && withValues.sections[0]?.settings.heading).toBe("Linden ottoman bed");
    expect(without.status === "ready" && without.sections[0]?.settings.heading).toBe("Fallback title");
  });

  it("reports a hidden or missing resource as not found", () => {
    expect(buildStorefrontRoute(snapshot(), { type: "product", handle: "x" }, null)).toEqual({ status: "not-found", reason: "resource" });
    expect(buildStorefrontRoute(snapshot(), { type: "product", handle: "x" }, { ...product("x"), visible: false })).toEqual({ status: "not-found", reason: "resource" });
  });

  it("lays out the bag and 404 pages from the store's defaults", () => {
    const cart = buildStorefrontRoute(snapshot(), { type: "cart" }, null);
    const missing = buildStorefrontRoute(snapshot(), { type: "not-found" }, null);
    expect(cart.status === "ready" && cart.context.pageType).toBe("cart");
    expect(missing.status === "ready" && missing.context.pageType).toBe("not-found");
  });

  it("asks for values only when the template has custom-field connections, and survives a failed lookup", async () => {
    const loader = vi.fn(async () => new Map([[bindingKey(titleBinding), "From server"]]));
    expect(await loadStorefrontRouteValues(snapshot(), { type: "product", handle: "plain" }, product("plain"), loader)).toEqual(new Map());
    expect(loader).not.toHaveBeenCalled();
    const values = await loadStorefrontRouteValues(snapshot(), { type: "product", handle: "bound-product" }, product("bound-product"), loader);
    expect(loader).toHaveBeenCalledWith({ storeId: "store-1", bindings: [titleBinding], resource: { type: "product", id: "bound-product" } });
    expect(values.get(bindingKey(titleBinding))).toBe("From server");
    const failing = vi.fn(async () => { throw new Error("down"); });
    expect(await loadStorefrontRouteValues(snapshot(), { type: "product", handle: "bound-product" }, product("bound-product"), failing)).toEqual(new Map());
  });

  it("gives the same page from the async resolver and from server values passed to the client", async () => {
    const loader = async () => new Map([[bindingKey(titleBinding), "Same"]]);
    const resource = product("bound-product");
    const resolved = await resolveStorefrontRoute(snapshot(), { type: "product", handle: "bound-product" }, { findByHandle: async () => resource, findById: async () => resource }, loader);
    const travelled = deserializeRouteValues(JSON.parse(JSON.stringify(serializeRouteValues(await loader()))));
    expect(buildStorefrontRoute(snapshot(), { type: "product", handle: "bound-product" }, resource, travelled)).toEqual(resolved);
  });

  it("keeps the Shop all collection id in step with the renderer", () => {
    expect(SHOP_ALL_COLLECTION.id).toBe(SHOP_ALL_COLLECTION_ID);
  });
});
