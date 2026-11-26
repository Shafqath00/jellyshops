/**
 * What each menu link points to, in words, and whether shoppers can actually reach it: a deleted, archived, draft
 * or scheduled page, post or product makes a broken link on the live store.
 */
import { safeRichTextHref } from "@jelly/storefront-schema";
import type { MenuItem, MenuTarget } from "./api/client";

export type ResourceState = "live" | "draft" | "scheduled" | "archived";

export interface LinkResource {
  id: string;
  title: string;
  /** Store path shoppers see, e.g. /pages/about. */
  path: string;
  state: ResourceState;
}

export interface LinkResources {
  pages: LinkResource[];
  posts: LinkResource[];
  blogs: LinkResource[];
  collections: LinkResource[];
  /** Products are many: only the ones menus point to (and recent search results) are known. */
  products: LinkResource[];
  /** False until the lists have loaded; no warnings are shown before that. */
  ready: boolean;
}

export const EMPTY_RESOURCES: LinkResources = { pages: [], posts: [], blogs: [], collections: [], products: [], ready: false };

const LIST: Record<"page" | "article" | "blog" | "collection" | "product", keyof Omit<LinkResources, "ready">> = {
  page: "pages", article: "posts", blog: "blogs", collection: "collections", product: "products",
};
const NOUN: Record<keyof typeof LIST, string> = { page: "page", article: "blog post", blog: "blog", collection: "collection", product: "product" };

export function findResource(resources: LinkResources, target: MenuTarget): LinkResource | null {
  if (!("resourceId" in target)) return null;
  return resources[LIST[target.kind as keyof typeof LIST]].find((entry) => entry.id === target.resourceId) ?? null;
}

/** "Page: About us", "Home page", "https://example.com". */
export function describeTarget(target: MenuTarget, resources: LinkResources): string {
  switch (target.kind) {
    case "home": return "Home page";
    case "search": return "Search page";
    case "external": return target.url;
    case "anchor": return `#${target.anchor}`;
    default: {
      const found = findResource(resources, target);
      const noun = NOUN[target.kind as keyof typeof NOUN];
      return found ? `${noun[0]!.toUpperCase()}${noun.slice(1)}: ${found.title}` : `${noun[0]!.toUpperCase()}${noun.slice(1)}`;
    }
  }
}

/** A plain warning when shoppers would not reach this link, or null when it is fine. */
export function linkProblem(target: MenuTarget, resources: LinkResources): string | null {
  if (target.kind === "external") return safeRichTextHref(target.url) ? null : "This web address isn't valid. Use https://… or a store path like /pages/faq.";
  if (target.kind === "anchor") return /^[A-Za-z][\w:.-]*$/.test(target.anchor) ? null : "Use letters, numbers and hyphens for the section name.";
  if (!("resourceId" in target) || !resources.ready) return null;
  const noun = NOUN[target.kind as keyof typeof NOUN];
  const found = findResource(resources, target);
  if (!found) return `The ${noun} this links to was deleted. Choose another destination.`;
  if (found.state === "archived") return `The ${noun} “${found.title}” is archived, so shoppers can't open this link.`;
  if (found.state === "draft") return `The ${noun} “${found.title}” isn't published yet, so shoppers can't open this link.`;
  if (found.state === "scheduled") return `The ${noun} “${found.title}” isn't live until it's published on schedule.`;
  return null;
}

export interface LinkIssue { id: string; label: string; problem: string }

/** Every link in a menu that shoppers could not reach. */
export function menuIssues(items: MenuItem[], resources: LinkResources): LinkIssue[] {
  return items.flatMap((item) => {
    const problem = linkProblem(item.target, resources);
    return [...(problem ? [{ id: item.id, label: item.label, problem }] : []), ...menuIssues(item.children, resources)];
  });
}

/** Product ids menus point to (to look them up, since the full product list is not loaded). */
export function productIds(items: MenuItem[]): string[] {
  return [...new Set(items.flatMap((item) => [...(item.target.kind === "product" ? [item.target.resourceId] : []), ...productIds(item.children)]))];
}
