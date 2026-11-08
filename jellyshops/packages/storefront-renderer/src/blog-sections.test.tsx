import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import type { StorefrontRuntimeContext } from "./runtime-context";
import { ArticleContentSection, ArticleHeaderSection, ArticleListSection, BlogHeaderSection } from "./sections/content-pages";

const blogWith = (articles: Array<Record<string, unknown>>): StorefrontRuntimeContext => ({
  mode: "published",
  commerce: { getProducts: async () => [] },
  page: { pageType: "blog", resource: { id: "news", handle: "news", data: { storeSlug: "demo", blog: { title: "Journal", handle: "news" }, articles } } },
});
const blogContext = blogWith([{ id: "a1", title: "Spring edit", handle: "spring", excerpt: "New colours.", publishedAt: "2026-03-12T00:00:00Z" }]);
const articleContext: StorefrontRuntimeContext = {
  mode: "published",
  commerce: { getProducts: async () => [] },
  page: { pageType: "article", resource: { id: "a1", handle: "spring", data: { article: { title: "Spring edit", excerpt: "New colours.", content: { text: "Body" }, publishedAt: "2026-03-12T00:00:00Z" } } } },
};
const section = (type: string, settings: Record<string, unknown> = {}): SectionNode => ({ id: type, type, enabled: true, settings, blocks: [] });

it("keeps the original article list when the section has no settings", () => {
  const { container } = render(<ArticleListSection context={blogContext} section={section("article-list")} />);
  expect(screen.getByRole("link", { name: "Spring edit" })).toHaveAttribute("href", "/demo/blogs/news/spring");
  expect(screen.getByText("New colours.")).toBeInTheDocument();
  expect(container.querySelector("time")).toBeNull();
  expect(container.querySelector(".jelly-article-list")).toHaveAttribute("data-layout", "list");
});

it("shows the article list as a grid with dates, without summaries and with a Read more link", () => {
  const { container } = render(<ArticleListSection context={blogContext} section={section("article-list", { layout: "grid", columns: 2, showDate: true, showExcerpt: false, readMoreLabel: "Read more" })} />);
  const list = container.querySelector(".jelly-article-list");
  expect(list).toHaveAttribute("data-layout", "grid");
  expect(list).toHaveAttribute("data-columns", "2");
  expect(screen.getByText("March 12, 2026")).toHaveAttribute("datetime", "2026-03-12T00:00:00Z");
  expect(screen.queryByText("New colours.")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Read more: Spring edit" })).toHaveAttribute("href", "/demo/blogs/news/spring");
});

it("uses the merchant's message when a blog has no articles", () => {
  render(<ArticleListSection context={blogWith([])} section={section("article-list", { emptyMessage: "Stories coming soon." })} />);
  expect(screen.getByText("Stories coming soon.")).toBeInTheDocument();
});

it("adds text and alignment to the blog title", () => {
  const { container } = render(<BlogHeaderSection context={blogContext} section={section("blog-header", { text: "Notes from the studio.", contentAlignment: "center" })} />);
  expect(screen.getByRole("heading", { name: "Journal" })).toBeInTheDocument();
  expect(screen.getByText("Notes from the studio.")).toBeInTheDocument();
  expect(container.querySelector(".jelly-blog-header")).toHaveAttribute("data-align", "center");
});

it("lets the article header hide the date and summary, and the body change width", () => {
  render(<ArticleHeaderSection context={articleContext} section={section("article-header", { showDate: false, showExcerpt: false })} />);
  expect(screen.queryByText(/Published/)).not.toBeInTheDocument();
  expect(screen.queryByText("New colours.")).not.toBeInTheDocument();
  const { container } = render(<ArticleContentSection context={articleContext} section={section("article-content", { textWidth: "wide" })} />);
  expect(container.querySelector(".jelly-article-content")).toHaveAttribute("data-width", "wide");
});

it("shows the date and summary by default in the article header", () => {
  render(<ArticleHeaderSection context={articleContext} section={section("article-header")} />);
  expect(screen.getByText("Published March 12, 2026")).toBeInTheDocument();
  expect(screen.getByText("New colours.")).toBeInTheDocument();
});
