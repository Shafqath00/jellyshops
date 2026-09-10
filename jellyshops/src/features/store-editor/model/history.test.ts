import { createDefaultStorefrontDocument } from "@jelly/storefront-schema";
import { describe, expect, it } from "vitest";
import { createHistory, execute, redo, undo } from "./history";

describe("editor history", () => {
  it("undoes, redoes, and clears redo after a new edit", () => {
    const document = createDefaultStorefrontDocument("store-demo");
    const hero = document.regions.template[0];
    const changed = { ...document, storeId: "store-changed" };
    const newer = { ...document, storeId: "store-newer" };

    const edited = execute(createHistory(document), changed);
    expect(undo(edited).present.storeId).toBe("store-demo");
    expect(redo(undo(edited)).present.storeId).toBe("store-changed");
    expect(execute(undo(edited), newer).future).toEqual([]);
    expect(hero.id).toBe(document.regions.template[0].id);
  });

  it("caps document history at 100 entries", () => {
    let history = createHistory(createDefaultStorefrontDocument("store-demo"));
    for (let index = 0; index < 105; index += 1) {
      history = execute(history, { ...history.present, storeId: `store-${index}` });
    }
    expect(history.past).toHaveLength(100);
  });
});
