import { renderHook, waitFor } from "@testing-library/react";
import type { RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import { expect, it, vi } from "vitest";
import { bindingKey } from "./dynamic-settings";
import { useChromeBindingValues } from "./use-chrome-binding-values";

const binding = { kind: "metafield" as const, resource: "store" as const, namespace: "custom", key: "promo" };
const snapshot = (): RuntimeStorefrontSnapshotV4 => ({
  schemaVersion: 4, storeId: "store-1", sourceGeneration: 1, compilerVersion: "x", registryManifestHash: "x",
  theme: { presetId: "jelly-signature", settings: {}, artifactId: null },
  templates: { home: { id: "home", type: "home", handle: "default", layout: { sections: [
    { kind: "global", globalSectionId: "bar" },
    { kind: "inline", section: { id: "body", type: "rich-text", enabled: true, settings: { text: { kind: "dynamic", binding: { ...binding, key: "body" }, fallback: "Body" } }, blocks: [] } },
  ] } } },
  globalSections: { bar: { id: "bar", section: { id: "bar", type: "announcement-bar", enabled: true, settings: { text: { kind: "dynamic", binding, fallback: "Free shipping" } }, blocks: [] } } },
  menus: {}, templateDefaults: { home: "home" }, assignments: [], dependencies: { edges: [] },
});

it("fills announcement, header and footer settings with custom-field values, asking only for their own bindings", async () => {
  const current = snapshot();
  const load = vi.fn(async () => new Map([[bindingKey(binding), "Free shipping over £50"]]));
  const { result } = renderHook(() => useChromeBindingValues(current, current.templates.home, { type: "product", id: "p1" }, load));
  expect(result.current?.announcement[0].settings.text).toBe("Free shipping");
  await waitFor(() => expect(result.current?.announcement[0].settings.text).toBe("Free shipping over £50"));
  expect(load).toHaveBeenCalledWith({ storeId: "store-1", bindings: [binding], resource: { type: "product", id: "p1" } });
});

it("keeps the fallback when the lookup fails, and asks nothing without bindings", async () => {
  const current = snapshot();
  const failing = vi.fn(async () => { throw new Error("offline"); });
  const { result } = renderHook(() => useChromeBindingValues(current, current.templates.home, undefined, failing));
  await waitFor(() => expect(failing).toHaveBeenCalled());
  expect(result.current?.announcement[0].settings.text).toBe("Free shipping");
  const plain = snapshot();
  plain.globalSections.bar.section.settings = { text: "Hello" };
  const none = vi.fn();
  renderHook(() => useChromeBindingValues(plain, plain.templates.home, undefined, none));
  expect(none).not.toHaveBeenCalled();
});
