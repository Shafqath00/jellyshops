import { Router } from "express";
import { z } from "zod";
import { requireMerchant, requireStorePermission } from "../auth/middleware.js";
import type { AuthProvider } from "../auth/types.js";
import { ApiError } from "../http/errors.js";
import type {
  CreateArticleInput,
  CreateBlogInput,
  CreatePageInput,
  UpdateArticleInput,
  UpdateBlogInput,
  UpdatePageInput,
} from "./service.js";

export interface ContentApi {
  listPages(storeId: string): Promise<unknown[]>;
  getPage(storeId: string, id: string): Promise<unknown | null>;
  createPage(storeId: string, input: CreatePageInput): Promise<unknown>;
  updatePage(storeId: string, id: string, input: UpdatePageInput): Promise<unknown>;
  publishPage(storeId: string, id: string): Promise<unknown>;
  unpublishPage(storeId: string, id: string): Promise<unknown>;

  listBlogs(storeId: string): Promise<unknown[]>;
  getBlog(storeId: string, id: string): Promise<unknown | null>;
  createBlog(storeId: string, input: CreateBlogInput): Promise<unknown>;
  updateBlog(storeId: string, id: string, input: UpdateBlogInput): Promise<unknown>;

  listArticles(storeId: string, blogId?: string): Promise<unknown[]>;
  getArticle(storeId: string, id: string): Promise<unknown | null>;
  createArticle(storeId: string, input: CreateArticleInput): Promise<unknown>;
  updateArticle(storeId: string, id: string, input: UpdateArticleInput): Promise<unknown>;
  publishArticle(storeId: string, id: string): Promise<unknown>;
  unpublishArticle(storeId: string, id: string): Promise<unknown>;
}

const contentDocumentSchema = z.record(z.string(), z.unknown());
const nullableText = z.string().trim().nullable().optional();

const pageCreateSchema = z.object({
  title: z.string().min(1),
  handle: z.string().min(1),
  content: contentDocumentSchema,
  featuredMediaId: z.string().min(1).optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  socialMediaId: z.string().min(1).optional(),
  noindex: z.boolean().optional(),
  canonicalOverride: z.string().optional(),
}).strict();

const pageUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  handle: z.string().min(1).optional(),
  content: contentDocumentSchema.optional(),
  featuredMediaId: nullableText,
  seoTitle: nullableText,
  seoDescription: nullableText,
  socialMediaId: nullableText,
  noindex: z.boolean().optional(),
  canonicalOverride: nullableText,
}).strict();

const blogCreateSchema = z.object({ title: z.string().min(1), handle: z.string().min(1) }).strict();
const blogUpdateSchema = blogCreateSchema.partial().strict();

const articleCreateSchema = z.object({
  blogId: z.string().min(1),
  title: z.string().min(1),
  handle: z.string().min(1),
  excerpt: z.string().optional(),
  content: contentDocumentSchema,
  featuredMediaId: z.string().min(1).optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  socialMediaId: z.string().min(1).optional(),
  noindex: z.boolean().optional(),
  canonicalOverride: z.string().optional(),
}).strict();

const articleUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  handle: z.string().min(1).optional(),
  excerpt: z.string().optional(),
  content: contentDocumentSchema.optional(),
  featuredMediaId: nullableText,
  seoTitle: nullableText,
  seoDescription: nullableText,
  socialMediaId: nullableText,
  noindex: z.boolean().optional(),
  canonicalOverride: nullableText,
}).strict();

function storeId(request: Express.Request): string {
  return request.storeContext!.storeId;
}

function notFound(resource: string): never {
  throw new ApiError(404, "CONTENT_NOT_FOUND", `${resource} was not found`);
}

