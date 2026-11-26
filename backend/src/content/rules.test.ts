import { describe, expect, it } from "vitest";
import { ApiError } from "../http/errors.js";
import {
  checkContentSize,
  checkHandle,
  checkScheduleTime,
  contentState,
  freeHandle,
  normaliseContentPath,
  normaliseTags,
  queryContent,
  slugify,
} from "./rules.js";

function code(run: () => unknown): string | undefined {
  try { run(); } catch (error) { return error instanceof ApiError ? error.code : "OTHER"; }
  return undefined;
}

describe("web address endings", () => {
  it("makes an ending from a title", () => {
    expect(slugify("Delivery & Returns!")).toBe("delivery-and-returns");
    expect(slugify("  Café   crème  ")).toBe("cafe-creme");
    expect(slugify("!!!")).toBe("untitled");
    expect(slugify("a".repeat(300))).toHaveLength(100);
  });

  it("accepts tidy endings and refuses messy ones", () => {
    expect(checkHandle(" About-Us ")).toBe("about-us");
    expect(code(() => checkHandle("about us"))).toBe("CONTENT_HANDLE_INVALID");
    expect(code(() => checkHandle("about--us"))).toBe("CONTENT_HANDLE_INVALID");
    expect(code(() => checkHandle("-about"))).toBe("CONTENT_HANDLE_INVALID");
    expect(code(() => checkHandle(""))).toBe("CONTENT_HANDLE_INVALID");
    expect(code(() => checkHandle("../etc"))).toBe("CONTENT_HANDLE_INVALID");
  });

  it("finds the first free ending", () => {
    expect(freeHandle("about", new Set())).toBe("about");
    expect(freeHandle("about", new Set(["about", "about-2"]))).toBe("about-3");
    const long = "a".repeat(100);
    const free = freeHandle(long, new Set([long]));
    expect(free.length).toBeLessThanOrEqual(100);
    expect(free.endsWith("-2")).toBe(true);
  });

  it("tidies storefront paths for redirect lookups", () => {
    expect(normaliseContentPath("/pages/About/?ref=1")).toBe("/pages/about");
    expect(normaliseContentPath("/blogs/news/opening-day")).toBe("/blogs/news/opening-day");
    expect(normaliseContentPath("/products/shoe")).toBeNull();
    expect(normaliseContentPath("https://evil.example/pages/a")).toBeNull();
    expect(normaliseContentPath("/pages/../admin")).toBeNull();
  });
});

describe("states, tags and schedules", () => {
  const base = { status: "DRAFT" as const, scheduledAt: null, archivedAt: null };

  it("works out what a merchant sees", () => {
    expect(contentState(base)).toBe("draft");
    expect(contentState({ ...base, status: "PUBLISHED" })).toBe("published");
    expect(contentState({ ...base, scheduledAt: new Date() })).toBe("scheduled");
    expect(contentState({ ...base, status: "PUBLISHED", archivedAt: new Date() })).toBe("archived");
  });

  it("tidies tags", () => {
    expect(normaliseTags(["  Sleep ", "sleep", "Beds  and   bedding", ""])).toEqual(["Sleep", "Beds and bedding"]);
    expect(code(() => normaliseTags(["x".repeat(41)]))).toBe("CONTENT_INVALID");
    expect(code(() => normaliseTags(Array.from({ length: 51 }, (_, index) => `tag ${index}`)))).toBe("CONTENT_INVALID");
  });

  it("only schedules in the future", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    expect(checkScheduleTime(new Date("2026-11-27T09:00:00Z"), now)).toEqual(new Date("2026-11-27T09:00:00Z"));
    expect(code(() => checkScheduleTime(new Date("2026-11-25T09:00:00Z"), now))).toBe("CONTENT_SCHEDULE_INVALID");
    expect(code(() => checkScheduleTime(new Date("nonsense"), now))).toBe("CONTENT_SCHEDULE_INVALID");
    expect(code(() => checkScheduleTime(new Date("2040-01-01T00:00:00Z"), now))).toBe("CONTENT_SCHEDULE_INVALID");
  });

  it("refuses content that is not a document or is too large", () => {
    expect(code(() => checkContentSize([] as unknown as Record<string, unknown>))).toBe("CONTENT_INVALID");
    expect(code(() => checkContentSize({ type: "doc", text: "x".repeat(600 * 1024) }))).toBe("CONTENT_TOO_LARGE");
    expect(checkContentSize({ type: "doc", content: [] })).toEqual({ type: "doc", content: [] });
  });
});

describe("list queries", () => {
  const at = (day: number) => new Date(`2026-11-${String(day).padStart(2, "0")}T10:00:00Z`);
  const records = [
    { title: "About us", handle: "about", status: "PUBLISHED" as const, createdAt: at(1), updatedAt: at(5), publishedAt: at(5), authorUserId: "u1", authorName: "Sam", scheduledAt: null, archivedAt: null, tags: ["Story"] },
    { title: "Delivery", handle: "delivery", status: "DRAFT" as const, createdAt: at(2), updatedAt: at(3), publishedAt: null, authorUserId: "u2", authorName: "Alex", scheduledAt: at(20), archivedAt: null, tags: [] },
    { title: "Old sale", handle: "old-sale", status: "DRAFT" as const, createdAt: at(3), updatedAt: at(4), publishedAt: null, authorUserId: "u1", authorName: "Sam", scheduledAt: null, archivedAt: at(4), tags: [] },
    { title: "Contact", handle: "contact", status: "DRAFT" as const, createdAt: at(4), updatedAt: at(6), publishedAt: null, authorUserId: null, authorName: null, scheduledAt: null, archivedAt: null, tags: ["Help"] },
  ];

  it("hides archived items by default and counts every state", () => {
    const result = queryContent(records);
    expect(result.items.map((item) => item.handle)).toEqual(["contact", "about", "delivery"]);
    expect(result.counts).toEqual({ all: 4, active: 3, published: 1, draft: 1, scheduled: 1, archived: 1 });
  });

  it("filters by state, words, author, tag and date", () => {
    expect(queryContent(records, { state: "archived" }).items.map((item) => item.handle)).toEqual(["old-sale"]);
    expect(queryContent(records, { q: "sam about" }).items.map((item) => item.handle)).toEqual(["about"]);
    expect(queryContent(records, { authorUserId: "u1", state: "all" }).total).toBe(2);
    expect(queryContent(records, { tag: "help" }).items.map((item) => item.handle)).toEqual(["contact"]);
    expect(queryContent(records, { updatedFrom: at(4), updatedTo: at(5), state: "all" }).items.map((item) => item.handle)).toEqual(["about", "old-sale"]);
  });

  it("sorts and pages", () => {
    expect(queryContent(records, { sort: "title" }).items.map((item) => item.handle)).toEqual(["about", "contact", "delivery"]);
    const page = queryContent(records, { sort: "created", direction: "asc", limit: 2, offset: 1 });
    expect(page.items.map((item) => item.handle)).toEqual(["delivery", "contact"]);
    expect(page.total).toBe(3);
  });
});
