# Handoff: Jelly Shop marketing site, sign-in and onboarding (black-and-white design system)

Branch: `redesign/jelly-shop-ui`. Written 2026-11-15 for the developer taking this over.

## What the brief asked for

A bold, premium black-and-white SaaS look (references: Vercel, Shopify, Linear, Webflow), dark by default with a light mode, Geist + Geist Mono, Framer Motion (`motion`) + Lenis, Lucide icons, real brand logos only for real integrations, and every image made with ChatGPT in the same style. Three parts: (1) home page, (2) sign-up / log-in / password reset / email confirmation, (3) five-step onboarding that lands on the dashboard checklist.

## Status

| Part | State |
| --- | --- |
| Research | Done: `docs/redesign/RESEARCH.md` (section order, components, motion measured on 6 sites) |
| Design tokens | Done: `docs/redesign/DESIGN_TOKENS.md`, code in `jellyshops/src/features/brand/brand.css` |
| Logos | Done: `docs/redesign/LOGOS.md`, SVGs in `jellyshops/public/logos/` (Stripe, YouTube, Vimeo, Spotify, SoundCloud only) |
| Home page | Done and browser-checked (1440px and 390px, light mode, reduced motion, 60 fps scroll in a local headless run) |
| Sign-in screens | Built: split screen, check-your-email screen with resend, Google button above the form (hidden until `NEXT_PUBLIC_JELLYSHOP_GOOGLE_SIGN_IN=true`). Unit tests pass. **Not yet looked at in a browser.** |
| Onboarding | Built: five steps, animated progress bar and step transitions, live store preview, success state, `/admin?welcome=1` welcome banner. Unit tests pass. **Not yet looked at in a browser or run against the backend.** |
| Images for sign-in and onboarding | **Not made.** The owner's ChatGPT account hit its daily image limit. Placeholders are images already made today in the same style. Prompts below. |

## Where things live

| What | Path |
| --- | --- |
| Brand tokens (dark + light), Lenis CSS | `jellyshops/src/features/brand/brand.css`, applied by putting `data-brand` on a page root |
| Fonts (Geist, Geist Mono via `next/font/google`) | `jellyshops/src/features/brand/fonts.ts` |
| Monochrome logo (same shapes as `public/brand/jellyshop.svg`) | `jellyshops/src/features/brand/logo.tsx` |
| Motion helpers: Lenis driven by Motion's frame loop, `Reveal`, `Counter`, hydration-safe `useReducedMotion`, `MotionProvider` | `jellyshops/src/features/brand/motion.tsx` |
| Home page | `jellyshops/src/app/page.tsx`, sections in `src/app/_home/`, copy in `src/app/home-content.ts`, styles `src/app/home.module.css` |
| Home images | `jellyshops/public/assets/` (prompts in `docs/redesign/ASSETS.md`) |
| Sign-in shell and forms | `jellyshops/src/features/auth/components/` (`auth-shell.tsx`, `auth-form.tsx`, `reset-password-form.tsx`, `merchant-auth.module.css`) |
| Onboarding | `jellyshops/src/app/onboarding/` (`page.tsx`, `steps.tsx`, `onboarding.module.css`) |
| Onboarding API (backend) | `backend/src/onboarding/` (schema, service, routes), migration `20261114000000_merchant_onboarding.sql` (**already applied to staging**, tables empty) |
| Dashboard checklist + welcome banner | `jellyshops/src/app/admin/page.tsx` |
| Light-mode-before-paint script | `jellyshops/src/app/layout.tsx` (`<Script id="home-theme" strategy="beforeInteractive">`) |

## Rules to keep

