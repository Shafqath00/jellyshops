import { richTextFromStoredContent, type RichTextDocument } from "@jelly/storefront-schema";
import type { ArticleResource, PageResource, UpdateArticleInput, UpdatePageInput } from "@/features/content/api/client";
import type { ContentKind } from "./shared";

/** Everything the editor page lets a merchant change, in one plain object (compared and saved as a whole). */
export interface EditableContent {
  title: string;
  handle: string;
  content: RichTextDocument;
  excerpt: string;
  tags: string[];
  authorName: string;
  blogId: string;
  showInNavigation: boolean;
  featuredMediaId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  socialMediaId: string | null;
  noindex: boolean;
  canonicalOverride: string | null;
}

export const EMPTY_DOCUMENT: RichTextDocument = { type: "doc", content: [] };

export function blankContent(blogId = "", authorName = ""): EditableContent {
  return {
    title: "", handle: "", content: EMPTY_DOCUMENT, excerpt: "", tags: [], authorName, blogId, showInNavigation: true,
    featuredMediaId: null, seoTitle: null, seoDescription: null, socialMediaId: null, noindex: false, canonicalOverride: null,
  };
}

export function editableFrom(item: PageResource | ArticleResource): EditableContent {
  const post = "blogId" in item ? item as ArticleResource : null;
  return {
    title: item.title,
    handle: item.handle,
    content: richTextFromStoredContent(item.content ?? EMPTY_DOCUMENT),
    excerpt: post?.excerpt ?? "",
    tags: post?.tags ?? [],
    authorName: item.authorName ?? "",
    blogId: post?.blogId ?? "",
    showInNavigation: (item as PageResource).showInNavigation ?? true,
    featuredMediaId: item.featuredMediaId ?? null,
    seoTitle: item.seoTitle,
    seoDescription: item.seoDescription,
    socialMediaId: item.socialMediaId,
    noindex: item.noindex,
    canonicalOverride: item.canonicalOverride,
  };
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Only what changed, shaped for the API of that kind (pages have no blog, excerpt or tags; posts no menu flag). */
export function changesBetween(kind: ContentKind, saved: EditableContent, next: EditableContent): UpdatePageInput | UpdateArticleInput {
  const keys: Array<keyof EditableContent> = kind === "page"
    ? ["title", "handle", "content", "authorName", "showInNavigation", "featuredMediaId", "seoTitle", "seoDescription", "socialMediaId", "noindex", "canonicalOverride"]
    : ["title", "handle", "content", "excerpt", "tags", "authorName", "blogId", "featuredMediaId", "seoTitle", "seoDescription", "socialMediaId", "noindex", "canonicalOverride"];
  const patch: Record<string, unknown> = {};
  for (const key of keys) if (!same(saved[key], next[key])) patch[key] = key === "authorName" ? (next.authorName.trim() || null) : next[key];
  return patch;
}

/** Problems that would make the server refuse a save, shown next to the fields before anything is sent. */
export function contentProblems(value: EditableContent, kind: ContentKind): Partial<Record<"title" | "handle" | "blogId", string>> {
  const problems: Partial<Record<"title" | "handle" | "blogId", string>> = {};
  if (!value.title.trim()) problems.title = `Give the ${kind === "page" ? "page" : "post"} a title.`;
  if (value.handle && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.handle)) problems.handle = "Use lowercase letters, numbers and hyphens only, like about-us.";
  if (kind === "post" && !value.blogId) problems.blogId = "Choose which blog this post belongs to.";
  return problems;
}
