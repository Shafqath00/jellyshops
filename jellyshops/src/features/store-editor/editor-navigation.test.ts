import { expect, it } from "vitest";
import { parseEditorNavigationTarget } from "./editor-navigation";

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
