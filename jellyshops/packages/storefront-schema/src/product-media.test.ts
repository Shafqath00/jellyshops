import { describe, expect, it } from "vitest";
import { isProductMediaEnabled, pruneMediaAssignments, resolveProductGallery, suggestAssignmentsFromFilenames, validateMediaAssignments } from "./product-media";
import type { ProductOptionLike } from "./product-options";

const options: ProductOptionLike[] = [
  { id: "colour", name: "Colour", type: "variant", required: true, values: [{ id: "black", label: "Black" }, { id: "white", label: "White" }] },
  { id: "material", name: "Material", type: "configuration", required: false, multiple: true, values: [{ id: "wood", label: "Wood" }, { id: "metal", label: "Metal" }] },
  { id: "finish", name: "Finish", type: "configuration", required: false, visibleWhen: { optionId: "material", valueIds: ["wood"] }, values: [{ id: "oil", label: "Oil" }] },
];
const photo = (id: string, appliesTo: Record<string, string[]> = {}) => ({ id, url: `/${id}.jpg`, appliesTo });
const media = [photo("cover"), photo("black", { colour: ["black"] }), photo("white", { colour: ["white"] }), photo("wood", { colour: ["black"], material: ["wood"] }), photo("oil", { finish: ["oil"] })];
const pick = (optionId: string, valueId: string) => ({ optionId, valueId });
const ids = (items: typeof media) => items.map((item) => item.id);

describe("product galleries", () => {
  it("starts with seller order but never exposes photos for hidden conditional choices", () => {
    expect(ids(resolveProductGallery(media, options, []))).toEqual(["cover", "black", "white", "wood"]);
  });
  it("filters selected choices only and puts matching tagged photos before shared ones", () => {
    expect(ids(resolveProductGallery(media, options, [pick("colour", "black")]))).toEqual(["black", "wood", "cover"]);
  });
  it("uses OR within a multi-select and AND across choices", () => {
    const choices = [pick("colour", "black"), pick("material", "wood"), pick("material", "metal")];
    expect(ids(resolveProductGallery(media, options, choices))).toEqual(["black", "wood", "oil", "cover"]);
    expect(ids(resolveProductGallery(media, options, [pick("colour", "white"), pick("material", "metal")]))).toEqual(["white", "cover"]);
  });
  it("falls back to visible photos when no match or shared image exists", () => {
    expect(ids(resolveProductGallery([media[1]], options, [pick("colour", "white")]))).toEqual(["black"]);
    expect(resolveProductGallery([media[4]], options, [])).toEqual([]);
    expect(resolveProductGallery([], options, [])).toEqual([]);
  });
  it("unlinks photos losing their last assignment instead of making them shared", () => {
    const changed = options.map((option) => option.id === "colour" ? { ...option, values: option.values.filter((value) => value.id !== "black") } : option);
    const result = pruneMediaAssignments(media, changed);
    expect(result.removedMediaIds).toEqual(["black"]);
    expect(result.media.find((item) => item.id === "wood")?.appliesTo).toEqual({ material: ["wood"] });
    expect(result.media[0].id).toBe("cover");
    expect(result.changedMediaIds).toContain("wood");
  });
  it("validates duplicates, limits and unknown or empty tags but permits conditional choices", () => {
    expect(validateMediaAssignments(media, options)).toEqual([]);
    expect(validateMediaAssignments([media[0], media[0]], options).some((issue) => issue.code === "duplicate_media")).toBe(true);
    expect(validateMediaAssignments([photo("bad", { colour: [] })], options)).not.toEqual([]);
    expect(validateMediaAssignments([photo("bad", { ghost: ["x"] })], options)).not.toEqual([]);
    expect(validateMediaAssignments(Array.from({ length: 31 }, (_, n) => photo(String(n))), options).some((issue) => issue.code === "media_limit")).toBe(true);
  });
  it("suggests filenames using whole words and skips ambiguous values", () => {
    expect(suggestAssignmentsFromFilenames([{ ...photo("new"), originalName: "black-wood-front.jpg" }], options)).toEqual([{ mediaId: "new", appliesTo: { colour: ["black"], material: ["wood"] } }]);
    expect(suggestAssignmentsFromFilenames([{ ...photo("new"), originalName: "blackberry.jpg" }], options)).toEqual([]);
  });
  it("defaults feature rollout off and accepts explicit store IDs", () => {
    expect(isProductMediaEnabled("s1", undefined)).toBe(false);
    expect(isProductMediaEnabled("s1", "s10,s2")).toBe(false);
    expect(isProductMediaEnabled("s1", "s2, s1")).toBe(true);
    expect(isProductMediaEnabled("s1", "*")).toBe(true);
  });
});
