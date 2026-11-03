import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { listV4StarterPacks } from "./v4-starter-packs";

/**
 * The four built-in starter packs are what every new store starts from, so their content is locked
 * by hash. If this fails you changed a built-in pack (its copy, sections, settings or ids). If the
 * change is intended, update the hash below with the new value this test prints; if you were
 * refactoring how packs are built, you broke the output and must fix the refactor.
 */
const locked: Record<string, string> = {
  "jelly-avenue": "3b88c2f127dffd1ae24808b4d460ec0a015da42d5029c246fb5873d4edab474a", // 19 templates
  "jelly-signature": "25f9193d63c62acf14f948ea396de28f34cd3be1b6c9cee27473c1d57a856251", // 19 templates
  "fresh-market": "0dabec8fdd896c3fb819f1ea1a125908d227b32f0fa6564fc0ab12b68a30f505", // 9 templates
  "artisan-boutique": "0bf3446e3c482bf5c5798dbef1954bb583c17160315a6cc9e341da248e063fa2", // 9 templates
};

describe("built-in starter packs", () => {
  const packs = listV4StarterPacks();

  it("lists exactly the locked packs", () => {
    expect(packs.map((pack) => pack.id).sort()).toEqual(Object.keys(locked).sort());
  });

  it.each(Object.keys(locked))("%s is unchanged", (id) => {
    const pack = packs.find((item) => item.id === id)!;
    expect(createHash("sha256").update(JSON.stringify(pack)).digest("hex"), `${id} changed (${pack.templates.length} templates now)`).toBe(locked[id]);
  });
});
