import { describe, expect, it } from "vitest";
import { applyThemeUpgrade, getThemeUpgradePath } from "./migrations";

const rename = (from: string, to: string, fromKey: string, toKey: string) => ({ from, to, operations: [{ op: "renameSetting", target: { scope: "theme" }, from: fromKey, to: toKey }] });

describe("merchant upgrade path", () => {
  it("allows a minor or patch upgrade with no migration steps", () => {
    expect(getThemeUpgradePath("1.0.0", "1.4.2", [])).toEqual({ steps: [], reached: "1.0.0" });
    const { draft, changes } = applyThemeUpgrade({ settings: { a: 1 }, sections: [] }, "1.0.0", "1.4.2", undefined);
    expect(draft).toEqual({ settings: { a: 1 }, sections: [] });
    expect(changes).toEqual([]);
  });

  it("follows the steps that exist and allows the rest of the way inside one major version", () => {
    const steps = [rename("1.0.0", "1.1.0", "colors.brand", "colors.primary")];
    expect(getThemeUpgradePath("1.0.0", "1.3.0", steps).reached).toBe("1.1.0");
    const { draft, changes } = applyThemeUpgrade({ settings: { colors: { brand: "#123456" } }, sections: [] }, "1.0.0", "1.3.0", steps);
    expect(draft.settings).toEqual({ colors: { primary: "#123456" } });
    expect(changes.map((change) => change.kind)).toEqual(["removed", "added"]);
  });

  it("needs a migration to cross into a new major version", () => {
    expect(() => getThemeUpgradePath("1.2.0", "2.0.0", [])).toThrow(/no upgrade path from 1.2.0/);
    const steps = [rename("1.2.0", "2.0.0", "old", "new")];
    expect(getThemeUpgradePath("1.2.0", "2.1.0", steps)).toMatchObject({ reached: "2.0.0" });
    expect(() => getThemeUpgradePath("1.0.0", "2.0.0", steps)).toThrow(/no upgrade path from 1.0.0/);
  });

  it("refuses to go backwards or stay put", () => {
    expect(() => getThemeUpgradePath("2.0.0", "1.0.0", [])).toThrow(/newer version/);
    expect(() => getThemeUpgradePath("1.0.0", "1.0.0", [])).toThrow(/newer version/);
  });
});
