import { isRichTextDocument } from "@jelly/storefront-schema";
import type { ReactNode } from "react";
import { StorefrontContainer } from "@jelly/storefront-ui";
import { renderBlocks } from "./rich-text";
import type { StorefrontRuntimeContext } from "../runtime-context";

/** Saved page/article content: rich text documents keep headings and lists; older plain text becomes paragraphs. */
function renderContent(value: unknown): ReactNode[] {
  if (isRichTextDocument(value)) {
    // The document check accepts paragraphs and headings saved without a `content` list (an empty line in the page editor), so treat a missing list as empty.
    const blocks = value.content
      .filter((block) => !(block.type === "paragraph" && !block.content?.length))
      .map((block) => block.type === "heading" && !block.content ? { ...block, content: [] } : block);
    return renderBlocks(blocks);
  }
  return textFromContent(value).map((paragraph, index) => <p key={`${index}-${paragraph}`}>{paragraph}</p>);
}

function textFromContent(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  const direct = [record.text, record.body].filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()));
  const blocks = Array.isArray(record.blocks) ? record.blocks.flatMap(textFromContent) : [];
  return [...direct, ...blocks];
}

export function PageContentSection({ context }: { context: StorefrontRuntimeContext }) {
  if (context.page?.pageType !== "page") return null;
  const data = context.page.resource.data;
  const title = typeof data.title === "string" ? data.title : "Page";
  const content = renderContent(data.content);
  return <section className="jelly-section jelly-page-content"><StorefrontContainer><article className="jelly-prose"><h1>{title}</h1>{content}</article></StorefrontContainer></section>;
}

function blogData(context: StorefrontRuntimeContext): { storeSlug: string; title: string; handle: string; articles: Array<{ id: string; title: string; handle: string; excerpt: string }> } | null {
  if (context.page?.pageType !== "blog") return null;
  const data = context.page.resource.data;
  const blog = data.blog;
  if (!blog || typeof blog !== "object" || Array.isArray(blog)) return null;
  const record = blog as Record<string, unknown>;
  if (typeof record.title !== "string" || typeof record.handle !== "string") return null;
  const articles = Array.isArray(data.articles) ? data.articles.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const article = entry as Record<string, unknown>;
    return typeof article.id === "string" && typeof article.title === "string" && typeof article.handle === "string"
      ? [{ id: article.id, title: article.title, handle: article.handle, excerpt: typeof article.excerpt === "string" ? article.excerpt : "" }]
      : [];
  }) : [];
  return { storeSlug: typeof data.storeSlug === "string" ? data.storeSlug : "", title: record.title, handle: record.handle, articles };
}

export function BlogHeaderSection({ context }: { context: StorefrontRuntimeContext }) {
  const blog = blogData(context);
  return blog ? <section className="jelly-section jelly-blog-header"><StorefrontContainer><h1>{blog.title}</h1></StorefrontContainer></section> : null;
}

export function ArticleListSection({ context }: { context: StorefrontRuntimeContext }) {
  const blog = blogData(context);
  if (!blog) return null;
  return <section className="jelly-section jelly-article-list"><StorefrontContainer>{blog.articles.length ? <div>{blog.articles.map((article) => <article key={article.id}><h2><a href={`/${blog.storeSlug}/blogs/${blog.handle}/${article.handle}`}>{article.title}</a></h2>{article.excerpt && <p>{article.excerpt}</p>}</article>)}</div> : <p>No articles have been published yet.</p>}</StorefrontContainer></section>;
}

function articleData(context: StorefrontRuntimeContext): { title: string; excerpt: string; content: unknown; publishedAt?: string } | null {
  if (context.page?.pageType !== "article") return null;
  const article = context.page.resource.data.article;
  if (!article || typeof article !== "object" || Array.isArray(article)) return null;
  const record = article as Record<string, unknown>;
  if (typeof record.title !== "string") return null;
  return {
    title: record.title,
    excerpt: typeof record.excerpt === "string" ? record.excerpt : "",
    content: record.content,
    ...(typeof record.publishedAt === "string" && Number.isFinite(Date.parse(record.publishedAt))
      ? { publishedAt: record.publishedAt }
      : {}),
  };
}

export function ArticleHeaderSection({ context }: { context: StorefrontRuntimeContext }) {
  const article = articleData(context);
  const publishedDate = article?.publishedAt ? new Date(article.publishedAt) : undefined;
  const publicationLabel = publishedDate
    ? new Intl.DateTimeFormat("en", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(publishedDate)
    : undefined;
  return article ? <section className="jelly-section jelly-article-header"><StorefrontContainer><h1>{article.title}</h1>{publicationLabel && article.publishedAt && <time className="jelly-article-published-at" dateTime={article.publishedAt}>Published {publicationLabel}</time>}{article.excerpt && <p>{article.excerpt}</p>}</StorefrontContainer></section> : null;
}

export function ArticleContentSection({ context }: { context: StorefrontRuntimeContext }) {
  const article = articleData(context);
  if (!article) return null;
  return <section className="jelly-section jelly-article-content"><StorefrontContainer><article className="jelly-prose">{renderContent(article.content)}</article></StorefrontContainer></section>;
}
