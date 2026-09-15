import { describe, expect, it } from "vitest";
import { createThemePackLayout } from "./theme-pack-workspace";

describe("theme pack workspace layouts", () => {
  it.each(["fresh-market", "artisan-boutique"] as const)("creates an editable %s home layout", (packId) => {
    const layout = createThemePackLayout(packId);
    expect(layout.theme.id).toBe(packId);
    expect(layout.sections).toHaveLength(8);
    expect(layout.sections.every((placement) => placement.kind === "inline")).toBe(true);
    expect(layout.sections.map((placement) => placement.section.type)).toContain("hero");
  });
});
