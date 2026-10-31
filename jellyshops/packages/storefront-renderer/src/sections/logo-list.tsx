import { StorefrontContainer } from "@jelly/storefront-ui";
import type { CSSProperties } from "react";
import type { SectionNode } from "@jelly/storefront-schema";
import type { RendererMode } from "../types";
import { resolveStorefrontHref, type StorefrontRuntimeContext } from "../runtime-context";
import { blockEditorData } from "./block-content";
import { imageValue, numberValue, sectionData, stringValue, visibleBlocks } from "./shared";

/**
 * Brand, press or partner logos in a row. A logo without an image shows its
 * name as text; the section stays hidden on the live store until it has a logo.
 */
export function LogoListSection({ section, context, mode = "published", selectedBlockId }: { section: SectionNode; context: StorefrontRuntimeContext; mode?: RendererMode; selectedBlockId?: string }) {
  const editor = mode === "editor";
  const logos = visibleBlocks(section, "logo").flatMap((block) => {
    const image = imageValue(block.settings);
    const label = stringValue(block.settings, "label").trim();
    return image || label ? [{ block, image, label, href: resolveStorefrontHref(block.settings.link, context.storeSlug) }] : [];
  });
  if (!logos.length && !editor) return null;
  const heading = stringValue(section.settings, "heading").trim();
  const height = numberValue(section.settings, "logoHeight", 48, 24, 120);
  return <section
    className="jelly-section jelly-logo-list"
    {...sectionData(section, { "data-grayscale": section.settings.grayscale === true ? "true" : undefined })}
    style={{ "--logo-height": `${height}px` } as CSSProperties}
  ><StorefrontContainer>
    {heading && <h2 className="jelly-logo-list-heading">{heading}</h2>}
    {logos.length
      ? <ul className="jelly-logo-list-items">{logos.map(({ block, image, label, href }) => {
          // Merchant media URLs may be served by the local API and are not Next Image assets.
          // eslint-disable-next-line @next/next/no-img-element
          const content = image ? <img src={image.url} alt={label || image.alt || "Logo"} loading="lazy" /> : <span className="jelly-logo-list-name">{label}</span>;
          return <li key={block.id} {...blockEditorData(block, editor, "Logo", selectedBlockId)}>{href ? <a href={href}>{content}</a> : content}</li>;
        })}</ul>
      : <p className="jelly-editor-hint">Add a logo block and upload a logo. This section stays hidden on your live store until you do.</p>}
  </StorefrontContainer></section>;
}
