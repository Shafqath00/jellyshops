import { expect, it } from "vitest";
import { blockStyleProps } from "./block-style";
import { sectionStyleProps } from "./section-style";

it("passes every Show on choice to the page and ignores unknown values", () => {
  for (const choice of ["desktop-only", "desktop", "touch", "mobile"]) {
    expect(sectionStyleProps({ styleShowOn: choice })["data-show-on"]).toBe(choice);
    expect(blockStyleProps({ blockShowOn: choice })["data-show-on"]).toBe(choice);
  }
  expect(sectionStyleProps({ styleShowOn: "tv" })["data-show-on"]).toBeUndefined();
  expect(blockStyleProps({ blockShowOn: "" })["data-show-on"]).toBeUndefined();
});
