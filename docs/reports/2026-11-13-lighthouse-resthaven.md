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

## Speed fixes, round 2: less JavaScript (same day)

- **Sign-in library on demand.** The merchant and customer sign-in clients are created on first use (`src/features/auth/lib/supabase-clients.ts`, dynamic `import()`), so the Supabase library is no longer part of every store page's start-up JavaScript.
- **Starter pages and layout history out of store pages.** The theme index script now writes two files: `index.generated.ts` (manifests, plus whether a theme's starter brings its own header and footer) and `starters.generated.ts` (starters and layout histories, used only by installing, upgrading and previewing). Uploaded themes are registered for pages with `registerThemeForPages` (manifest and header/footer flag only), and the themes package marks `theme-registry.js` as its only module with load-time work (`sideEffects`), so the bundler drops the rest when a page does not use it.

Start-up JavaScript on the store home page: **547 KB to 457 KB** (compressed). Phone main-thread work: about 3 s to 2.2–2.6 s.

Lighthouse (two runs): performance 70 and 75 (desktop 82–96, phone 49–65). The phone score is now dominated by the server's first response in this setup: **2.2–5.2 s**, because a local frontend and backend talk to the remote staging database for every page. A store deployed next to its database needs its own measurement. Caching each store's data for a short time on the server (for example 30 seconds) would remove most of that wait for repeat visitors; it means a newly published design or product change can take up to that long to appear, so it needs a decision.

Still in the start-up JavaScript: Zod validation schemas (shared schemas and section definitions used by the renderer in the browser), React, the renderer and the built-in starter packs in the registry package.

## Speed fixes, round 3: 30-second store data cache (same day, user's choice)

The store's details, published design, products and collections are now reused for 30 seconds between page views (`STOREFRONT_CACHE_SECONDS` in `src/features/storefront/server-storefront.ts`, Next's `fetch` cache with the tag `storefront:<slug>`). A newly published design or product change can take up to 30 seconds to reach shoppers; prices and stock are checked again at checkout. The password check, search results and custom-field values are still fetched every time.

First byte on a repeat visit: about 3 s to **0.57 s** in this setup. Lighthouse (two runs): **75 and 77** (desktop 82–97, phone 57–71). Still under the 80 budget on phones; what is left is mostly start-up JavaScript (Zod schemas, React, the renderer, built-in starter packs in the registry package) and the remaining uncached calls.

## Speed fixes, round 4: phone speed on the demo store (same day)

Measured on the 24-product demo store (`resthaven-demo`), local production build.

**What the score is made of.** Lighthouse scores a phone by simulating a slow 4G connection (about 200 KB per second) and a processor four times slower. Everything the page asks for before its largest picture shares that connection, so the score follows the *bytes* the page requests (HTML, CSS, fonts, JavaScript and the picture itself) and the main-thread work. An HTTP/2 front (what a CDN gives real visitors) changed phone scores by only a few points (home 56 to 65, first paint 2.3 s to 1.9 s), so queueing on this machine's HTTP/1.1 server was not the main problem.

**Fixes**
- **No font is preloaded.** Fraunces and Inter were preloaded on every store page (83 KB), including stores on other fonts (Resthaven uses Cormorant Garamond and Figtree). A page now downloads only the fonts its CSS uses. Best practices 96 to 100.
- **Smaller copies of Resthaven's photos.** `scripts/generate-theme-assets.mjs` writes `name-640.webp` and `name-1024.webp` next to every 1536 px photo in `public/themes/jelly-resthaven/`; `cardPhotoSrcSet` sends them as `srcset`. The home hero goes from 171 KB to 30 KB on a phone. A test keeps the list of themes with copies, the copies and the assumed width in step.
- **Merchant sign-in only where it is used.** `AuthProvider` moved from the root layout to the admin, login, signup and onboarding layouts. Every store page used to start it (it loaded the sign-in library and asked for a session).
- **Customer sign-in loads on demand.** The customer provider only loads the sign-in library when a customer session is saved in the browser or a sign-in link (`?code=`) is being finished.

**Result** (3 runs, standard setup): performance average **76-77** (before 73); phone home 57 to 66-67, collection 56-64, product 55-66; desktop 80-98. Accessibility 100, best practices 100, SEO 100. With the HTTP/2 front: phone home 65-81, average 69 (before 62).

**What still holds phones under 80** (not fixed, each is its own piece of work)
1. **JavaScript, 456 KB compressed:** Zod validation (89 KB, the section and theme definitions are built from Zod schemas that run in the browser), React (72 KB), the renderer (52 KB) and the themes package, which still carries every theme's settings (about 60 KB). Fixing the first and last needs the section and theme definitions split from their validation.
2. **CSS, 120 KB compressed, render-blocking:** a Resthaven store also downloads the CSS of the other five themes (about 50 KB). Loading only the active theme's CSS means moving theme styles out of the root layout into per-theme files for the store layout, the editor and every preview.
3. **Store photos come from the API origin**, a second connection, with 1 s or more of server time per photo in this setup (local backend, remote database). A deployed store needs its own measurement; serving photos from a CDN would remove most of it.

## Speed fixes, round 5: store pages no longer download zod or the section definitions (same day)

**Cause.** Store pages loaded the main entries of `@jelly/storefront-themes` and `@jelly/storefront-registry`. Those build every section definition from zod schemas, check every theme manifest with zod when they load, and register theme recipes in the section registry, so a store page carried zod (about 90 KB compressed), the section definitions and the built-in starter packs although it only draws sections.

**Fix.**
- New entries `@jelly/storefront-themes/runtime` and `@jelly/storefront-registry/runtime`, without zod and without the section definitions. Store pages (renderer, storefront feature, store routes) import only these; a test (`src/lib/store-bundle.test.ts`) fails if one imports a main entry again, and another (`runtime-entry.test.ts`) follows the runtime entries' imports and fails if zod or a main entry appears.
- Themes are built without checking their manifest (`buildThemeDefinition`); the main entry checks every manifest and registers recipe sections when it loads (`theme-registry-checks.ts`), as before, for the editor, backend, tests and CLI. Built-in themes are checked by the main entry and tests, uploaded themes when they are uploaded.
- `resolveTheme` reads the few manifest fields it needs with the schema's defaults (a test checks it matches the checked manifest for every theme); recipes are read without checking on store pages (a test checks the result equals the checked list for every theme).
- The renderer asks the registry runtime for section parts, editor labels and the control types used to show custom-field values; with the full registry loaded the answers come from the definitions, otherwise from a table generated from them (`node scripts/generate-control-types.mjs`, checked by a test).
- `@jelly/storefront-schema` and `@jelly/storefront-registry` are marked free of side effects, and the plain helpers that store pages use (version comparison, menu photos, document helpers, parts, element data) moved out of the files that build zod schemas.
- The legacy browser repository no longer validates designs against the registry (nothing in the app saves them; the editor saves through the API, which does). The store frame no longer fetches the published design again when the server already sent it.

**Result.** Start-up JavaScript 456 KB to 334-340 KB compressed (home, collection, product); no zod in any chunk a store page loads, on 11 store pages at 1280 and 390 px. Lighthouse (3 runs): performance average **82-83, within the 80 budget** (phone 69-78, desktop 82-98); accessibility, best practices and SEO 100. Phones are still under 80 on their own; the next step would be the other themes' CSS (about 50 KB) and theme manifests in the JavaScript (about 25 KB).
