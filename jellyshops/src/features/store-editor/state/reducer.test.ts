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
});
