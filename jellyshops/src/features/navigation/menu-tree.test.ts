import { describe, expect, it } from "vitest";
import type { MenuItem } from "./api/client";
import { addMenuItem, buildMenu, countLinks, flattenMenu, indentMenuItem, levelsOf, moveMenuItem, outdentMenuItem, removeMenuItem, shiftMenuItem } from "./menu-tree";

const link = (id: string, children: MenuItem[] = []): MenuItem => ({ id, label: id.toUpperCase(), target: { kind: "home" }, children });
/** "a(b,c),d" style outline for easy comparison. */
const outline = (items: MenuItem[]): string => items.map((item) => item.children.length ? `${item.id}(${outline(item.children)})` : item.id).join(",");

const menu = () => [link("a", [link("b"), link("c")]), link("d"), link("e")];

describe("menu tree", () => {
  it("flattens and builds back the same menu", () => {
    const flat = flattenMenu(menu());
    expect(flat.map((entry) => `${entry.id}:${entry.depth}:${entry.parentId}`)).toEqual(["a:0:null", "b:1:a", "c:1:a", "d:0:null", "e:0:null"]);
    expect(outline(buildMenu(flat))).toBe("a(b,c),d,e");
    expect(countLinks(menu())).toBe(5);
    expect(levelsOf(menu()[0]!)).toBe(2);
  });

  it("moves a link with its sub-links, at the depth the pointer suggests", () => {
    expect(outline(moveMenuItem(menu(), "e", "a", 0))).toBe("e,a(b,c),d");
    expect(outline(moveMenuItem(menu(), "a", "d", 0))).toBe("d,a(b,c),e");
    expect(outline(moveMenuItem(menu(), "d", "c", 1))).toBe("a(b,d,c),e");
    expect(outline(moveMenuItem(menu(), "b", "e", 0))).toBe("a(c),d,e,b");
  });

  it("never drops a link into its own sub-links or deeper than three levels", () => {
    expect(outline(moveMenuItem(menu(), "a", "b", 1))).toBe("a(b,c),d,e");
    const deep = [link("a", [link("b", [link("c")])]), link("d", [link("x")])];
    // d has a sub-link (2 levels), so it can go at most one level in.
    expect(outline(moveMenuItem(deep, "d", "c", 5))).toBe("a(b,d(x,c))");
  });

  it("moves links up and down among their neighbours", () => {
    expect(outline(shiftMenuItem(menu(), "d", -1))).toBe("d,a(b,c),e");
    expect(outline(shiftMenuItem(menu(), "c", -1))).toBe("a(c,b),d,e");
    expect(outline(shiftMenuItem(menu(), "e", 1))).toBe("a(b,c),d,e");
  });

  it("indents into the link above and outdents to right after the parent", () => {
    expect(outline(indentMenuItem(menu(), "d")!)).toBe("a(b,c,d),e");
    expect(indentMenuItem(menu(), "a")).toBeNull();
    expect(outline(outdentMenuItem(menu(), "b")!)).toBe("a(c),b,d,e");
    expect(outdentMenuItem(menu(), "a")).toBeNull();
    const deep = [link("a", [link("b", [link("c")])]), link("d")];
    expect(indentMenuItem(deep, "d")).not.toBeNull();
    expect(indentMenuItem([link("a", [link("b", [link("c")]), link("x")])], "x")).not.toBeNull();
    expect(indentMenuItem([link("a", [link("b", [link("c")])]), link("d", [link("y")])], "d")).not.toBeNull();
    expect(indentMenuItem([link("a", [link("b", [link("c")]), link("x", [link("y")])])], "x")).toBeNull();
  });

  it("adds and removes links, keeping sub-links of a removed link", () => {
    expect(outline(addMenuItem(menu(), link("f")))).toBe("a(b,c),d,e,f");
    expect(outline(addMenuItem(menu(), link("f"), "d"))).toBe("a(b,c),d(f),e");
    expect(outline(removeMenuItem(menu(), "a"))).toBe("b,c,d,e");
  });
});
