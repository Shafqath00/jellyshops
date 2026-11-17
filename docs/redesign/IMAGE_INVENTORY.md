# Home page image inventory (2026-11-17)

**Status: done 2026-11-17.** Every picture below was replaced as planned; prompts, attempts and checks are in ASSETS.md. Open: the hero is 1.3× rather than 2× its drawn size.

Every image the Jellyshop home page loads, found by searching `src/app/_home/`, `src/app/page.tsx`, `src/app/home-content.ts`, `src/app/home.module.css` (no CSS `background-image` pictures remain; the only `background-image` rules are gradient text, removed in the gradient pass) and by loading the page at 1440, 768 and 390px and listing every `<img>` it draws. No `<picture>` elements; `next/image` writes the `srcset` for every picture below.

Rule from the brief: **nothing is kept.** Every current file is replaced or deleted, apart from the official brand logos (they are not ours to redraw; see the last table).

## Pictures on the page

Sizes are what the browser draws (CSS pixels). "Cover" means the picture is cropped to fill its box.

| File now | Where | Desktop 1440 | Tablet 768 | Phone 390 | Fit | Plan |
| --- | --- | --- | --- | --- | --- | --- |
| `hero-dashboard-flat.webp` | Hero | 1200×800 | 707×471 | 350×233 | contain | **Regenerate** from the style guide (store name and data made consistent) as `hero-dashboard.webp`, 1536×1024 transparent |
| `feature-storefront.webp` | How it works step 1; bento "Storefront builder" (wide); tour slide 1 | 620×414 / 793×233 / 860×573 | 678×452 / 705×220 | 321×214 / 348×220 | cover | Split: `how-create-store.webp` (step) + `feature-storefront.webp` (bento + tour) |
| `feature-products.webp` | How it works step 2; bento "Products and inventory" (tall); tour | 620×414 / 387×633 | 678×452 / 705×237 | 321×214 / 348×220 | cover | Split: `how-add-products.webp` + `feature-products.webp` |
| `feature-checkout.webp` | How it works step 3; bento "Checkout and payments"; tour | 620×414 / 387×233 | 678×452 / 705×237 | 321×214 / 348×220 | cover | Split: `how-get-paid.webp` + `feature-checkout.webp` |
| `feature-analytics.webp` | How it works step 4; tour (the bento tile draws its chart in HTML) | 620×414 | 678×452 | 321×214 | cover | Split: `how-publish-grow.webp` + `feature-analytics.webp` (tour only) |
| `feature-orders.webp` | Bento "Orders and delivery"; tour | 387×233 | 705×237 | 348×220 | cover | Replace: `feature-orders.webp` |
| `feature-marketing.webp` | Bento "Marketing" (wide); tour | 793×257 | 705×237 | 348×220 | cover | Replace: `feature-marketing.webp` |
| `template-forma.webp` … `template-harbour.webp` (6) | Store designs cards | 385×256 | 341×228 | 348×232 | cover | Replace (see templates note) |
| `avatar-1.webp` … `avatar-3.webp` | Stories | 40×40 | 40×40 | 40×40 | – | Replace: flat illustrated circles, solid palette background |
| `og-image.jpg` | Open Graph / Twitter card (not drawn on the page) | 1200×630 | – | – | – | Replace: solid background, logo, headline |

### Removed, not replaced (their only job was a glow or gradient backdrop)

| File | Was | Status |
| --- | --- | --- |
| `hero-bg.webp` | Aurora light streaks behind the hero | No longer referenced (gradient pass); delete |
| `hero-mockup.webp` | Old neon hero mockup | No longer referenced; delete |
| `brand/jelly-mascot.webp` | Glossy gradient sphere | Not used anywhere; delete |

`bg-hero-grid.webp`, `auth-visual.webp` and `onboarding-*.webp` are sign-in and onboarding pictures, not on the home page: out of scope for this brief and left alone.

### Kept

| File | Why |
| --- | --- |
| `public/logos/{stripe,youtube,vimeo,spotify,soundcloud}-color.svg` (28×28) | Official marks of real integrations, in their own colours, from the brands' kits (LOGOS.md). Redrawing them would break the brands' rules. |
| `public/brand/jellyshop*.svg` | Our own logo, monochrome vector. |

## Why the feature pictures are split

Today one picture serves three boxes of very different shapes: a 3:2 step picture, a bento tile that is 3.4:1 wide or 0.6:1 tall, and a 3:2 tour slide. With "cover" the bento tiles cut away up to 60% of the picture, which is why text in them is often cropped.

New plan:
- **How it works** gets its own four 3:2 pictures (`how-*.webp`), drawn for one step each.
- **Bento + tour** share `feature-*.webp`, each made for its tile shape on a transparent background: wide (about 3:1) for Storefront builder and Marketing, tall (about 3:5) for Products, 3:2 for Checkout and Orders. Analytics stays 3:2 (tour only).
- Bento and tour boxes switch from `cover` to `contain` (one CSS line each, no layout change: the box sizes stay the same), so a transparent picture is never cropped and simply sits on the section colour on narrower screens.

ChatGPT only makes 1536×1024, 1024×1536 and 1024×1024. Wide and tall pictures are made on the nearest canvas with a transparent margin, then trimmed to the subject with a small even margin.

## Templates note (recommendation)

The six Store designs cards show real themes that exist in the product. Generated pictures of them would be invented versions that could disagree with what a merchant gets. **Recommended:** capture each theme's own preview page (`/theme-preview/<id>`) at 1280×853 with Playwright and export 770×513 WebP (2× the 385px card). Crisp, true to the product, no AI artefacts. Each theme keeps its own palette. If you would rather have ChatGPT versions, they are made with the same style guide.

## Open Graph note (recommendation)

ChatGPT cannot make exactly 1200×630 and its text can garble. **Recommended:** build the card as a small HTML page (solid `#0a0a0a`, the real Jellyshop logo SVG, the headline in Geist) and capture it at 1200×630 with Playwright. Every letter is the real font.

## Size targets

2× the largest drawn size where ChatGPT allows it:

| Picture | Largest drawn | 2× | Made at |
| --- | --- | --- | --- |
| Hero | 1200×800 | 2400×1600 | 1536×1024 (ChatGPT limit; noted as open) |
| How it works | 678×452 | 1356×904 | 1536×1024 |
| Feature (wide) | 793×257 | 1586×514 | 1536 wide after trim |
| Feature (tall) | 387×633 | 774×1266 | 1024×1536 canvas, trimmed |
| Feature (3:2) / tour | 860×573 | 1720×1146 | 1536×1024 |
| Templates | 385×256 | 770×513 | 770×513 |
| Avatars | 40×40 | 80×80 | 192×192 from 1024 |
| Open Graph | 1200×630 | – | 1200×630 |

All pictures below the first screen keep `loading="lazy"`; every `<Image>` already has width and height, so nothing shifts while loading.
