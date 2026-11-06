import { describe, expect, it } from "vitest";
import type { PageMeasurement, PartMeasurement } from "./measure";
import { compareWithBaseline, contrastFinding, dominantValue, findingsReport, lintPage, pageEdges } from "./rules";

const context = { theme: "t", page: "Home", device: "desktop" };
const part = (key: string, left: number | null, right: number | null, extra: Partial<PartMeasurement> = {}): PartMeasurement =>
  ({ key, isSection: true, left, right, textLeft: left, textRight: right, fullBleed: false, scrolling: false, inColumn: false, paddingTop: 96, paddingBottom: 96, ...extra });
const page = (parts: PartMeasurement[], extra: Partial<PageMeasurement> = {}): PageMeasurement =>
  ({ frameWidth: 1280, overflow: 0, parts, headingSizes: [44, 56], smallTargets: [], cardLists: [], ...extra });
const rules = (measurement: PageMeasurement, device = "desktop") => lintPage(measurement, { ...context, device }).map((item) => item.rule);

describe("design lint rules", () => {
  it("finds the edge most parts share, within a pixel", () => {
    expect(dominantValue([64, 64.5, 52, 32, 63.8], 1, true)).toBeCloseTo(64, 0);
    expect(dominantValue([], 1, true)).toBeNull();
    expect(pageEdges(page([part("a", 49, 1216), part("b", 49, 1216), part("c", 126, 1216)]))).toEqual({ left: 49, right: 1216 });
  });

  it("accepts parts aligned left, aligned right or clearly centred", () => {
    const tidy = page([part("header", 49, 1216, { isSection: false }), part("grid", 49, 1216), part("hero", 126, 1216), part("story", 49, 1151), part("news", 352, 912), part("footer", 49, 1216, { isSection: false })]);
    expect(lintPage(tidy, context)).toEqual([]);
  });

  it("flags parts that start on their own edge, like a header 12px off the sections", () => {
    const drifting = page([part("header", 52, 1213, { isSection: false }), part("a", 64, 1200), part("b", 64, 1200), part("c", 76, 1180), part("d", 64, 1200), part("footer", 32, 1232, { isSection: false })]);
    const findings = lintPage(drifting, context);
    expect(findings.map((item) => item.id)).toEqual(["edge|t|Home|desktop|header", "edge|t|Home|desktop|c", "edge|t|Home|desktop|footer"]);
    expect(findings[0].message).toContain("outside the page edges");
    expect(findings[1].message).toContain("not aligned");
  });

  it("lets full-width parts run edge to edge but keeps their text inside the page edges", () => {
    const parts = [part("header", 49, 1231, { isSection: false }), part("grid", 49, 1231), part("banner", 0, 1280, { fullBleed: true, textLeft: 126, textRight: 900 }), part("cards", 0, 1280, { fullBleed: true, textLeft: 8, textRight: 1272 })];
    expect(lintPage(page(parts), context).map((item) => item.id)).toEqual(["edge|t|Home|desktop|cards"]);
    expect(pageEdges(page(parts))).toEqual({ left: 49, right: 1231 });
  });

  it("counts centred content on a phone as centred with a smaller inset", () => {
    const phone = page([part("header", 17, 373, { isSection: false }), part("a", 17, 373), part("b", 17, 373), part("columns", 47, 343), part("near", 22, 368)], { frameWidth: 390 });
    expect(lintPage(phone, { ...context, device: "mobile" }).map((item) => item.id)).toEqual(["edge|t|Home|mobile|near"]);
  });

  it("lets a scrolling strip's text run across the screen and judges column parts with their row", () => {
    const parts = [part("header", 49, 1231, { isSection: false }), part("grid", 49, 1231), part("strip", 0, 1280, { fullBleed: true, scrolling: true, textLeft: 0, textRight: 1280 }), part("details", 700, 1100, { inColumn: true }), part("more", 700, 1100, { inColumn: true })];
    expect(lintPage(page(parts), context)).toEqual([]);
    expect(pageEdges(page(parts))).toEqual({ left: 49, right: 1231 });
  });

  it("limits section paddings and heading sizes, and flags sideways scrolling", () => {
    const busy = page([part("a", 0, 100, { paddingTop: 96, paddingBottom: 80 }), part("b", 0, 100, { paddingTop: 64, paddingBottom: 40 }), part("header", 0, 100, { isSection: false, paddingTop: 12 })],
      { headingSizes: [14, 18, 24, 32, 44], overflow: 9 });
    expect(rules(busy)).toEqual(["rhythm", "headings", "overflow"]);
    expect(rules(page([part("a", 0, 100, { paddingTop: 0, paddingBottom: 0 })]))).toEqual([]);
  });

  it("checks tap targets on phones only", () => {
    const small = page([part("a", 0, 100)], { smallTargets: ['a "Sale" 40×18'] });
    expect(rules(small)).toEqual([]);
    expect(rules(small, "mobile")).toEqual(["tap-target"]);
  });

  it("flags product lists whose card images differ in shape", () => {
    const cards = page([part("a", 0, 100)], { cardLists: [{ key: "grid#1", ratios: [0.8, 0.8, 1] }, { key: "grid#2", ratios: [1, 1.01] }] });
    expect(lintPage(cards, context).map((item) => item.id)).toEqual(["card-ratio|t|Home|desktop|grid#1"]);
  });

  it("compares with the baseline and writes a report", () => {
    const findings = lintPage(page([part("a", 0, 100)], { overflow: 3 }), context);
    const contrast = contrastFinding(context, ["p.muted"]);
    expect(contrastFinding(context, [])).toBeNull();
    const all = [...findings, contrast!];
    expect(compareWithBaseline(all, ["overflow|t|Home|desktop", "edge|t|Home|desktop|gone"])).toEqual({ added: [contrast], fixed: ["edge|t|Home|desktop|gone"] });
    const report = findingsReport(all, ["edge|t|Home|desktop|gone"]);
    expect(report).toContain("## t (2)");
    expect(report).toContain("Fixed since the baseline");
  });
});
