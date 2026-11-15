# Handoff: Jelly Shop marketing site, sign-in and onboarding (black-and-white design system)

Branch: `redesign/jelly-shop-ui`. Written 2026-11-15 for the developer taking this over; updated the same day after the images, browser check, staging run and owner decisions.

## What the brief asked for

A bold, premium black-and-white SaaS look (references: Vercel, Shopify, Linear, Webflow), dark by default with a light mode, Geist + Geist Mono, Framer Motion (`motion`) + Lenis, Lucide icons, real brand logos only for real integrations, and every image made with ChatGPT in the same style. Three parts: (1) home page, (2) sign-up / log-in / password reset / email confirmation, (3) five-step onboarding that lands on the dashboard checklist.

## Status

| Part | State |
| --- | --- |
| Research | Done: `docs/redesign/RESEARCH.md` (section order, components, motion measured on 6 sites) |
| Design tokens | Done: `docs/redesign/DESIGN_TOKENS.md`, code in `jellyshops/src/features/brand/brand.css` |
| Logos | Done: `docs/redesign/LOGOS.md`, SVGs in `jellyshops/public/logos/` (Stripe, YouTube, Vimeo, Spotify, SoundCloud only) |
| Home page | Done and browser-checked (1440px and 390px, light mode, reduced motion, 60 fps scroll in a local headless run) |
| Sign-in screens | Done and browser-checked 2026-11-15 (1440 and 390px, dark, light, reduced motion, keyboard focus): split screen with the portrait `auth-visual.webp`, check-your-email screen with resend, Google button above the form (still hidden: `NEXT_PUBLIC_JELLYSHOP_GOOGLE_SIGN_IN` not set, Google provider not configured). |
| Onboarding | Done, browser-checked (same widths and modes, fake backend) and run end to end on staging 2026-11-15 (see "Staging run"). |
| Images for sign-in and onboarding | Done 2026-11-15: `auth-visual.webp` and `onboarding-store/-sell/-channels/-product.webp` (ChatGPT, logged in `ASSETS.md`). `onboarding-design.webp` skipped: step 4 shows the chosen design's cover. |
| Changelog | Done: `/changelog` (`src/app/changelog/`, entries in `changelog-content.ts`, newest first, only shipped features). The home "New" pill and the footer link to it. |

## Owner decisions (2026-11-15)

- Name: **"Jellyshop"** (one word) on the home page, sign-in, onboarding and the dashboard welcome banner. Not yet changed: the home hero picture (`hero-dashboard-storefront.webp`) has "Jelly Shop" drawn on the laptop screen (needs a new ChatGPT image), and other parts of the repo (backend messages, theme wording, `storefront-registry/src/sections/layout.ts`).
- Prices: keep **£0 / £19 / £49** a month.
- "Book a demo" became **"Take the tour"** (opens the product tour dialog).
- Changelog page: built (above).
- Social links: the owner will send the addresses; footer links in `home-content.ts` (`social`) are still `#`.
- Terms / Privacy / Cookies pages: **not yet; launch blocker.** The backend also needs `JELLYSHOP_TERMS_URL`, `JELLYSHOP_PRIVACY_URL` and `JELLYSHOP_TERMS_VERSION`; without them sign-up shows "New accounts are temporarily unavailable" and onboarding stops at the terms.
- Google sign-in: skipped for now (setup steps in `backend/docs/merchant-onboarding-rollout.md`).

## Staging run (2026-11-15)

Local frontend (port 3210) + local backend against staging, with placeholder policy settings (`https://example.test/terms|privacy`, version `qa-test-only`) on the local backend only. Dedicated merchant from `npm run provision:onboarding-e2e` (login only in the git-ignored `jellyshops/.env.onboarding.local`). `e2e/onboarding.spec.ts` (rewritten for the five steps) passed every step: terms, address check, progress across a reload, resume on the saved step, channels, design (Halo chosen over the suggested Forma), first product, store created in GBP, `/admin?welcome=1` with the banner and "Set up your store" checklist, product saved as DRAFT, theme `jelly-halo` installed. **Test store left on staging:** "Onboarding E2E 1794764997116" (`onboarding-e2e-1794764997116`, id `store-9ac621e6-dae1-49f8-93af-e8caf46b2438`). `npm run reset:onboarding-e2e` currently refuses to run ("The Store foreign-key dependency graph changed"): its allowlist in `backend/scripts/lib/onboarding-e2e-reset.ts` must be updated before the store can be reset and the spec re-run. Run the spec against an already running dev server with a temporary Playwright config that only sets `baseURL` (this machine cannot hold a second Next server).

