# Jelly Diode — design brief

Template 2 of the 20-template programme (`docs/reports/2026-11-08-twenty-template-categories-research.md`, section 4.8; working name "Circuit", renamed Diode after the Shopify Theme Store name check).

## Concept

Precise, technical, confident: a store for products people compare before they buy. Each product sits on a seamless grey background like a launch render; numbers (battery hours, watts, weight) are set in a monospace face so specifications read like data, not marketing. The store should feel like a well-made product launch page, not a discount warehouse.

Audience: consumer electronics brands, audio, keyboards and peripherals, chargers and power, gadget shops. UK/global first.

## Identity (what makes Diode unlike the other 19)

| Part | Choice | Programme code |
| --- | --- | --- |
| Header | Logo left, menu beside it with dropdowns, search; graphite announcement strip | H2 (`header.layout` classic) |
| Hero | Product render on a graphite field with specification callouts | R4 (`hero.layout` spotlight) |
| Product card | Outlined technical card, product on grey, a key-spec chip, brand line | C5 (`productCard.layout` technical) |
| Collection | Dense grid with a filter sidebar | L2 (`listLayout` sidebar) |
| Product page | Gallery and buying area, then a full specification table, then fold-out "In the box / Compatibility / Support", reviews, "Works with" | P4 (`pageLayout` details-below + specifications table) |
| Bag | Slide-out drawer with a free-delivery bar | K1 (`cart.type` drawer, `freeDeliveryFrom`) |
| Display face | Space Grotesk headings, Inter body, IBM Plex Mono for numbers, chips and labels | unique in the programme |
| Motion | Technical: quick 150-200 ms, outlines darken, no zoom | M4 (lite) |

Signature (not in this phase): **compare tray**, tick up to four products, a tray docks at the bottom, a compare page shows specifications side by side.

## Tokens

- Colours: page `#F5F6F7` (cool white), surface `#E9ECEF`, text `#0C0E11`, secondary text `#525962` (AA on page), primary (buttons) `#2D46F5` electric blue with white text, accent `#C8F03C` (signal lime, only on graphite, never as text on light).
- Colour schemes: 1 Light; 2 Grey `#E6E9EC`; 3 Graphite `#111317` with light text and lime buttons; 4 Electric `#2D46F5` with white text.
- Type: Space Grotesk headings (600, tight, sentence case), Inter body (400, 16px). Heading 1 64px desktop / 40px phone. IBM Plex Mono 500 for eyebrows, chips, spec labels, prices in cards, SKUs.
- Corners: small and exact: cards 6px, option tiles and tags 4px, buttons and fields the "soft" setting (8px).
- Lines: 1px hairlines everywhere (cards, spec rows, header); a faint 8px grid on the hero field as the motif.
- Imagery: products on seamless light grey or graphite, studio lighting, 1:1 for products; desk-setup lifestyle shots; macro details.

## Pages (starter)

- Home: announcement, header, spotlight hero (headphones + spec callouts, graphite), category tags, bestsellers (technical cards), desk setup (image with text, grey), the numbers (feature columns: 2-year warranty, 30-day returns, free delivery, firmware updates), macro detail (image with text, graphite), reviews, newsletter (electric), footer.
- Collection: header with breadcrumb, dense grid with sidebar filters and sort.
- Product: gallery, buying area (brand, SKU, price, colour options, add to basket, sticky bar, trust strip), technical specifications table, fold-out In the box / Compatibility / Support and downloads, reviews, "Works with" related products.
- Cart, search, page, 404: plain, hairline-ruled pages.

## Images (generated, illustrative)

Generated with ChatGPT image generation for this theme; recorded in the theme's `SOURCES.md`. No brand names, logos or real products.

1. Hero: matte graphite over-ear wireless headphones, three-quarter view, on a seamless graphite background, room on the left for text (landscape).
2-7. Six product renders on seamless light grey, square: over-ear headphones, wireless earbuds in an open case, compact mechanical keyboard, small portable speaker, USB-C wall charger, slim power bank.
8. Desk setup: keyboard, headphones and a speaker on a tidy wooden desk, daylight (landscape).
9. Macro: close-up of mechanical keyboard switches and keycaps (landscape).
10. In the box: headphones, case, cable and adapter laid out flat on light grey (landscape).
