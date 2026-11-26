/**
 * Plain rules for pages, blogs and blog posts: web address endings, states, tags, schedules and list queries.
 * No database access here, so every rule is unit-tested on its own.
 */
import { ApiError } from "../http/errors.js";
import type { ArticleRecord, ContentLifecycle, ContentState, ContentStatus, PageRecord } from "./repository.js";

export const MAX_HANDLE_LENGTH = 100;
export const MAX_TITLE_LENGTH = 255;
export const MAX_EXCERPT_LENGTH = 1000;
export const MAX_TAGS = 50;
export const MAX_TAG_LENGTH = 40;
export const MAX_AUTHOR_LENGTH = 120;
/** Saved content documents above this size are refused (about 150 printed pages of text). */
export const MAX_CONTENT_BYTES = 512 * 1024;
export const MAX_BULK_IDS = 100;
export const MAX_LIST_LIMIT = 100;

const HANDLE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function badRequest(code: string, message: string): never {
  throw new ApiError(400, code, message);
}

export function requiredText(value: string, label: string, max = MAX_TITLE_LENGTH): string {
  const normalized = value.trim();
  if (!normalized) badRequest("CONTENT_INVALID", `${label} can't be empty.`);
  if (normalized.length > max) badRequest("CONTENT_INVALID", `${label} can be up to ${max} characters.`);
  return normalized;
}

/** A title turned into a web address ending: "Delivery & Returns!" -> "delivery-returns". */
export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_HANDLE_LENGTH)
    .replace(/-+$/g, "");
  return slug || "untitled";
}

/** Checks a web address ending typed by the merchant (lowercase letters, numbers and single hyphens). */
export function checkHandle(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) badRequest("CONTENT_HANDLE_INVALID", "The web address ending can't be empty.");
  if (normalized.length > MAX_HANDLE_LENGTH) badRequest("CONTENT_HANDLE_INVALID", `The web address ending can be up to ${MAX_HANDLE_LENGTH} characters.`);
  if (!HANDLE_PATTERN.test(normalized)) {
    badRequest("CONTENT_HANDLE_INVALID", "Use lowercase letters, numbers and hyphens only, for example about-us.");
  }
  return normalized;
}

/** The first free handle: "about", "about-2", "about-3", ... */
export function freeHandle(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let suffix = 2; suffix < 10_000; suffix++) {
    const ending = `-${suffix}`;
    const candidate = `${base.slice(0, MAX_HANDLE_LENGTH - ending.length).replace(/-+$/g, "")}${ending}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base.slice(0, MAX_HANDLE_LENGTH - 9)}-${Date.now().toString(36)}`;
}

export function handleTaken(handle: string, suggestion: string, kind: "page" | "post" | "blog"): never {
  throw new ApiError(409, "CONTENT_HANDLE_TAKEN",
    `Another ${kind} already uses the web address ending "${handle}". Try "${suggestion}".`,
    [{ path: "handle", message: suggestion }]);
}

export function contentState(record: { status: ContentStatus } & Pick<ContentLifecycle, "scheduledAt" | "archivedAt">): ContentState {
  if (record.archivedAt) return "archived";
  if (record.status === "PUBLISHED") return "published";
  return record.scheduledAt ? "scheduled" : "draft";
}

/** Tags trimmed, without repeats (ignoring case, first spelling kept), at most 50 of up to 40 characters. */
export function normaliseTags(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of values) {
    const tag = value.trim().replace(/\s+/g, " ");
    if (!tag) continue;
    if (tag.length > MAX_TAG_LENGTH) badRequest("CONTENT_INVALID", `Tags can be up to ${MAX_TAG_LENGTH} characters ("${tag.slice(0, 20)}…" is longer).`);
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  if (tags.length > MAX_TAGS) badRequest("CONTENT_INVALID", `A post can have up to ${MAX_TAGS} tags.`);
  return tags;
}

/** A publish time must be in the future (a minute of slack for slow clocks). */
export function checkScheduleTime(value: Date, now: Date): Date {
  if (Number.isNaN(value.getTime())) badRequest("CONTENT_SCHEDULE_INVALID", "Choose a valid date and time to publish.");
  if (value.getTime() < now.getTime() - 60_000) badRequest("CONTENT_SCHEDULE_INVALID", "Choose a time in the future to schedule publishing, or publish now.");
  if (value.getTime() > now.getTime() + 5 * 365 * 24 * 3600_000) badRequest("CONTENT_SCHEDULE_INVALID", "Choose a publish time within the next five years.");
  return value;
}

