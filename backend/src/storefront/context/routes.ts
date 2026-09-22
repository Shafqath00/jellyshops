import { Router } from "express";
import { ApiError } from "../../http/errors.js";
import type { PublicStorefrontContextService } from "./service.js";

type PublicContextApi = Pick<PublicStorefrontContextService, "search" | "page" | "blog" | "article">;

function missing(): never {
  throw new ApiError(404, "STOREFRONT_CONTEXT_NOT_FOUND", "Storefront context was not found");
}

export function createPublicStorefrontContextRouter(service: PublicContextApi): Router {
  const router = Router({ mergeParams: true });
  router.get<{ storeId: string }>("/search", async (request, response, next) => {
    try { response.json(await service.search(String(request.params.storeId), typeof request.query.q === "string" ? request.query.q : "")); } catch (error) { next(error); }
  });
  router.get<{ storeId: string; pageHandle: string }>("/pages/:pageHandle", async (request, response, next) => {
    try { response.json((await service.page(String(request.params.storeId), String(request.params.pageHandle))) ?? missing()); } catch (error) { next(error); }
  });
  router.get<{ storeId: string; blogHandle: string }>("/blogs/:blogHandle", async (request, response, next) => {
    try { response.json((await service.blog(String(request.params.storeId), String(request.params.blogHandle))) ?? missing()); } catch (error) { next(error); }
  });
  router.get<{ storeId: string; blogHandle: string; articleHandle: string }>("/blogs/:blogHandle/articles/:articleHandle", async (request, response, next) => {
    try { response.json((await service.article(String(request.params.storeId), String(request.params.blogHandle), String(request.params.articleHandle))) ?? missing()); } catch (error) { next(error); }
  });
  return router;
}
