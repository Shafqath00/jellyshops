# Lighthouse on Resthaven (2026-11-13)

First speed and accessibility measurement of a real store (staging store `resthaven-redesign-check`, Jelly Resthaven, 7 products) on a local production build (`next build && next start`) talking to a local backend and the staging database. Script: `jellyshops/scripts/lighthouse-budget.mjs` (`npm run lighthouse -- --store <slug> --collection <slug> --product <slug> --base <url>`). Budgets from the roadmap: performance 80, accessibility 95 (Shopify's Theme Store: 60 and 90).

## Result

Accessibility, best practices and SEO: 100 / 96 / 100 on every page and device (after two fixes below). **Performance averages 49, under budget.**

| Page | Device | Performance | Accessibility | Best practices | SEO | LCP | CLS | Accessibility issues |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | mobile | 68 | 100 | 96 | 100 | 7.4 s | 0 | none |
| Collection | mobile | 58 | 100 | 96 | 100 | 8.9 s | 0 | none |
| Product | mobile | 60 | 100 | 96 | 100 | 8.8 s | 0 | none |
| Home | desktop | 44 | 100 | 96 | 100 | 7.4 s | 0.049 | none |
| Collection | desktop | 31 | 100 | 96 | 100 | 10.7 s | 0.049 | none |
| Product | desktop | 33 | 100 | 96 | 100 | 8.2 s | 0.049 | none |

## Fixed while measuring

- Header menu arrows overlapped their link by 8px, so the two tap targets collided (WCAG target size). `platform-base.css`: no negative margin.
- Canonical links were relative (`/store/products/x`); search engines and Lighthouse need full addresses. The store layout now sets `metadataBase` from the request's host, so every page's canonical and share images are absolute.

## Why performance is low (not fixed yet)

1. **The largest paint is a product photo marked `loading="lazy"`** (first row of cards). Above-the-fold photos should load eagerly with high priority. LCP 4.8 s desktop, 9.1 s phone.
2. **Photos are sent at full size** (1536 px) into small cards; Lighthouse estimates about 1.1 MB could be saved. The media API has no resized versions and the storefront writes no `srcset`.
3. **Slow first response (1.6–2.2 s).** Partly this measurement setup (local frontend and backend, remote staging database); a deployed store needs its own measurement, and the storefront data request could be cached.
4. **Phone main thread: 3 s of work, 680 ms blocking**, mostly hydration and about 190 KB of JavaScript the page does not use.
5. Small layout shift on desktop (0.05) when the theme's fonts arrive.

Measure again on a deployed store before and after each fix; `next dev` scores mean nothing for speed.

## Speed fixes, round 1 (same day)

- **Measurement fixed.** The script's desktop runs used a desktop screen with the phone network and processor slow-down, which is not Lighthouse's desktop test; it now uses Lighthouse's desktop settings (fast network, no slow-down). The first table's desktop numbers were too low for that reason.
- **Photos sized to their frame.** Product cards, hover photos, heroes, banners, the collection banner, slideshow slides, image-with-text and category tiles now send `srcset` with the media API's 320/640/1280px copies (a 186 KB original is 32 KB at 640px). Sample and outside photos are unchanged.
- **First photos load first.** The first row of a product list loads at once with high priority (it was lazy); the collection banner asks for high priority.
- **Fewer waits on the server.** The store's design, products and collections are fetched side by side (they were fetched one after another); the password check and an uploaded theme's files too. First response 1.6 s to about 1.3 s in this setup.

Result (two runs, local production build, same store): **performance average 73** (budget 80). Desktop 83–95 on every page; phone 52–68. Accessibility 100, best practices 96, SEO 100.

### What still holds phones back

The page sends **547 KB of JavaScript (compressed, 19 files)** before the photo's turn on a slow phone connection, and the phone spends 1.1–1.3 s running it. The largest parts: Zod validation schemas checked in the browser (91 KB), React itself (72 KB), the themes package with every theme's settings, starter pages and Resthaven's layout history (65 KB), the Supabase sign-in library (56 KB, loaded on public store pages by the merchant and customer sign-in providers in the root layout), the renderer (53 KB). Cutting these is the next step: load Supabase only on sign-in and account pages, keep starter pages and layout history out of the shopper's bundle, and validate published snapshots on the server only.
