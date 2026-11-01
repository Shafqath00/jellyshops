import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MetafieldApiError, type MetafieldDefinition, type MetafieldsApi } from "./api";
import { useProductMetafields } from "./use-product-metafields";

const def = (id: string, name: string, ownerType: "product" | "variant" = "product", type = "string"): MetafieldDefinition => ({ id, ownerType, namespace: "custom", key: id, name, type, storefrontVisible: true });
const material = def("material", "Material");
const rating = def("rating", "Rating", "product", "integer");
const weave = def("weave", "Weave", "variant");

function fakeApi(overrides: Partial<MetafieldsApi> = {}): MetafieldsApi {
  return {
    listDefinitions: vi.fn(async (_store, type) => type === "product" ? [material, rating] : [weave]),
    listValues: vi.fn(async (_store, type) => type === "product" ? [{ ownerId: "p1", definitionId: "material", value: "Cotton" }] : [{ ownerId: "v1", definitionId: "weave", value: "Twill" }]),
    saveValues: vi.fn(async () => ({ saved: 1, cleared: 0 })),
    createDefinition: vi.fn(async (_store, input) => ({ ...def(input.key, input.name, input.ownerType, input.type) })),
    ...overrides,
  };
}
const setup = (api: MetafieldsApi | null, options: { productId?: string | null; variantIds?: string[]; onChange?: () => void } = {}) =>
  renderHook((props: { variantIds: string[] }) => useProductMetafields({ api, storeId: "store-a", productId: options.productId === undefined ? "p1" : options.productId, variantIds: props.variantIds, onChange: options.onChange }), { initialProps: { variantIds: options.variantIds ?? ["v1"] } });

describe("loading", () => {
  it("loads the store's fields and a saved product's values, for the product and its combinations", async () => {
    const api = fakeApi();
    const { result } = setup(api);
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.productDefinitions.map((entry) => entry.id)).toEqual(["material", "rating"]);
    expect(result.current.variantDefinitions.map((entry) => entry.id)).toEqual(["weave"]);
    expect(result.current.valueOf("product", "material")).toBe("Cotton");
    expect(result.current.valueOf("variant:v1", "weave")).toBe("Twill");
    expect(result.current.valueOf("product", "rating")).toBeUndefined();
    expect(result.current.dirty).toBe(false);
    expect(api.listValues).toHaveBeenCalledWith("store-a", "product", ["p1"]);
    expect(api.listValues).toHaveBeenCalledWith("store-a", "variant", ["v1"]);
  });

  it("loads only the fields for a product that is not saved yet", async () => {
    const api = fakeApi();
    const { result } = setup(api, { productId: null, variantIds: [] });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.listValues).not.toHaveBeenCalled();
    expect(result.current.productDefinitions).toHaveLength(2);
  });

  it("does nothing when signed out", () => {
    const { result } = setup(null);
    expect(result.current.loading).toBe(false);
    expect(result.current.productDefinitions).toEqual([]);
  });

  it("says so when the fields cannot be loaded", async () => {
    const { result } = setup(fakeApi({ listDefinitions: vi.fn(async () => { throw new Error("Custom data could not be reached."); }) }));
    await waitFor(() => expect(result.current.loadError).toBe("Custom data could not be reached."));
    expect(result.current.loading).toBe(false);
  });
});

describe("editing", () => {
  it("is dirty only while values differ from what was loaded, and tells the editor about each change", async () => {
    const onChange = vi.fn();
    const { result } = setup(fakeApi(), { onChange });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setValue("product", "material", "Linen"));
    expect(result.current.dirty).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    act(() => result.current.setValue("product", "material", "Cotton"));
    expect(result.current.dirty).toBe(false);
    act(() => result.current.setValue("product", "rating", 4));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.setValue("product", "rating", null));
    expect(result.current.dirty).toBe(false);
    act(() => result.current.setValue("product", "material", null));
    expect(result.current.valueOf("product", "material")).toBeUndefined();
    expect(result.current.dirty).toBe(true);
  });

  it("goes back to what was loaded, or forgets everything for a new product", async () => {
    const { result } = setup(fakeApi());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setValue("product", "material", "Silk"));
    act(() => result.current.reset());
    expect(result.current.valueOf("product", "material")).toBe("Cotton");
    expect(result.current.dirty).toBe(false);
    act(() => result.current.clear());
    expect(result.current.valueOf("product", "material")).toBeUndefined();
    expect(result.current.dirty).toBe(false);
  });

  it("adds a newly created field to the list in name order", async () => {
    const api = fakeApi();
    const { result } = setup(api);
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.createDefinition({ ownerType: "product", namespace: "custom", key: "care", name: "Care", type: "text", storefrontVisible: true }); });
    expect(result.current.productDefinitions.map((entry) => entry.name)).toEqual(["Care", "Material", "Rating"]);
  });
});