## Colour pass (2026-11-15)


The owner asked to move from black-and-white to a vibrant accent system on the dark base. Done: image audit (`docs/redesign/IMAGE_AUDIT.md`), accent tokens, all home, sign-in and onboarding pictures regenerated in colour, colour layer at the end of `home.module.css`, `merchant-auth.module.css` and `onboarding.module.css` (marked "Colour layer"), original-colour integration logos, CSS glows for the final call to action, `/changelog` header and footer links back to the home page. Checks at 1440/768/390px, dark and light: axe (no violations), a measured contrast check of every text item on gradients/pictures (none below AA), an edge check of every image (no bright edges), motion and Lenis still running. Open: the hero background is an upscale of a 1672px original; `bg-hero-grid.webp` (grey grid) still sits behind the sign-in and onboarding panels.


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

- **Colours (changed 2026-11-15):** dark base plus the accent system in `brand.css` (violet #7C5CFF, blue #3B82F6, cyan #22D3EE, magenta #F0449A, amber #FFB547; gradients, glows, tints; table in `DESIGN_TOKENS.md`). Only tokens, never raw colours, and only the AA-measured text tokens for text. No Jelly Links colours (`JellyShopLogo` replaces the lime tile).
- **Motion:** animate only `transform` and `opacity`, easing `[0.22, 1, 0.36, 1]`. Always use `useReducedMotion` from `features/brand/motion` (not Motion's own; ours is hydration-safe). Never hide real content behind an `opacity: 0` entrance (see the sign-in panel: it slides, it doesn't fade).
- **Logos:** a real brand logo only for a real integration, in its own colour (`public/logos/<slug>-color.svg`); customers are invented names shown as text. Read `LOGOS.md` before adding one.
- **Copy:** anything not built is marked "Soon"; stories and shop names are labelled illustrative.
- **Images:** generated with ChatGPT in the colour style (style lines `S4` and `T4` in `ASSETS.md`; `S3`/`T3` were the black-and-white ones), saved as WebP in `public/assets/`, every prompt logged in `ASSETS.md`. No stock photos.

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

1. **Social links:** put the owner's account addresses in `social` in `src/app/home-content.ts` (they are `#`).
2. **Legal pages (launch blocker):** Terms, Privacy and Cookies pages, then set `JELLYSHOP_TERMS_URL`, `JELLYSHOP_PRIVACY_URL` and `JELLYSHOP_TERMS_VERSION` on every backend that takes sign-ups.
3. **Google sign-in:** when the owner has set up the Google provider and callback URLs in Supabase (`backend/docs/merchant-onboarding-rollout.md`), set `NEXT_PUBLIC_JELLYSHOP_GOOGLE_SIGN_IN=true` for the frontend build and check the button and the redirect.
4. **Home hero picture:** regenerate `hero-dashboard-storefront.webp` with "Jellyshop" on the laptop screen (same prompt in `ASSETS.md`, name changed).
5. **Reset script:** update the table allowlist in `backend/scripts/lib/onboarding-e2e-reset.ts`, then reset the staging test store and re-run `e2e/onboarding.spec.ts`.
6. Small: on a phone, onboarding step 4 opens about 15px down (the "Back" link is half hidden).

## How to run and check

- Frontend: `cd jellyshops && npm install` (adds `motion` and `lenis`), then the "jellyshops-admin" launch entry (port 3210) or the dev command in `CLAUDE.md`.
- Tests: `NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/app/page.test.tsx src/app/onboarding src/features/auth src/app/admin/home-page.test.tsx src/app/changelog` (37 pass on 2026-11-15).
- Backend onboarding: `cd backend && npx vitest run src/onboarding`.
- Visual checks used for the home page: Playwright at 1440x900 and 390x844, scroll the page in steps, take viewport screenshots (full-page captures break the pinned "How it works" section), check `scrollWidth` for sideways scroll, emulate `prefers-reduced-motion: reduce`, switch light mode with the sun button.
- Machine note: this computer runs out of memory with two Next dev servers; stop one first.
