import type { PageType } from "@jelly/storefront-schema";

/** Merchant-facing names. One list for the editor's page structure, section library, inspector and page picker. */
const sectionLabels: Record<string, string> = {
  "announcement-bar": "Announcement bar",
  header: "Header",
  footer: "Footer",
  hero: "Hero banner",
  slideshow: "Slideshow",
  "image-banner": "Image banner",
  "image-with-text": "Image with text",
  "image-text": "Image with text",
  "category-grid": "Collection list",
  "product-grid": "Product grid",
  "featured-collection": "Featured collection",
  multicolumn: "Feature columns",
  testimonials: "Testimonials",
  faq: "FAQ",
  newsletter: "Newsletter sign-up",
  "trust-strip": "Trust badges",
  "rich-text": "Text",
  "contact-store-info": "Contact details",
  "logo-list": "Logo list",
  "journal-teaser": "Blog posts",
  "image-mosaic": "Image mosaic",
  "spacer-divider": "Spacer",
  spacer: "Spacer",
  divider: "Divider",
  "product-gallery": "Product images",
  "product-information": "Product title and price",
  "product-options": "Product options",
  "product-purchase": "Add to cart buttons",
  "product-description": "Product description",
  "product-tabs": "Product information tabs",
  "product-stock-counter": "Stock counter",
  "related-products": "Related products",
  "collection-header": "Collection banner",
  "collection-product-grid": "Collection products",
  "collection-description": "Collection description",
  "cart-summary": "Cart",
  "search-results": "Search results",
  "page-content": "Page content",
  "blog-header": "Blog title",
  "article-list": "Blog post list",
  "article-header": "Blog post title",
  "article-content": "Blog post content",
  "not-found-message": "Page not found message",
};

const blockLabels: Record<string, string> = {
  heading: "Heading",
  text: "Text",
  button: "Button",
  testimonial: "Testimonial",
  "faq-item": "Question",
  logo: "Logo",
  menu: "Menu",
  "contact-item": "Contact detail",
  "social-link": "Social link",
  "collection-card": "Collection",
  column: "Column",
  slide: "Slide",
  "product-tab": "Product tab",
  "info-tab": "Information tab",
  "link-heading": "Link column heading",
  link: "Link",
};

const pageTypeLabels: Record<PageType, string> = {
  home: "Home page",
  product: "Product pages",
  collection: "Collection pages",
  cart: "Cart",
  search: "Search results",
  page: "Information pages",
  blog: "Blog",
  article: "Blog posts",
  "not-found": "Page not found (404)",
  checkout: "Checkout",
  wishlist: "Wishlist",
  "customer-login": "Sign in",
  "customer-register": "Create account",
  "customer-recovery": "Reset password",
  "customer-account": "Account overview",
  "customer-orders": "Order history",
  "customer-order": "Order details",
  "customer-addresses": "Saved addresses",
  "order-success": "Order confirmation",
};

function fallback(value: string): string {
  const words = value.split(/[-_]/).filter(Boolean).join(" ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : value;
}

export function sectionLabel(type: string): string { return sectionLabels[type] ?? fallback(type); }
export function blockLabel(type: string): string { return blockLabels[type] ?? fallback(type); }
export function pageTypeLabel(type: PageType | string): string { return pageTypeLabels[type as PageType] ?? fallback(type); }