export function checkContentSize(content: Record<string, unknown>): Record<string, unknown> {
  if (!content || typeof content !== "object" || Array.isArray(content)) badRequest("CONTENT_INVALID", "The content could not be read. Reload the page and try again.");
  const bytes = Buffer.byteLength(JSON.stringify(content), "utf8");
  if (bytes > MAX_CONTENT_BYTES) badRequest("CONTENT_TOO_LARGE", "This content is too long to save. Split it into more than one page or post.");
  return structuredClone(content);
}

export type ContentSort = "updated" | "created" | "title" | "published";

export interface ContentListQuery {
  /** Words to find in the title, handle, author, excerpt or tags. */
  q?: string;
  /** "active" (default) = everything except archived. */
  state?: ContentState | "active" | "all";
  authorUserId?: string;
  tag?: string;
  blogId?: string;
  /** Last changed on or after / on or before (inclusive). */
  updatedFrom?: Date;
  updatedTo?: Date;
  sort?: ContentSort;
  direction?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export type ContentCounts = Record<ContentState | "all" | "active", number>;

export interface ContentListResult<T> {
  items: T[];
  total: number;
  counts: ContentCounts;
}

type Listable = Pick<PageRecord, "title" | "handle" | "status" | "createdAt" | "updatedAt" | "publishedAt" | "authorUserId" | "authorName" | "scheduledAt" | "archivedAt">
  & Partial<Pick<ArticleRecord, "excerpt" | "tags" | "blogId">>;

function sortValue(record: Listable, sort: ContentSort): number | string {
  switch (sort) {
    case "title": return record.title.toLocaleLowerCase("en-GB");
    case "created": return record.createdAt.getTime();
    case "published": return (record.publishedAt ?? record.scheduledAt)?.getTime() ?? 0;
    default: return record.updatedAt.getTime();
  }
}

/** Filters, counts, sorts and pages a store's pages or posts (a store holds at most a few thousand). */
export function queryContent<T extends Listable>(records: readonly T[], query: ContentListQuery = {}): ContentListResult<T> {
  const words = query.q?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  const tag = query.tag?.trim().toLowerCase();
  const matchesOthers = (record: T) => {
    if (query.blogId && record.blogId !== query.blogId) return false;
    if (query.authorUserId && record.authorUserId !== query.authorUserId) return false;
    if (tag && !(record.tags ?? []).some((entry) => entry.toLowerCase() === tag)) return false;
    if (query.updatedFrom && record.updatedAt < query.updatedFrom) return false;
    if (query.updatedTo && record.updatedAt > query.updatedTo) return false;
    if (words.length) {
      const haystack = [record.title, record.handle, record.authorName ?? "", record.excerpt ?? "", ...(record.tags ?? [])].join(" ").toLowerCase();
      if (!words.every((word) => haystack.includes(word))) return false;
    }
    return true;
  };
  const counts: ContentCounts = { all: 0, active: 0, published: 0, draft: 0, scheduled: 0, archived: 0 };
  const wanted = query.state ?? "active";
  const matching: T[] = [];
  for (const record of records) {
    if (!matchesOthers(record)) continue;
    const state = contentState(record);
    counts.all++;
    counts[state]++;
    if (state !== "archived") counts.active++;
    if (wanted === "all" || wanted === state || (wanted === "active" && state !== "archived")) matching.push(record);
  }
  const sort = query.sort ?? "updated";
  const direction = query.direction ?? (sort === "title" ? "asc" : "desc");
  matching.sort((a, b) => {
    const left = sortValue(a, sort);
    const right = sortValue(b, sort);
    const order = left < right ? -1 : left > right ? 1 : 0;
    return direction === "asc" ? order : -order;
  });
  const limit = Math.min(Math.max(query.limit ?? 50, 1), MAX_LIST_LIMIT);
  const offset = Math.max(query.offset ?? 0, 0);
  return { items: matching.slice(offset, offset + limit), total: matching.length, counts };
}

/** Where shoppers find each kind of item. */
export function pagePath(handle: string): string { return `/pages/${handle}`; }
export function blogPath(handle: string): string { return `/blogs/${handle}`; }
export function articlePath(blogHandle: string, handle: string): string { return `/blogs/${blogHandle}/${handle}`; }

/** A storefront path tidied for lookups: lowercase, no query, no trailing slash. Null when it can't be an item. */
export function normaliseContentPath(value: string): string | null {
  const path = value.split(/[?#]/)[0]!.trim().toLowerCase().replace(/\/+$/g, "");
  if (!/^\/(?:pages|blogs)\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/.test(path) || path.length > 300) return null;
  return path;
}
