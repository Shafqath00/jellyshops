# Prompt for the next developer's Claude

Copy everything below the line into Claude Code, started in the repository root after `git pull` on branch `redesign/jelly-shop-ui`.

---

You are continuing the Jelly Shop marketing site, sign-in and onboarding work on branch `redesign/jelly-shop-ui`. Before doing anything, read these files in full:

1. `CLAUDE.md` (project rules; note the paragraph "Jelly Shop marketing site, sign-in and onboarding")
2. `docs/handoff/jelly-shop-design-system.md` (what is built, where it lives, rules, what is left)
3. `docs/redesign/DESIGN_TOKENS.md`, `docs/redesign/ASSETS.md`, `docs/redesign/LOGOS.md`, `docs/redesign/RESEARCH.md`
4. `jellyshops/AGENTS.md` (this Next.js version has breaking changes; read `jellyshops/node_modules/next/dist/docs/` before using Next APIs)

Then run `npm install` in `jellyshops/` (the branch added `motion` and `lenis`).

## The design system you must follow

- Black-and-white premium SaaS look, dark by default with a light mode. Only the tokens in `jellyshops/src/features/brand/brand.css` (put `data-brand` on the page root). No hue except the tiny green "live" dot. No Jelly Links colours; use `JellyShopLogo` from `features/brand/logo.tsx`.
- Fonts: Geist and Geist Mono from `features/brand/fonts.ts`.
- Motion: `motion` (Framer Motion) and Lenis via `features/brand/motion.tsx`. Animate only transform and opacity, easing `[0.22, 1, 0.36, 1]`. Use our `useReducedMotion` from `features/brand/motion` (it is hydration-safe), not Motion's own. Never hide real content behind an opacity-0 entrance.
- Icons: Lucide, stroke width 1.5.
- Real brand logos only for real integrations; customers are invented names shown as text. Anything not built is marked "Soon".
- Images: generated with ChatGPT only, never stock. Use the style lines `S3` / `T3` from `docs/redesign/ASSETS.md`, save as WebP in `jellyshops/public/assets/`, log every prompt in `ASSETS.md`.
- Plain, specific, benefit-led copy. No lorem ipsum.

## Tasks, in order

Work phase by phase. After each phase: run the relevant tests, type check and lint, commit with a `feat:`/`fix:`/`test:`/`chore:` message, and report to the owner what changed and what was and was not verified. Ask the owner before writing to the staging database, pushing, or anything that creates real accounts or stores.

### Phase 1: the six missing images

The owner's ChatGPT account hit its daily image limit on 2026-11-15. Ask the owner to confirm ChatGPT image generation works again. Then, using the owner's signed-in ChatGPT in Chrome (one fresh chat per image), generate the six images whose prompts are listed under "To do next" in `docs/handoff/jelly-shop-design-system.md`: `auth-visual.webp` (portrait 1024x1536), `onboarding-store.webp`, `onboarding-sell.webp`, `onboarding-channels.webp`, `onboarding-product.webp` and optionally `onboarding-design.webp` (square 1024x1024). Prefix each prompt with the `S3` style line. Download each with the owner's permission, convert to WebP (sharp is installed in `jellyshops/`), check them in a contact sheet, then:

- use `auth-visual.webp` in `jellyshops/src/features/auth/components/auth-shell.tsx` (replacing `hero-dashboard-storefront.webp` there; the portrait image may need the frame's aspect ratio changed),
- point `stepVisual` in `jellyshops/src/app/onboarding/steps.tsx` at the new onboarding images,
- add every prompt to `docs/redesign/ASSETS.md`.

If ChatGPT still refuses images, stop this phase and tell the owner; do not substitute other images.

### Phase 2: browser check of sign-in and onboarding

Start this project's dev server (the "jellyshops-admin" entry in `.claude/launch.json`, port 3210; this machine runs out of memory with two Next servers, so stop any other one first). With Playwright, check at 1440x900 and 390x844, in dark and light mode (the sun button on the home page sets light mode for these pages too) and with reduced motion:

- `/login`, `/signup`, `/login?recover=1`, `/auth/reset-password`, and the "Check your email" screen (sign up shows it when there is no session)
- `/onboarding` every step (it needs a signed-in merchant without a store; if you cannot sign in, render the steps through the unit-test setup or ask the owner)

Look for: no sideways scroll, no console errors, focus order and visible focus, error/loading/success states, text contrast in both modes, the split-screen visual only from 1024px, the progress bar and step transitions. Take viewport screenshots, not full-page ones. Fix what you find.

### Phase 3: onboarding end to end (ask first)

With the owner's approval, run a local backend against staging (`node --import tsx src/server.ts` in `backend/`, with `CORS_ORIGINS` including the frontend's origin) and go through onboarding with a test merchant the owner provides or approves (never type the owner's real passwords). Confirm: the address check works, the chosen design installs, the first product is saved as a draft, the dashboard opens with the welcome banner and the setup checklist. Record the test store and tell the owner it exists on staging.

### Phase 4: Google sign-in (owner's setup)

Explain to the owner the steps in `backend/docs/merchant-onboarding-rollout.md` (Google provider in Supabase, callback URLs). Once they confirm it is configured, set `NEXT_PUBLIC_JELLYSHOP_GOOGLE_SIGN_IN=true` and check the button and redirect.

### Phase 5: owner decisions

Ask the owner for, and then apply: real prices (the home page shows placeholder £0/£19/£49), a booking link for "Book a demo" (currently a product tour), the social account addresses (footer links are `#`), the Terms/Privacy/Cookies pages, a changelog page for the "New" pill (it points to the features section), and whether the name is written "Jellyshop" or "Jelly Shop" (the repo uses both).

## Things not to touch

- `jellyshops/.env.local` (machine-specific; never commit secrets).
- `jellyshops/packages/storefront-registry/src/sections/layout.ts` and `docs/schemas/sections.json` hold another session's "Jellyshop" wording change tied to the packed backend packages (`backend/jelly-storefront-*.tgz`); leave them unless the owner asks, and if you change package sources follow the repack steps in `CLAUDE.md`.
- Never bump a theme's `version` or change a theme `id`.

## How to verify

- Frontend tests: `cd jellyshops && NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/app/page.test.tsx src/app/onboarding src/features/auth src/app/admin/home-page.test.tsx`
- Backend onboarding tests: `cd backend && npx vitest run src/onboarding`
- Type check: `npx tsc --noEmit -p .` in both `jellyshops/` and `backend/`; lint the files you change with `npx eslint <paths>`.

When everything is done, update `docs/handoff/jelly-shop-design-system.md` and the paragraph in `CLAUDE.md`, and summarise for the owner what is built, what was verified, and what is still open.