- **Colours:** only the tokens in `brand.css`. No hue anywhere except the tiny green "live" dot. No Jelly Links colours (the Jelly Shop logo's lime tile is replaced by `JellyShopLogo` on these pages).
- **Motion:** animate only `transform` and `opacity`, easing `[0.22, 1, 0.36, 1]`. Always use `useReducedMotion` from `features/brand/motion` (not Motion's own; ours is hydration-safe). Never hide real content behind an `opacity: 0` entrance (see the sign-in panel: it slides, it doesn't fade).
- **Logos:** a real brand logo only for a real integration; customers are invented names shown as text. Read `LOGOS.md` before adding one.
- **Copy:** anything not built is marked "Soon"; stories and shop names are labelled illustrative.
- **Images:** generated with ChatGPT in the black-and-white style (style lines `S3` and `T3` in `ASSETS.md`), saved as WebP in `public/assets/`, every prompt logged in `ASSETS.md`. No stock photos.

## Onboarding: how the five steps map to the backend

The database only accepts the step names `profile, store, branding, business, products, review`, so the visible steps reuse them (no migration needed):

| Visible step | Saved as | Answers |
| --- | --- | --- |
| 1 Name your store | `store` | `name`, `slug` (live availability check), `fullName`, `country` (sets currency, required) |
| 2 What do you sell? | `business` | `category` (tiles), `productCategories` |
| 3 How do you sell today? | `profile` | `sellingChannels` (new optional answer, added to `backend/src/onboarding/schema.ts`; JSON only, no column) |
| 4 Pick a design | `branding` | `theme` (any real starter pack, checked with `isStarterPackId`; the category suggests one), optional logo |
| 5 Add your first product | `products` | `product` (saved as a draft); "Create my store" saves as `review` and calls `/complete` |

## To do next

1. **Generate the six missing images** when the ChatGPT limit resets (owner's account; it said "try again tomorrow at 6:45 PM" on 2026-11-15). Prefix each with the `S3` style line from `ASSETS.md`, save as WebP in `public/assets/`, add to `ASSETS.md`, then point the code at them:
   - `auth-visual.webp` (portrait 1024x1536): a tall black phone showing a dark store (black vase hero, two £ product cards, white "Add to bag"), floating glass cards "Store published", "New order £86.00" and a small rising sales line; lots of dark space top and bottom. Replace `hero-dashboard-storefront.webp` in `auth-shell.tsx`.
   - `onboarding-store.webp` (1024x1024): a glass address bar reading "jelly.shop/fern-studio" with a tick, above a matte black shopfront with a blank sign.
   - `onboarding-sell.webp`: a still life of five black and white products (vase, tote, headphones, serum bottle, notebook) on graphite plinths with tiny glass tags.
   - `onboarding-channels.webp`: a phone with a social post, a laptop store, a market-stall card reader and a parcel, joined by thin glowing lines.
   - `onboarding-design.webp` (optional; step 4 already shows the chosen design's real cover).
   - `onboarding-product.webp`: a product card being created: vase photo, title, price £42, white "Add product" button.
   Swap the paths in `stepVisual` in `src/app/onboarding/steps.tsx`.
2. **Browser check** sign-in, sign-up, check-your-email, forgot/reset password and the onboarding steps at 1440px and 390px, dark and light. The home page checks are the model (see "How to check" below).
3. **Run onboarding end to end** with a test merchant on a local backend against staging (ask the owner first; it creates a store). Confirm the chosen design installs and the product is saved as a draft.
4. **Google sign-in:** configure the provider in Supabase (see `backend/docs/merchant-onboarding-rollout.md`), then set `NEXT_PUBLIC_JELLYSHOP_GOOGLE_SIGN_IN=true`.
5. **Open decisions for the owner:** prices (£0/£19/£49 are placeholders), a demo booking link for "Book a demo", social account addresses, the Terms/Privacy/Cookies pages, a changelog page for the "New" pill, "Jellyshop" vs "Jelly Shop" spelling.

## How to run and check

- Frontend: `cd jellyshops && npm install` (adds `motion` and `lenis`), then the "jellyshops-admin" launch entry (port 3210) or the dev command in `CLAUDE.md`.
- Tests: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/app/page.test.tsx src/app/onboarding src/features/auth src/app/admin/home-page.test.tsx` (36 pass).
- Backend onboarding: `cd backend && npx vitest run src/onboarding`.
- Visual checks used for the home page: Playwright at 1440x900 and 390x844, scroll the page in steps, take viewport screenshots (full-page captures break the pinned "How it works" section), check `scrollWidth` for sideways scroll, emulate `prefers-reduced-motion: reduce`, switch light mode with the sun button.
- Machine note: this computer runs out of memory with two Next dev servers; stop one first.
