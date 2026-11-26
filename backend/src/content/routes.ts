import { Router, type Request, type RequestHandler } from "express";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { ApiError } from "../http/errors.js";
import type { ContentActor, ContentService } from "./service.js";
import {
  articleCreateSchema,
  articleUpdateSchema,
  blogCreateSchema,
  blogUpdateSchema,
  bulkSchema,
  handleQuerySchema,
  listDates,
  listQuerySchema,
  pageCreateSchema,
  pageUpdateSchema,
  scheduleSchema,
} from "./schemas.js";
import type { ContentListQuery } from "./rules.js";
import { htmlToRichTextDocument, MAX_IMPORT_HTML_BYTES } from "./html-import.js";
import { richTextToHtml } from "@jelly/storefront-schema";
import { z } from "zod";

const importHtmlSchema = z.object({ html: z.string().max(MAX_IMPORT_HTML_BYTES) }).strip();
const exportHtmlSchema = z.object({ content: z.record(z.string(), z.unknown()) }).strip();

/** The content service as the routes use it. */
export type ContentApi = Pick<ContentService,
  | "listPages" | "browsePages" | "getPage" | "checkPageHandle" | "createPage" | "updatePage" | "publishPage" | "unpublishPage"
  | "archivePage" | "restorePage" | "deletePage" | "duplicatePage" | "bulkPages"
  | "listBlogs" | "getBlog" | "createBlog" | "updateBlog" | "deleteBlog"
  | "listArticles" | "browseArticles" | "getArticle" | "checkArticleHandle" | "createArticle" | "updateArticle" | "publishArticle"
  | "unpublishArticle" | "archiveArticle" | "restoreArticle" | "deleteArticle" | "duplicateArticle" | "bulkArticles"
  | "resolveRedirect">;

function storeId(request: Request): string { return request.storeContext!.storeId; }
function param(request: Request, name: string): string { return String(request.params[name]); }

function notFound(label: string): never {
  throw new ApiError(404, "CONTENT_NOT_FOUND", `This ${label} doesn't exist any more. It may have been deleted.`);
}

/** The person saving becomes the author of what they create; the name shown is theirs, else their email's first part. */
function actor(request: Request): ContentActor | undefined {
  const merchant = request.merchant;
  if (!merchant) return undefined;
  const name = merchant.displayName?.trim() || merchant.email?.split("@")[0]?.trim() || null;
  return { userId: merchant.userId, name: name ? name.slice(0, 120) : null };
}

function listQuery(request: Request): ContentListQuery {
  const query = listQuerySchema.parse(request.query);
  return {
    q: query.q,
    state: query.state,
    authorUserId: query.author,
    tag: query.tag,
    blogId: query.blogId,
    ...listDates(query),
    sort: query.sort,
    direction: query.direction,
    limit: query.limit,
    offset: query.offset,
  };
}

/** Wraps an async handler so errors reach the error handler. */
function handle(run: (request: Request) => Promise<unknown>, status = 200): RequestHandler {
  return async (request, response, next) => {
    try {
      const result = await run(request);
      if (result === undefined) response.status(204).end();
      else response.status(status).json(result);
    } catch (error) {
      next(error);
    }
  };
}