export function createContentRouter(service: ContentApi, authProvider: AuthProvider): Router {
  const router = Router({ mergeParams: true });
  router.use(requireMerchant(authProvider));

  router.get("/pages", requireStorePermission("content:view"), async (request, response, next) => {
    try { response.json(await service.listPages(storeId(request))); } catch (error) { next(error); }
  });
  router.get("/pages/:pageId", requireStorePermission("content:view"), async (request, response, next) => {
    try {
      const page = await service.getPage(storeId(request), String(request.params.pageId));
      response.json(page ?? notFound("Page"));
    } catch (error) { next(error); }
  });
  router.post("/pages", requireStorePermission("content:edit"), async (request, response, next) => {
    try { response.status(201).json(await service.createPage(storeId(request), pageCreateSchema.parse(request.body))); } catch (error) { next(error); }
  });
  router.patch("/pages/:pageId", requireStorePermission("content:edit"), async (request, response, next) => {
    try { response.json(await service.updatePage(storeId(request), String(request.params.pageId), pageUpdateSchema.parse(request.body))); } catch (error) { next(error); }
  });
  router.post("/pages/:pageId/publish", requireStorePermission("content:edit"), async (request, response, next) => {
    try { response.json(await service.publishPage(storeId(request), String(request.params.pageId))); } catch (error) { next(error); }
  });
  router.post("/pages/:pageId/unpublish", requireStorePermission("content:edit"), async (request, response, next) => {
    try { response.json(await service.unpublishPage(storeId(request), String(request.params.pageId))); } catch (error) { next(error); }
  });

  router.get("/blogs", requireStorePermission("content:view"), async (request, response, next) => {
    try { response.json(await service.listBlogs(storeId(request))); } catch (error) { next(error); }
  });
  router.get("/blogs/:blogId", requireStorePermission("content:view"), async (request, response, next) => {
    try {
      const blog = await service.getBlog(storeId(request), String(request.params.blogId));
      response.json(blog ?? notFound("Blog"));
    } catch (error) { next(error); }
  });
  router.post("/blogs", requireStorePermission("content:edit"), async (request, response, next) => {
    try { response.status(201).json(await service.createBlog(storeId(request), blogCreateSchema.parse(request.body))); } catch (error) { next(error); }
  });
  router.patch("/blogs/:blogId", requireStorePermission("content:edit"), async (request, response, next) => {
    try { response.json(await service.updateBlog(storeId(request), String(request.params.blogId), blogUpdateSchema.parse(request.body))); } catch (error) { next(error); }
  });

  router.get("/articles", requireStorePermission("content:view"), async (request, response, next) => {
    try {
      const blogId = typeof request.query.blogId === "string" ? request.query.blogId : undefined;
      response.json(await service.listArticles(storeId(request), blogId));
    } catch (error) { next(error); }
  });
  router.get("/articles/:articleId", requireStorePermission("content:view"), async (request, response, next) => {
    try {
      const article = await service.getArticle(storeId(request), String(request.params.articleId));
      response.json(article ?? notFound("Article"));
    } catch (error) { next(error); }
  });
  router.post("/articles", requireStorePermission("content:edit"), async (request, response, next) => {
    try { response.status(201).json(await service.createArticle(storeId(request), articleCreateSchema.parse(request.body))); } catch (error) { next(error); }
  });
  router.patch("/articles/:articleId", requireStorePermission("content:edit"), async (request, response, next) => {
    try { response.json(await service.updateArticle(storeId(request), String(request.params.articleId), articleUpdateSchema.parse(request.body))); } catch (error) { next(error); }
  });
  router.post("/articles/:articleId/publish", requireStorePermission("content:edit"), async (request, response, next) => {
    try { response.json(await service.publishArticle(storeId(request), String(request.params.articleId))); } catch (error) { next(error); }
  });
  router.post("/articles/:articleId/unpublish", requireStorePermission("content:edit"), async (request, response, next) => {
    try { response.json(await service.unpublishArticle(storeId(request), String(request.params.articleId))); } catch (error) { next(error); }
  });

  return router;
}
