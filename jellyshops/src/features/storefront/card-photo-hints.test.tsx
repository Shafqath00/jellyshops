import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StorefrontProductCard, cardPhotoSrcSet } from "@jelly/storefront-ui";
import type { Product } from "@/lib/domain";
import { productCardData } from "./product-card-data";

const url = "https://api.test/api/public/media/store-1/photo-1";
const blur = "data:image/webp;base64,UklGRg==";

describe("card photos use what the media API recorded", () => {
  it("lists exactly the copies that exist, and only the three old sizes when nothing is recorded", () => {
    expect(cardPhotoSrcSet(url, [320, 640, 960])).toBe(`${url}?w=320 320w, ${url}?w=640 640w, ${url}?w=960 960w`);
    expect(cardPhotoSrcSet(url)).toBe(`${url}?w=320 320w, ${url}?w=640 640w, ${url}?w=1280 1280w`);
    expect(cardPhotoSrcSet(url, [500])).toBe(`${url}?w=320 320w, ${url}?w=640 640w, ${url}?w=1280 1280w`);
  });

  it("carries the photo's widths and blur from the product to the card", () => {
    const product = { id: "p1", name: "Bed", slug: "bed", imageUrl: url, tags: [], media: [{ id: "photo-1", url, variantWidths: [320, 640], placeholder: blur }], variants: [{ id: "v1", name: "One", sku: "", priceMinor: 100, stock: 1 }] } as unknown as Product;
    expect(productCardData(product, "/s/products/bed", "GBP")).toMatchObject({ imageWidths: [320, 640], imagePlaceholder: blur });
  });

  it("paints the blur behind the photo and refuses anything that is not a WebP data URL", () => {
    const card = (imagePlaceholder: string) => renderToStaticMarkup(<StorefrontProductCard product={{ name: "Bed", href: "/b", imageUrl: url, price: "£1", imageWidths: [320], imagePlaceholder }} />);
    expect(card(blur)).toContain("background-image:url(&quot;data:image/webp;base64,UklGRg==&quot;)");
    expect(card(blur)).toContain(`${url}?w=320 320w`);
    expect(card("javascript:alert(1)")).not.toContain("background-image");
  });
});
