import { titleLength } from "./shared";
import { isRichTextDocument, type SectionNode } from "@jelly/storefront-schema";
import { elementProps } from "../element-style";
import type { ReactNode } from "react";
import { StorefrontContainer } from "@jelly/storefront-ui";
import { renderBlocks } from "./rich-text";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { choice, numberValue, sectionData, stringValue } from "./shared";
import { formattedSetting, SettingText } from "./setting-text";

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
  return <section className="jelly-section jelly-page-content"><StorefrontContainer><article className="jelly-prose"><h1 {...titleLength(title)}>{title}</h1>{content}</article></StorefrontContainer></section>;
}

function blogData(context: StorefrontRuntimeContext): { storeSlug: string; title: string; handle: string; articles: Array<{ id: string; title: string; handle: string; excerpt: string; publishedAt?: string }> } | null {
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
      ? [{ id: article.id, title: article.title, handle: article.handle, excerpt: typeof article.excerpt === "string" ? article.excerpt : "", ...(validDate(article.publishedAt) ? { publishedAt: article.publishedAt } : {}) }]
      : [];
  }) : [];
  return { storeSlug: typeof data.storeSlug === "string" ? data.storeSlug : "", title: record.title, handle: record.handle, articles };
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

/** "March 12, 2026"; dates are stored in UTC so the label never shifts by a day. */
function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(value));
}

const alignment = (section: SectionNode) => choice(section.settings, "contentAlignment", ["left", "center"] as const, "left");

export function BlogHeaderSection({ context, section }: { context: StorefrontRuntimeContext; section?: SectionNode }) {
  const blog = blogData(context);
  if (!blog) return null;
  return <section className="jelly-section jelly-blog-header" {...(section ? sectionData(section, { "data-align": alignment(section) }) : {})}><StorefrontContainer>
    <h1 {...titleLength(blog.title)}>{blog.title}</h1>
    {section && <SettingText className="jelly-blog-header-text" text={stringValue(section.settings, "text")} document={formattedSetting(section.settings, "text")} {...elementProps(section, "text", context.mode === "editor")} />}
  </StorefrontContainer></section>;
}

/**
 * The blog's articles as a list or a grid. Sections saved before these
 * settings existed keep their look: summaries on, dates and "Read more" off.
 */
export function ArticleListSection({ context, section }: { context: StorefrontRuntimeContext; section?: SectionNode }) {
  const blog = blogData(context);
  if (!blog) return null;
  const settings = section?.settings;
  const layout = choice(settings, "layout", ["list", "grid"] as const, "list");
  const showExcerpt = settings?.showExcerpt !== false;
  const showDate = settings?.showDate === true;
  const readMore = stringValue(settings, "readMoreLabel").trim();
  const empty = stringValue(settings, "emptyMessage").trim() || "No articles have been published yet.";
  const columns = layout === "grid" ? String(numberValue(settings, "columns", 3, 2, 3)) : undefined;
  return <section className="jelly-section jelly-article-list" {...(section ? sectionData(section, { "data-layout": layout, "data-columns": columns }) : {})}><StorefrontContainer>
    {blog.articles.length ? <div className="jelly-article-list-items">{blog.articles.map((article) => {
      const href = `/${blog.storeSlug}/blogs/${blog.handle}/${article.handle}`;
      return <article key={article.id}>
        {showDate && article.publishedAt && <time className="jelly-article-published-at" dateTime={article.publishedAt}>{dateLabel(article.publishedAt)}</time>}
        <h2><a href={href}>{article.title}</a></h2>
        {showExcerpt && article.excerpt && <p>{article.excerpt}</p>}
        {readMore && <a className="jelly-article-read-more" href={href} aria-label={`${readMore}: ${article.title}`}>{readMore}</a>}
      </article>;
    })}</div> : <p>{empty}</p>}
  </StorefrontContainer></section>;
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
    ...(validDate(record.publishedAt) ? { publishedAt: record.publishedAt } : {}),
  };
}

export function ArticleHeaderSection({ context, section }: { context: StorefrontRuntimeContext; section?: SectionNode }) {
  const article = articleData(context);
  if (!article) return null;
  const showDate = section?.settings.showDate !== false;
  const showExcerpt = section?.settings.showExcerpt !== false;
  return <section className="jelly-section jelly-article-header" {...(section ? sectionData(section, { "data-align": alignment(section) }) : {})}><StorefrontContainer>
    <h1 {...titleLength(article.title)}>{article.title}</h1>
    {showDate && article.publishedAt && <time className="jelly-article-published-at" dateTime={article.publishedAt}>Published {dateLabel(article.publishedAt)}</time>}
    {showExcerpt && article.excerpt && <p>{article.excerpt}</p>}
  </StorefrontContainer></section>;
}

export function ArticleContentSection({ context, section }: { context: StorefrontRuntimeContext; section?: SectionNode }) {
  const article = articleData(context);
  if (!article) return null;
  const width = choice(section?.settings, "textWidth", ["narrow", "medium", "wide"] as const, "medium");
  return <section className="jelly-section jelly-article-content" {...(section ? sectionData(section, { "data-width": width === "medium" ? undefined : width }) : {})}><StorefrontContainer><article className="jelly-prose">{renderContent(article.content)}</article></StorefrontContainer></section>;
}
