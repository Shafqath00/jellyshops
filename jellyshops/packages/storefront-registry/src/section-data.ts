import { sectionLabel } from "./labels.js";

/**
 * Data contracts: what each section needs before it shows anything. A section whose data is missing draws nothing on
 * the live store (shoppers see no empty box); in the editor the platform shows this sentence in its place, so a
 * merchant never wonders why a section they added is invisible. Plain language, written for the merchant.
 */
export const SECTION_DATA_NEEDS: Readonly<Record<string, string>> = {
  "related-products": "Shows other products from your store, best matches first. It appears once your store has at least two products.",
  "recently-viewed": "Shows the products a shopper opened most recently. It stays hidden until they have opened one.",
  "product-description": "Shows the product's description. This product has none yet: add one to the product.",
  "product-options": "Shows the product's choices, such as size or colour. This product has no options.",
  "product-specifications": "Shows the product's specifications. Add them to the product, or add rows to this section.",
  "product-dimensions": "Shows measurements from the product's specifications (for example Width: 150 cm). Add them to the product to show this section.",
  "product-stock-counter": "Shows a line such as \"Only 3 left\" when stock runs low. Nothing to show for this product right now.",
  "product-reviews": "Shows this product's published reviews.",
  "product-gallery": "Shows the product's photos. This product has none yet.",
  "collection-header": "Shows the collection's title, description and photo.",
  "collection-description": "Shows the collection's description. This collection has none yet.",
  "collection-product-grid": "Shows the collection's products. This collection has no products yet.",
  "product-grid": "Shows products from your store. Add products, or choose a collection that has some.",
  "featured-collection": "Shows the products of a collection. Choose a collection that has products.",
  "category-grid": "Shows your collections. Add a collection, or add collection cards to this section.",
  "logo-list": "Shows your logos. Add a logo block with an image.",
  "image-gallery": "Shows a set of photos. Add photo blocks with images.",
  "metaobject-list": "Shows the entries of one kind of custom data. Choose the kind in the settings and add entries in Content.",
  "contact-store-info": "Shows your address, opening hours and ways to reach you. Fill them in in the settings.",
  "rating-summary": "Shows your star rating. Enter the numbers, or choose reviews as the source once products have reviews.",
  "blog-header": "Shows the blog's title and introduction.",
  "article-list": "Shows the blog's posts. This blog has no published posts yet.",
  "article-header": "Shows the post's title, date and summary.",
  "article-content": "Shows the post itself. This post has no text yet.",
  "page-content": "Shows the page's text. This page has no text yet.",
  "apps": "Shows a booking, form, map or music player. Add an app block and paste its link.",
  "custom-content": "Add headings, text, buttons, photos or videos to this section.",
};

/** The sentence the editor shows where a section draws nothing: its data contract, or a general hint. */
export function sectionEmptyMessage(type: string): string {
  return SECTION_DATA_NEEDS[type] ?? `${sectionLabel(type)} has nothing to show yet. Check its settings or add content.`;
}
