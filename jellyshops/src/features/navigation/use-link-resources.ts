"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminCatalog, type CollectionRow } from "@/features/admin/api/catalog-api";
import type { CatalogAdminProduct, CatalogPage } from "@/features/admin/api/catalog-api";
import { contentState, type ArticleResource, type BlogResource, type ContentApi, type PageResource } from "@/features/content/api/client";
import { EMPTY_RESOURCES, type LinkResource, type LinkResources, type ResourceState } from "./link-check";

const STATE: Record<ReturnType<typeof contentState>, ResourceState> = { published: "live", draft: "draft", scheduled: "scheduled", archived: "archived" };

export function pageResource(page: PageResource): LinkResource {
  return { id: page.id, title: page.title || "Untitled page", path: `/pages/${page.handle}`, state: STATE[contentState(page)] };
}

export function postResource(post: ArticleResource, blogs: BlogResource[]): LinkResource {
  const blog = blogs.find((entry) => entry.id === post.blogId);
  return { id: post.id, title: post.title || "Untitled post", path: `/blogs/${blog?.handle ?? "blog"}/${post.handle}`, state: STATE[contentState(post)] };
}

export function productResource(product: Pick<CatalogAdminProduct, "id" | "title" | "handle" | "status">): LinkResource {
  return { id: product.id, title: product.title, path: `/products/${product.handle}`, state: product.status === "ACTIVE" ? "live" : product.status === "ARCHIVED" ? "archived" : "draft" };
}

/**
 * Everything a menu link can point to, for the link picker and the broken-link warnings. Products are looked up
 * one by one (only those `productIdsInUse` names) and found by search; the other lists load in full.
 */
export function useLinkResources(content: ContentApi | null, storeId: string, productIdsInUse: string[]) {
  const { request, all, ready: catalogReady } = useAdminCatalog();
  const [resources, setResources] = useState<LinkResources>(EMPTY_RESOURCES);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!content || !storeId || !catalogReady) return;
    let active = true;
    Promise.all([content.listPages(storeId), content.listBlogs(storeId), content.listArticles(storeId), all<CollectionRow>("/collections")])
      .then(([pages, blogs, posts, collections]) => {
        if (!active) return;
        setResources((current) => ({
          ...current,
          pages: pages.map(pageResource),
          blogs: blogs.map((blog) => ({ id: blog.id, title: blog.title, path: `/blogs/${blog.handle}`, state: "live" as const })),
          posts: posts.map((post) => postResource(post, blogs)),
          collections: collections.map((collection) => ({ id: collection.id, title: collection.title, path: `/collections/${collection.handle}`, state: "live" as const })),
          ready: true,
        }));
        setError("");
      })
      .catch(() => { if (active) setError("Your pages and collections could not be loaded, so broken links can't be checked right now."); });
    return () => { active = false; };
  }, [all, attempt, catalogReady, content, storeId]);

  // Products menus already point to: looked up so their names show and missing ones are flagged.
  const wanted = productIdsInUse.join(",");
  useEffect(() => {
    if (!catalogReady || !wanted) return;
    let active = true;
    const ids = wanted.split(",");
    void Promise.all(ids.map((id) => request<CatalogAdminProduct>(`/products/${encodeURIComponent(id)}`).then(productResource).catch(() => null)))
      .then((found) => {
        if (!active) return;
        setResources((current) => {
          const known = new Map(current.products.map((product) => [product.id, product]));
          for (const product of found) if (product) known.set(product.id, product);
          return { ...current, products: [...known.values()] };
        });
      });
    return () => { active = false; };
  }, [catalogReady, request, wanted]);

  const searchProducts = useCallback(async (query: string): Promise<LinkResource[]> => {
    const params = new URLSearchParams({ limit: "8", ...(query.trim() ? { query: query.trim() } : {}) });
    const page = await request<CatalogPage<CatalogAdminProduct>>(`/products?${params}`);
    const found = page.nodes.map(productResource);
    setResources((current) => {
      const known = new Map(current.products.map((product) => [product.id, product]));
      for (const product of found) known.set(product.id, product);
      return { ...current, products: [...known.values()] };
    });
    return found;
  }, [request]);

  return { resources, error, retry: () => setAttempt((count) => count + 1), searchProducts };
}
