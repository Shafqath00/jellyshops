import { safeRichTextHref } from "@jelly/storefront-schema";
import type { ProductPresentationContext } from "../types";

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Other products of the same family (products tagged `family:<name>`, usually one per colour), drawn as swatch links
 * above the options: "Colour: Natural" with a dot or photo for each. The current product is marked, not linked.
 */
export function ProductFamilyLinks({ product }: { product: ProductPresentationContext }) {
  const family = product.family;
  if (!family || family.members.length < 2) return null;
  const current = family.members.find((member) => member.current);
  return <nav className="jelly-product-family" aria-label={`Other ${family.label.toLowerCase()} choices`}>
    <p className="jelly-product-family-label">{family.label}{current && <span>: {current.label}</span>}</p>
    <ul>{family.members.map((member) => {
      const image = member.image ? safeRichTextHref(member.image) : null;
      const swatch = member.color && HEX.test(member.color)
        ? <span className="jelly-product-family-swatch" style={{ background: member.color }} aria-hidden="true" />
        // eslint-disable-next-line @next/next/no-img-element
        : image && !image.startsWith("#") ? <img className="jelly-product-family-swatch" src={image} alt="" aria-hidden="true" loading="lazy" decoding="async" />
        : <span className="jelly-product-family-swatch" data-empty="true" aria-hidden="true">{member.label.slice(0, 1)}</span>;
      const href = member.current ? null : safeRichTextHref(member.href);
      return <li key={member.id}>
        {href && !href.startsWith("#")
          ? <a href={href} title={member.label}>{swatch}<span className="jelly-visually-hidden">{member.label}</span></a>
          : <span aria-current="true" title={member.label} data-current="true">{swatch}<span className="jelly-visually-hidden">{member.label} (shown)</span></span>}
      </li>;
    })}</ul>
  </nav>;
}
