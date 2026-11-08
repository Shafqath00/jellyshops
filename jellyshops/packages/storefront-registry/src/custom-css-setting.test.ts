import { expect, it } from "vitest";
import { getSectionDefinition, validateSectionAgainstRegistry } from "./index";

const section = (customCss: string) => ({ id: "s", type: "rich-text", enabled: true, settings: { customCss }, blocks: [] });

it("offers Custom CSS under Advanced on every section", () => {
  for (const type of ["hero", "rich-text", "footer", "product-grid"]) {
    expect(getSectionDefinition(type)?.controls.find((control) => control.key === "customCss")).toMatchObject({ type: "textarea", group: "advanced" });
  }
});

it("saves safe CSS and refuses CSS that could load or run something else", () => {
  expect(validateSectionAgainstRegistry(section("h2 { color: #333 }"), "home")).toEqual([]);
  const issues = validateSectionAgainstRegistry(section("@import url(https://evil.test/x.css);"), "home");
  expect(issues.length).toBeGreaterThan(0);
  expect(issues[0]?.message).toBe("Custom CSS: Only @media, @supports, @container and @keyframes rules are allowed.");
});
