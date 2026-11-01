import { expect, it } from "vitest";
import { createResourceLinks } from "./resource-links";
it("builds canonical URLs for stable resource IDs, including article blog handles", () => {
  expect(createResourceLinks("new", [
    { kind: "product", id: "p", handle: "bed" }, { kind: "page", id: "a", handle: "about" },
    { kind: "blog", id: "b", handle: "news" }, { kind: "article", id: "c", handle: "hello", blogHandle: "news" },
    { kind: "article", id: "missing-blog", handle: "oops" },
  ])).toEqual({ "product:p": "/new/products/bed", "page:a": "/new/about", "blog:b": "/new/blogs/news", "article:c": "/new/blogs/news/hello" });
});
