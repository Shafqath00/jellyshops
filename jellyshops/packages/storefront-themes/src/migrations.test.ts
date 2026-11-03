import { describe, expect, it } from "vitest";
import { applyThemeMigrations, themeMigrationSchema, type ThemeMigrationDraft } from "./migrations.js";
import { validateThemeProject } from "./validate-theme-project.js";
import example from "../../../../docs/examples/jelly-studio/theme.json";

function draft(): ThemeMigrationDraft {
  return {
    settings: { branding: { oldName: "Merchant's name" }, enabled: false, count: 0, empty: "", nullable: null },
    sections: [{ id: "s1", type: "studio/old-promo", enabled: true, settings: { title: "Sale" }, blocks: [{ id: "b1", type: "group", enabled: true, settings: {}, blocks: [{ id: "b2", type: "old-label", enabled: true, settings: { copy: "Mine" } }] }] }],
  };
}
const theme = { scope: "theme" };

describe("declarative theme migrations", () => {
  it("preserves merchant settings through a rename without changing the source; returns a concrete diff", () => {
    const source = draft(), before = structuredClone(source);
    const result = applyThemeMigrations(source, "1.0.0", "2.0.0", [{ from: "1.0.0", to: "2.0.0", operations: [{ op: "renameSetting", target: theme, from: "branding.oldName", to: "branding.name" }] }]);
    expect(result.draft.settings.branding).toEqual({ name: "Merchant's name" });
    expect(source).toEqual(before);
    expect(result.changes).toEqual([
      { path: "settings.branding.oldName", kind: "removed", before: "Merchant's name" },
      { path: "settings.branding.name", kind: "added", after: "Merchant's name" },
    ]);
    // A caller can keep the source as its rollback snapshot; result writes cannot affect it.
    (result.draft.settings.branding as Record<string, unknown>).name = "Changed later";
    expect(source).toEqual(before);
  });

  it("walks sections and nested blocks, applying operations in order across a version chain", () => {
    const result = applyThemeMigrations(draft(), "1.0.0", "3.0.0", [
      { from: "2.0.0", to: "3.0.0", operations: [
        { op: "renameBlockType", from: "old-label", to: "label" },
        { op: "renameSetting", target: { scope: "block", type: "label" }, from: "copy", to: "text" },
        { op: "removeSetting", target: { scope: "section", type: "studio/promo" }, key: "title" },
      ] },
      { from: "1.0.0", to: "2.0.0", operations: [
        { op: "renameSectionType", from: "studio/old-promo", to: "studio/promo" },
        { op: "setDefault", target: { scope: "section", type: "studio/promo" }, key: "subtitle", value: "Hello" },
      ] },
    ]);
    expect(result.draft.sections[0]).toMatchObject({ id: "s1", type: "studio/promo", settings: { subtitle: "Hello" }, blocks: [{ blocks: [{ id: "b2", type: "label", settings: { text: "Mine" } }] }] });
    expect(result.draft.sections[0].settings).not.toHaveProperty("title");
    expect(result.changes.map((change) => change.path)).toContain("sections[0].blocks[0].blocks[0].type");
  });

  it("renames and removes responsive overrides while defaults inherit from base settings", () => {
    const source = draft();
    source.sections[0].responsive = { mobile: { title: "Phone title" }, tablet: { title: "Tablet title", old: "Remove me" } };
    source.sections[0].blocks[0].blocks![0].responsive = { mobile: { copy: "Phone copy" } };
    const result = applyThemeMigrations(source, "1.0.0", "2.0.0", [{ from: "1.0.0", to: "2.0.0", operations: [
      { op: "renameSetting", target: { scope: "section", type: "studio/old-promo" }, from: "title", to: "heading" },
      { op: "removeSetting", target: { scope: "section", type: "studio/old-promo" }, key: "old" },
      { op: "renameSetting", target: { scope: "block", type: "old-label" }, from: "copy", to: "text" },
      { op: "setDefault", target: { scope: "section", type: "studio/old-promo" }, key: "subtitle", value: "Base default" },
    ] }]);
    expect(result.draft.sections[0].responsive).toEqual({ mobile: { heading: "Phone title" }, tablet: { heading: "Tablet title" } });
    expect(result.draft.sections[0].blocks[0].blocks![0].responsive).toEqual({ mobile: { text: "Phone copy" } });
    expect(source.sections[0].responsive.mobile).toEqual({ title: "Phone title" });
    expect(result.changes.map((change) => change.path)).toContain("sections[0].responsive.tablet.heading");
  });

  it("accepts all saved node type names, including recipe names with repeated dashes", () => {
    const source = draft(); source.sections[0].type = "jelly-studio/my--promo";
    expect(applyThemeMigrations(source, "1.0.0", "2.0.0", [{ from: "1.0.0", to: "2.0.0", operations: [{ op: "renameSectionType", from: source.sections[0].type, to: "jelly-studio/promo" }] }]).draft.sections[0].type).toBe("jelly-studio/promo");
  });

  it("defaults only absent keys and skips absent rename/remove sources", () => {
    const operations: unknown[] = ["enabled", "count", "empty", "nullable", "newValue"].map((key) => ({ op: "setDefault", target: theme, key, value: "default" }));
    operations.push({ op: "removeSetting", target: theme, key: "absent" });
    operations.push({ op: "renameSetting", target: theme, from: "absent", to: "alsoAbsent" });
    const result = applyThemeMigrations(draft(), "1.0.0", "1.1.0", [{ from: "1.0.0", to: "1.1.0", operations }]);
    expect(result.draft.settings).toMatchObject({ enabled: false, count: 0, empty: "", nullable: null, newValue: "default" });
    expect(result.changes).toHaveLength(1);
  });

  it("aborts on an existing rename destination or a non-object parent without touching the input", () => {
    const source = draft(), before = structuredClone(source);
    for (const to of ["enabled", "empty.child", "nullable.child", "count.child"]) {
      expect(() => applyThemeMigrations(source, "1.0.0", "2.0.0", [{ from: "1.0.0", to: "2.0.0", operations: [{ op: "renameSetting", target: theme, from: "branding.oldName", to }] }])).toThrow(/already exists|not an object/);
      expect(source).toEqual(before);
    }
  });

  it("refuses missing, ambiguous, backwards and overshooting migration paths", () => {
    const step = { from: "1.0.0", to: "2.0.0", operations: [] };
    expect(() => applyThemeMigrations(draft(), "1.0.0", "3.0.0", [step])).toThrow(/No migration/);
    expect(() => applyThemeMigrations(draft(), "1.0.0", "2.0.0", [step, { ...step, to: "3.0.0" }])).toThrow(/Ambiguous/);
    expect(() => applyThemeMigrations(draft(), "2.0.0", "1.0.0", [])).toThrow(/newer/);
    expect(() => applyThemeMigrations(draft(), "1.0.0", "1.5.0", [step])).toThrow(/No migration/);
    expect(applyThemeMigrations(draft(), "1.0.0", "1.0.0", []).changes).toEqual([]);
  });

  it.each(["__proto__.polluted", "constructor.prototype.bad", "branding.__proto__", "prototype", "a..b"])("rejects unsafe setting path %s", (key) => {
    const migration = { from: "1.0.0", to: "2.0.0", operations: [{ op: "setDefault", target: theme, key, value: true }] };
    expect(themeMigrationSchema.safeParse(migration).success).toBe(false);
    expect(() => applyThemeMigrations(draft(), "1.0.0", "2.0.0", [migration])).toThrow();
    expect(Object.prototype).not.toHaveProperty("polluted");
  });

  it("validates declarations, rejects executable values, duplicate sources and future migrations", () => {
    const step = { from: "1.0.0", to: "2.0.0", operations: [{ op: "setDefault", target: theme, key: "copy", value: "Welcome" }] };
    expect(validateThemeProject({ manifest: { ...example, version: "2.0.0", migrations: [step] } }).filter((issue) => issue.level === "error")).toEqual([]);
    expect(validateThemeProject({ manifest: { ...example, version: "2.0.0", migrations: [step, step] } }).some((issue) => issue.level === "error")).toBe(true);
    expect(validateThemeProject({ manifest: { ...example, migrations: [step] } }).some((issue) => issue.level === "error")).toBe(true);
    step.operations[0].value = "<script>alert(1)</script>";
    expect(validateThemeProject({ manifest: { ...example, version: "2.0.0", migrations: [step] } })).toContainEqual(expect.objectContaining({ code: "EXECUTABLE_CONTENT" }));
    expect(themeMigrationSchema.safeParse({ ...step, operations: [{ op: "execute", code: "anything" }] }).success).toBe(false);
    expect(themeMigrationSchema.safeParse({ ...step, from: "3.0.0" }).success).toBe(false);
  });
});
