"use client";

import { useMemo } from "react";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import { createContentApi, contentState, type ArticleResource, type ContentApi, type ContentState, type PageResource } from "@/features/content/api/client";
import type { EditorMediaSource } from "@/features/content-editor/content-editor";

export type ContentKind = "page" | "post";

/** Words and addresses for each kind, so one list and one editor serve pages and blog posts. */
export const KIND = {
  page: {
    singular: "page", plural: "pages", title: "Pages", add: "Add page", listPath: "/admin/content/pages",
    description: "Information pages such as About us, Delivery and Returns. Shoppers reach them from your menus and footer.",
    emptyTitle: "Add your first page",
    emptyText: "Pages hold information that rarely changes, like your story, delivery times or returns. Add one, then link it from a menu.",
  },
  post: {
    singular: "post", plural: "posts", title: "Blog posts", add: "Add blog post", listPath: "/admin/content/blogs",
    description: "News, guides and stories. Posts live in a blog; most shops need just one, called News or Journal.",
    emptyTitle: "Write your first blog post",
    emptyText: "Blog posts help shoppers find you in search and give them a reason to come back. Write a guide, a story or news.",
  },
} as const;

export type ContentItem = PageResource | ArticleResource;

/** The content API for the signed-in merchant's active store; null until signed in. */
export function useContentApi(): { api: ContentApi | null; storeId: string; storeSlug: string; media: EditorMediaSource | undefined; listImages?: () => Promise<import("@/features/store-editor/api/types").MediaRecord[]> } {
  const { session, activeStore } = useAuth();
  const token = session?.access_token;
  const storeId = activeStore?.id ?? "";
  const baseUrl = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
  return useMemo(() => {
    if (!token || !storeId) return { api: null, storeId, storeSlug: activeStore?.slug ?? "", media: undefined };
    const editorApi = createStoreEditorApi({ baseUrl, token });
    const api = createContentApi({ baseUrl, token });
    const listImages = editorApi.listMedia ? () => editorApi.listMedia!(storeId) : undefined;
    const media: EditorMediaSource = {
      ...(listImages ? { list: async () => (await listImages()).filter((item) => item.mimeType.startsWith("image/")).map((item) => ({ id: item.id, url: item.url, name: item.originalName, width: item.width, height: item.height })) } : {}),
      upload: async (file) => {
        const item = await editorApi.uploadMedia(storeId, file);
        return { id: item.id, url: item.url, name: item.originalName, width: item.width, height: item.height };
      },
    };
    return { api, storeId, storeSlug: activeStore?.slug ?? "", media, listImages };
  }, [token, storeId, baseUrl, activeStore?.slug]);
}

export const STATE_BADGE: Record<ContentState, string> = { published: "PUBLISHED", draft: "DRAFT", scheduled: "SCHEDULED", archived: "ARCHIVED" };

export { contentState };

const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dateOnly = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** "Just now", "5 minutes ago", "Today at 14:05", "3 Mar 2026". */
export function whenLabel(value: string | null | undefined, now = Date.now()): string {
  if (!value) return "";
  const date = new Date(value);
  const seconds = Math.round((now - date.getTime()) / 1000);
  if (seconds < 45) return "Just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86_400 && new Date(now).getDate() === date.getDate()) return `Today at ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  return dateOnly.format(date);
}

export function scheduleLabel(value: string | null | undefined): string {
  return value ? dateTime.format(new Date(value)) : "";
}

/** A browser time input value ("2026-12-01T09:00") for an ISO time, in the merchant's own time zone. */
export function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** The message to show for any failure (server messages are already plain). */
export function problem(reason: unknown, fallback = "Something went wrong. Try again."): string {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}
