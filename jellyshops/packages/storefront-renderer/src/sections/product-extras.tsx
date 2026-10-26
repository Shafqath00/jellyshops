import { StorefrontContainer } from "@jelly/storefront-ui";
import type { SectionNode } from "@jelly/storefront-schema";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { numberValue, sectionData, stringValue, visibleBlocks } from "./shared";

type Availability = { state?: string; message?: string; maxQuantity?: number };

/** The availability the product page already computed for the chosen options, or undefined outside a product page. */
function productAvailability(context: StorefrontRuntimeContext): Availability | undefined {
  if (context.page?.pageType !== "product") return undefined;
  const presentation = context.page.resource.data.productPresentation as { availability?: Availability } | undefined;
  return presentation?.availability;
}

/**
 * Merchant-written information tabs (materials, shipping, returns), shown as
 * an accordion. Uses native <details> so it works without JavaScript and is
 * keyboard and screen-reader accessible by default.
 */
export function ProductTabsSection({ section }: { section: SectionNode }) {
  const tabs = visibleBlocks(section, "info-tab").flatMap((block) => {
    const title = stringValue(block.settings, "title");
    return title ? [{ id: block.id, title, paragraphs: stringValue(block.settings, "text").split(/\n{2,}/).map((part) => part.trim()).filter(Boolean) }] : [];
  });
  if (!tabs.length) return null;
  const firstOpen = section.settings.firstOpen === true;
  return <section className="jelly-section jelly-product-tabs-section" {...sectionData(section)}><StorefrontContainer>
    {tabs.map((tab, index) => <details key={tab.id} open={firstOpen && index === 0 ? true : undefined}>
      <summary>{tab.title}</summary>
      <div>{tab.paragraphs.map((paragraph, position) => <p key={position}>{paragraph}</p>)}</div>
    </details>)}
  </StorefrontContainer></section>;
}

/**
 * "72 items in stock" under the buy button, switching to "Only 3 left" at or
 * below a threshold. Shows nothing until a purchasable variant is chosen, or
 * when stock is not tracked.
 */
export function ProductStockCounterSection({ section, context }: { section: SectionNode; context: StorefrontRuntimeContext }) {
  const availability = productAvailability(context);
  if (!availability || availability.state !== "available" || typeof availability.maxQuantity !== "number" || availability.maxQuantity < 1) return null;
  const left = availability.maxQuantity;
  const threshold = numberValue(section.settings, "lowStockThreshold", 5, 1, 50);
  const low = left <= threshold;
  if (!low && section.settings.showWhenPlentiful === false) return null;
  return <section className="jelly-section jelly-stock-counter" {...sectionData(section, { "data-low": low ? "true" : undefined })}><StorefrontContainer>
    <p role="status">{low ? (left === 1 ? "Only 1 left" : `Only ${left} left`) : `${left} ${left === 1 ? "item" : "items"} in stock`}</p>
  </StorefrontContainer></section>;
}
