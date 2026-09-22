import { StorefrontContainer } from "@jelly/storefront-ui";
import type { StorefrontRuntimeContext } from "../runtime-context";

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
  const content = textFromContent(data.content);
  return <section className="jelly-section jelly-page-content"><StorefrontContainer><article><h1>{title}</h1>{content.map((paragraph, index) => <p key={`${index}-${paragraph}`}>{paragraph}</p>)}</article></StorefrontContainer></section>;
}