export function createContentRouter(service: ContentApi, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.use(requireMerchant(authProvider));
  const view = requireStorePermission("content:view");
  const edit = requireStorePermission("content:edit");

  // Pasted or source-view HTML -> a safe document, and a document -> HTML for the source view.
  router.post("/import-html", edit, handle(async (request) => {
    const { html } = importHtmlSchema.parse(request.body);
    try {
      return { document: htmlToRichTextDocument(html) };
    } catch (error) {
      if ((error as { tooLarge?: boolean }).tooLarge) throw new ApiError(413, "CONTENT_TOO_LARGE", (error as Error).message);
      throw error;
    }
  }));
  router.post("/export-html", view, handle(async (request) => ({ html: richTextToHtml(exportHtmlSchema.parse(request.body).content) })));

  // Pages. Fixed paths come before "/pages/:pageId".
  router.get("/pages", view, handle((request) => service.listPages(storeId(request))));
  router.get("/pages/browse", view, handle((request) => service.browsePages(storeId(request), listQuery(request))));
  router.get("/pages/handle-check", view, handle((request) => {
    const query = handleQuerySchema.parse(request.query);
    return service.checkPageHandle(storeId(request), query.handle, query.excludeId);
  }));
  router.post("/pages/bulk", edit, handle((request) => {
    const body = bulkSchema.parse(request.body);
    return service.bulkPages(storeId(request), body.action, body.ids);
  }));
  router.post("/pages", edit, handle((request) => service.createPage(storeId(request), pageCreateSchema.parse(request.body), actor(request)), 201));
  router.get("/pages/:pageId", view, handle(async (request) => await service.getPage(storeId(request), param(request, "pageId")) ?? notFound("page")));
  router.patch("/pages/:pageId", edit, handle((request) => service.updatePage(storeId(request), param(request, "pageId"), pageUpdateSchema.parse(request.body))));
  router.post("/pages/:pageId/publish", edit, handle((request) => service.publishPage(storeId(request), param(request, "pageId"))));
  router.post("/pages/:pageId/unpublish", edit, handle((request) => service.unpublishPage(storeId(request), param(request, "pageId"))));
  router.post("/pages/:pageId/schedule", edit, handle((request) => service.updatePage(storeId(request), param(request, "pageId"), scheduleSchema.parse(request.body))));
  router.post("/pages/:pageId/archive", edit, handle((request) => service.archivePage(storeId(request), param(request, "pageId"))));
  router.post("/pages/:pageId/restore", edit, handle((request) => service.restorePage(storeId(request), param(request, "pageId"))));
  router.post("/pages/:pageId/duplicate", edit, handle((request) => service.duplicatePage(storeId(request), param(request, "pageId"), actor(request)), 201));
  router.delete("/pages/:pageId", edit, handle((request) => service.deletePage(storeId(request), param(request, "pageId"))));

  // Blogs.
  router.get("/blogs", view, handle((request) => service.listBlogs(storeId(request))));
  router.post("/blogs", edit, handle((request) => service.createBlog(storeId(request), blogCreateSchema.parse(request.body)), 201));
  router.get("/blogs/:blogId", view, handle(async (request) => await service.getBlog(storeId(request), param(request, "blogId")) ?? notFound("blog")));
  router.patch("/blogs/:blogId", edit, handle((request) => service.updateBlog(storeId(request), param(request, "blogId"), blogUpdateSchema.parse(request.body))));
  router.delete("/blogs/:blogId", edit, handle((request) => service.deleteBlog(storeId(request), param(request, "blogId"))));

  // Blog posts.
  router.get("/articles", view, handle((request) => {
    const blogId = typeof request.query.blogId === "string" ? request.query.blogId : undefined;
    return service.listArticles(storeId(request), blogId);
  }));
  router.get("/articles/browse", view, handle((request) => service.browseArticles(storeId(request), listQuery(request))));
  router.get("/articles/handle-check", view, handle((request) => {
    const query = handleQuerySchema.parse(request.query);
    if (!query.blogId) throw new ApiError(400, "CONTENT_INVALID", "Choose a blog to check the web address in.");
    return service.checkArticleHandle(storeId(request), query.blogId, query.handle, query.excludeId);
  }));
  router.post("/articles/bulk", edit, handle((request) => {
    const body = bulkSchema.parse(request.body);
    return service.bulkArticles(storeId(request), body.action, body.ids);
  }));
  router.post("/articles", edit, handle((request) => service.createArticle(storeId(request), articleCreateSchema.parse(request.body), actor(request)), 201));
  router.get("/articles/:articleId", view, handle(async (request) => await service.getArticle(storeId(request), param(request, "articleId")) ?? notFound("post")));
  router.patch("/articles/:articleId", edit, handle((request) => service.updateArticle(storeId(request), param(request, "articleId"), articleUpdateSchema.parse(request.body))));
  router.post("/articles/:articleId/publish", edit, handle((request) => service.publishArticle(storeId(request), param(request, "articleId"))));
  router.post("/articles/:articleId/unpublish", edit, handle((request) => service.unpublishArticle(storeId(request), param(request, "articleId"))));
  router.post("/articles/:articleId/schedule", edit, handle((request) => service.updateArticle(storeId(request), param(request, "articleId"), scheduleSchema.parse(request.body))));
  router.post("/articles/:articleId/archive", edit, handle((request) => service.archiveArticle(storeId(request), param(request, "articleId"))));
  router.post("/articles/:articleId/restore", edit, handle((request) => service.restoreArticle(storeId(request), param(request, "articleId"))));
  router.post("/articles/:articleId/duplicate", edit, handle((request) => service.duplicateArticle(storeId(request), param(request, "articleId"), actor(request)), 201));
  router.delete("/articles/:articleId", edit, handle((request) => service.deleteArticle(storeId(request), param(request, "articleId"))));

  return router;
}

/**
 * Public: where an old page, blog or post address now lives (`GET /api/public/stores/:storeId/content-redirect?path=`).
 * Answers `{ location }` (null when there is nowhere to go). Cached briefly; reveals only published addresses.
 */
export function createPublicContentRedirectRouter(service: Pick<ContentService, "resolveRedirect">): Router {
  const router = Router({ mergeParams: true });
  router.get("/content-redirect", async (request, response, next) => {
    try {
      const path = typeof request.query.path === "string" ? request.query.path.slice(0, 400) : "";
      const location = path ? await service.resolveRedirect(String((request.params as Record<string, string>).storeId), path) : null;
      response.set("Cache-Control", "public, max-age=60");
      response.json({ location });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
