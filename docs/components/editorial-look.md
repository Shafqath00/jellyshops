# Editorial look (theme settings)

A group of theme settings that turns any platform theme into a magazine-style, premium look. Every choice starts at
"Theme default", so stores that never touch it look exactly as before. Built for Express Bed (2026-11-20 brief,
`docs/reports/2026-11-20-express-bed-showroom-design-brief.md`); Resthaven's **Express Sunrise** style switches all
four on.

| Setting (id) | Choices | What it does |
| --- | --- | --- |
| Headline size (`editorial.headlines`) | Theme default, Large (`editorial`) | Hero headings up to 116px, section headings up to 64px, page titles up to 80px on large screens; phones keep 34-48px. Headings inside the product page columns stay 24-36px. |
| Italic words in headings (`editorial.accentWords`) | Theme default, Italic in the button colour (`color`) | A word the merchant makes italic in a heading is drawn in the colour scheme's button colour, in the highlight font. Over a photo on phones it keeps the text colour. |
| Photo corners (`editorial.mediaCorners`) | Theme default, Rounded (24px), Very rounded (40px), Swept (`signature`: 40px with one large curved corner) | Hero (text over image is inset from the page edge), image with text, image banner, shop the look, featured product, store visit, offer panel, image cards, product gallery and the collection banner. |
| Cards and panels (`editorial.surfaces`) | Theme default, Raised (`raised`) | Product cards, review cards, question rows and the product buying panel sit on white panels with a soft shadow that lift when pointed at. |

## How it works

- Settings live in `packages/storefront-themes/src/theme-style-settings.ts` (`editorialSchema`) and are listed for every
  theme by `platform-settings.ts`.
- A changed choice adds a flag to `--jelly-theme-options` (`headlines-editorial`, `accent-words-color`, `media-radius`,
  `media-signature`, `surfaces-raised`) and, for corners, the token `--jelly-media-radius`. `themeRootAttributes()`
  turns the flags into `data-theme-options` on the theme root.
- The rules are in `src/app/themes/storefront-base.css` after the Prices rules ("Editorial look"), gated by the flag
  repeated three times so they outweigh theme rules.
- Section headings (`heading` on Collection list, Product grid, Featured collection, FAQ, Testimonials and the showroom
  sections) use the one-line formatted editor, so merchants can make a word italic. The formatted copy is stored as
  `headingDoc` beside the plain `heading`.

## Using it in a theme or store

- In the editor: Theme settings > Editorial look.
- In code or a starter: set `editorial: { headlines: "editorial", accentWords: "color", mediaCorners: "signature",
  surfaces: "raised" }` in the theme settings, and give headings an italic word:
  `{ heading: "Shop by type", headingDoc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Shop by " }, { type: "text", text: "type", marks: [{ type: "italic" }] }] }] } }`.
- Heading fonts with an italic: Fraunces and DM Serif Display load their italic styles (`src/app/fonts.ts`). Other
  fonts fall back to the browser's slanted version.
