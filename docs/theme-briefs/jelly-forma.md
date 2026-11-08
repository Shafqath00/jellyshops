# Jelly Forma

## Intent and reference
Build a new, standalone CLI-scaffolded Jelly theme inspired by the shopping experience of https://hyper-theme-demo.myshopify.com/ (reviewed 7 November 2026). The user selected Hyper and authorised starting without supplying a separate brand. Furniture and homewares are the working audience: people browsing chairs, sofas, lighting and storage, at a considered mid-market price point. The merchant's own name, products and collections remain authoritative.

The observed reference has a blue announcement, a prominent search field, a separate category-navigation row, circular category imagery, a rounded image-led hero, compact square product photography, pill buttons and a multi-column footer. Collection pages offer filtering and sorting; product pages put the gallery beside purchase details and stack them on phones. Recreate these principles with original copy and independently sourced imagery.

## Design system
- Identity: `jelly-forma`, display name Jelly Forma, version `1.0.0`, Jelly engine `>=1 <2`.
- Shared frame: normal content width 80rem; desktop margins 2.5rem, tablet 1.5rem, phone 1rem. Never override shared container widths. Fixed platform breakpoints 767/1023px.
- Rhythm: medium sections, 4rem desktop, scaled by the contract on smaller screens. Use the platform spacing scale; adjacent matching schemes reduce top spacing.
- Typography: Manrope for headings and body; heading weight 700, body 400. Fluid H1 2.25–4rem, H2 1.75–2.75rem, H3 1.375–1.75rem, H4 1.25rem; body 1rem, small .875rem. No more than four heading sizes on a page; paragraphs bounded to 65ch.
- Palette: white #ffffff, soft grey #f3f4f6, ink #171717, muted #525252, blue #233b98, red #b42d1b. Four schemes: white, grey, blue, ink. White on blue/red and ink on light surfaces must meet 4.5:1; verify text and button pairs numerically and in rendered pages.
- Components: pill primary/secondary buttons, 44px minimum controls, softly rounded square product media, no default card shadow, left-aligned titles/prices and optional swatches. Visible focus, reduced-motion support, gentle image hover only.

## Pages and content
Home: category carousel, hero, newest products, room/story image with text, feature columns, FAQ, newsletter; announcement/header/footer are shared. Product: gallery, title/price, options, quantity/purchase, description/specifications, related products. Collection: heading and product grid, platform filtering/sorting. Cart, search, information and 404 use built-ins. Checkout/account use the platform's existing routes and shell; do not invent nonfunctional replacements. Main and footer menus use internal links. Products bind to live store data and hide empty grids. Copy is short and furniture-specific; no fabricated reviews or delivery promises.

## Approach
An inherited theme would be quicker but retain an existing theme's visual structure. The user chose starting from the CLI shell; implement a standalone manifest, starter and token-based stylesheet. Reuse built-in sections and shared interaction components; add no new renderer or backend functionality for this theme. The CSS target is at most 150 lines, without hex literals or pixel lengths except 1px borders.

## Verification and boundaries
Validate the theme folder; run CLI conformance and package build, unit tests, typecheck and lint. Add a preview config and Playwright coverage of seven pages, overflow, navigation and cart behaviour at 1280/820/390px; run contrast and design lint without increasing the baseline. Report unsupported Hyper features honestly (particularly comparison, wholesale pricing and app-only promotions). No staging writes or publishing without the user's explicit approval at that stage. Preserve existing uncommitted changes and published theme identities.
