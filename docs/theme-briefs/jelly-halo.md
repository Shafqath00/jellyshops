# Jelly Halo — design brief

Template 1 of the 20-template programme (`docs/reports/2026-11-08-twenty-template-categories-research.md`, section 4.4; working name "Dew", renamed Halo after the Shopify Theme Store name check).

## Concept

Clinical-soft skincare and beauty: calm, bright, ingredient-led. Each product sits whole on a soft colour field; shoppers browse by skin concern before they browse by product type. The store should feel like a well-lit bathroom shelf, not a pharmacy and not a fashion magazine.

Audience: skincare and cosmetics brands, clean-beauty labels, salons selling retail, indie makeup and body care. UK/global first.

## Identity (what makes Halo unlike the other 19)

| Part | Choice | Programme code |
| --- | --- | --- |
| Header | Logo left, menu beside it, search icon; announcement strip with a sample offer | H2 (`header.layout` classic) |
| Hero | Product on a soft colour field with ingredient callouts | R4 (`hero.layout` spotlight) |
| Product card | Product whole on a tinted panel, rounded corners, concern chip, star rating | C4 (`productCard.layout` tinted, `showRating`) |
| Collection | Concern chips first, then the grid (shop by need) | L4, built from the category list as pills + chip filters (L3 behaviour on the grid) |
| Product page | Story chapters: photos and buying area, then "What it does / Key ingredients / How to use" as full-width bands, then reviews | P6 (P4 base + story sections) |
| Bag | Slide-out drawer with a free-delivery bar | K1 (`cart.type` drawer, `freeDeliveryFrom`) |
| Display face | Plus Jakarta Sans, large and tight, lowercase headlines | unique in the programme |
| Motion | Still and slow: 300-450 ms fades, no parallax | M1 |

## Tokens

- Colours: page `#FBFAF7` (milk), surface `#F2EEE8`, text `#1F1D1B`, secondary text `#5E5852` (AA on page), primary (buttons) `#1F1D1B`, accent `#D9C8BC` (blush clay, for fields and chips only, never for text).
- Colour schemes: 1 milk page; 2 blush field `#F3E7E0`; 3 sage field `#E3EBE2`; 4 ink `#1F1D1B` with milk text.
- Type: Plus Jakarta Sans for headings (600, tight letter-spacing, sentence case or lowercase) and body (400, 16px, 1.6 line height). Heading 1 64px desktop / 40px phone.
- Corners: cards 20px, buttons pill, fields 12px.
- Spacing: 8px scale, generous: section padding large.
- Imagery: soft daylight, cream and pastel backdrops, product shots on plain colour, skin and texture close-ups; never clinical white, never heavy retouching.

## Pages (starter)

- Home: announcement, header, spotlight hero (serum + callouts), shop by concern pills, bestsellers (tinted cards with ratings), texture story (image with text, blush scheme), routine steps (feature columns: cleanse / treat / moisturise / protect), ingredient spotlight (sage scheme), reviews testimonials, newsletter (ink scheme), footer.
- Collection: header with description, concern pills, product grid with chip filters and sort.
- Product: gallery left, buying area (rating summary, price, size options, personalisation off, add to bag, free delivery note), then story chapters (What it does, Key ingredients, How to use), specifications (full ingredient list), reviews, related products.
- Cart, search, page, 404: calm single-column layouts on the milk page.

## Images (generated, illustrative)

Generated with ChatGPT image generation for this theme; recorded in the theme's `SOURCES.md`. No brand names, logos or real packaging.

1. Hero: amber-glass serum bottle with dropper, standing on a pale blush field, soft daylight, room for callouts (landscape).
2. Texture: close-up of a cream swirl and a drop of serum on a pale surface (landscape).
3. Routine/lifestyle: hands holding a jar near a bathroom shelf with plants, soft light (portrait).
4-9. Six product cutouts on plain off-white for cards: serum bottle, cream jar, cleanser tube, facial oil, SPF tube, lip balm (square).
10. Ingredient: sliced citrus and green leaves on a pale sage field (landscape).
