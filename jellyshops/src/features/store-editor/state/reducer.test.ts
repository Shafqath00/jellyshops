import { createDefaultStorefrontDocument } from "@jelly/storefront-schema";
import { describe, expect, it } from "vitest";
import { createEditorState, editorReducer } from "./reducer";

describe("editor reducer", () => {
  it("records document commands but not selection or viewport changes", () => {
    const document = createDefaultStorefrontDocument("store-demo");
    const hero = document.regions.template[0];
    let state = createEditorState(document, 3);

    state = editorReducer(state, { type: "select", selection: { kind: "section", region: "template", sectionId: hero.id } });
    state = editorReducer(state, { type: "set-viewport", viewport: "mobile" });
    expect(state.history.past).toHaveLength(0);

    state = editorReducer(state, { type: "command", command: { type: "update-section-setting", region: "template", sectionId: hero.id, key: "background", value: "#fff" } });
    expect(state.history.past).toHaveLength(1);
    expect(state.saveStatus).toBe("dirty");
  });

  it("updates only the saved resource revision while advancing workspace generation", () => {
    const document = createDefaultStorefrontDocument("store-demo");
    let state = createEditorState(document, 0);
    state = editorReducer(state, {
      type: "load-workspace",
      generation: 21,
      resourceRevisions: {
        "template:product-featured": 3,
        "menu:main": 7,
      },
    });

    state = editorReducer(state, {
      type: "resource-saved",
      resourceKey: "template:product-featured",
      revision: 4,
      generation: 22,
    });

    expect(state.generation).toBe(22);
    expect(state.resourceRevisions["template:product-featured"]).toBe(4);
    expect(state.resourceRevisions["menu:main"]).toBe(7);
  });
});