describe("saving", () => {
  it("sends only what changed, with null for what was taken away", async () => {
    const api = fakeApi();
    const { result } = setup(api);
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setValue("product", "material", null); result.current.setValue("product", "rating", 5); });
    let outcome: { ok: boolean } | undefined;
    await act(async () => { outcome = await result.current.saveAll({ productId: "p1", variantIds: {} }); });
    expect(outcome).toEqual({ ok: true });
    expect(api.saveValues).toHaveBeenCalledTimes(1);
    expect(api.saveValues).toHaveBeenCalledWith("store-a", "product", "p1", { material: null, rating: 5 });
    expect(result.current.dirty).toBe(false);
  });

  it("makes no request when nothing changed", async () => {
    const api = fakeApi();
    const { result } = setup(api);
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.saveAll({ productId: "p1", variantIds: {} }); });
    expect(api.saveValues).not.toHaveBeenCalled();
  });

  it("saves a new product's values under the id it was just given", async () => {
    const api = fakeApi();
    const { result } = setup(api, { productId: null, variantIds: [] });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setValue("product", "material", "Wool"));
    await act(async () => { await result.current.saveAll({ productId: "new-product", variantIds: {} }); });
    expect(api.saveValues).toHaveBeenCalledWith("store-a", "product", "new-product", { material: "Wool" });
  });

  it("saves a new combination's values under its saved id and keeps them", async () => {
    const api = fakeApi();
    const { result } = setup(api, { variantIds: [] });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setValue("variant:draft-1", "weave", "Plain"));
    await act(async () => { await result.current.saveAll({ productId: "p1", variantIds: { "draft-1": "saved-1" } }); });
    expect(api.saveValues).toHaveBeenCalledWith("store-a", "variant", "saved-1", { weave: "Plain" });
    expect(result.current.valueOf("variant:saved-1", "weave")).toBe("Plain");
    expect(result.current.valueOf("variant:draft-1", "weave")).toBeUndefined();
    expect(result.current.dirty).toBe(false);
  });

  it("reports what the server refused, per field, saves what it can, and stays dirty", async () => {
    const saveValues = vi.fn(async (_store: string, type: string) => {
      if (type === "variant") throw new MetafieldApiError("Weave: Choose one of the allowed values.", 422, "METAFIELD_INVALID", { weave: "Weave: Choose one of the allowed values." });
      return { saved: 1, cleared: 0 };
    });
    const { result } = setup(fakeApi({ saveValues }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setValue("product", "material", "Linen"); result.current.setValue("variant:v1", "weave", "Silk"); });
    let outcome: { ok: boolean; message?: string } | undefined;
    await act(async () => { outcome = await result.current.saveAll({ productId: "p1", variantIds: {} }); });
    expect(outcome).toEqual({ ok: false, message: "Weave: Choose one of the allowed values." });
    expect(result.current.problemFor("variant:v1", "weave")).toBe("Weave: Choose one of the allowed values.");
    expect(result.current.problemFor("product", "material")).toBeUndefined();
    expect(result.current.dirty).toBe(true);
    act(() => result.current.setValue("variant:v1", "weave", "Twill"));
    expect(result.current.problemFor("variant:v1", "weave")).toBeUndefined();
  });

  it("explains a failure that is not about one field", async () => {
    const { result } = setup(fakeApi({ saveValues: vi.fn(async () => { throw new Error("Custom data could not be reached."); }) }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setValue("product", "rating", 3));
    let outcome: { ok: boolean; message?: string } | undefined;
    await act(async () => { outcome = await result.current.saveAll({ productId: "p1", variantIds: {} }); });
    expect(outcome).toEqual({ ok: false, message: "Custom data could not be reached." });
    expect(result.current.dirty).toBe(true);
  });
});
