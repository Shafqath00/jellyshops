import { describe, expect, it } from "vitest";
import { editorSearchFor, parseEditorNavigationTarget } from "./editor-navigation";

it("preserves template and preview resource from content customization links", () => {
  expect(parseEditorNavigationTarget("?templateId=page-alt&resourceType=page&resourceId=page-1")).toEqual({
    templateId: "page-alt",
    resourceType: "page",
    resourceId: "page-1",
  });
});

it("ignores incomplete or unsupported resource targets", () => {
  expect(parseEditorNavigationTarget("?templateId=page-alt&resourceType=customer&resourceId=customer-1")).toEqual({
    templateId: "page-alt",
  });
  expect(parseEditorNavigationTarget("?resourceType=page")).toEqual({});
});

describe("selection in the address", () => {
  it("reads the section and block to select", () => {
    expect(parseEditorNavigationTarget("?templateId=t1&section=s1&block=b1")).toEqual({ templateId: "t1", sectionId: "s1", blockId: "b1" });
    expect(parseEditorNavigationTarget("?block=b1")).toEqual({});
    expect(parseEditorNavigationTarget("?section=%20")).toEqual({});
  });

  it("writes the current selection and keeps other parameters", () => {
    expect(editorSearchFor("?resourceType=product&resourceId=p1", { templateId: "t1", sectionId: "s1", blockId: "b1" })).toBe("?resourceType=product&resourceId=p1&templateId=t1&section=s1&block=b1");
    expect(editorSearchFor("?templateId=t1&section=s1&block=b1", { templateId: "t1", sectionId: "s2" })).toBe("?templateId=t1&section=s2");
    expect(editorSearchFor("?templateId=t1&section=s1", { templateId: "t1" })).toBe("?templateId=t1");
    expect(editorSearchFor("?templateId=t1", {})).toBe("");
    // A block without a section is never written.
    expect(editorSearchFor("", { blockId: "b1" })).toBe("");
  });

  it("keeps a selected section element in the address (only without a block)", () => {
    expect(parseEditorNavigationTarget("?section=s1&element=heading")).toEqual({ sectionId: "s1", elementId: "heading" });
    expect(parseEditorNavigationTarget("?section=s1&block=b1&element=heading")).toEqual({ sectionId: "s1", blockId: "b1" });
    expect(editorSearchFor("", { templateId: "t1", sectionId: "s1", elementId: "heading" })).toBe("?templateId=t1&section=s1&element=heading");
    expect(editorSearchFor("?section=s1&element=heading", { templateId: "t1", sectionId: "s1" })).toBe("?section=s1&templateId=t1");
  });
});
