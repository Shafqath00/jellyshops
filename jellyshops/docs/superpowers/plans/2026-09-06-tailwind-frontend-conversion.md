# Tailwind Frontend Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert all static frontend styling to Tailwind CSS v4 while retaining dynamic storefront theme variables.

**Architecture:** Define Jellyshops visual tokens in Tailwind, migrate each screen family to utilities, and reduce global CSS to resets and data-driven storefront variables. Shared components are migrated before pages so pages compose the same Tailwind patterns.

**Tech Stack:** Next.js 16, React, TypeScript, Tailwind CSS v4, clsx, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-tailwind-frontend-design.md`

## Global Constraints

- Preserve the current Jellyshops palette, copy, interaction behavior, and URL structure.
- Keep `--store-*` variables for merchant-selected storefront themes.
- Do not add a styling dependency.
- Keep visible focus indicators and reduced-motion support.
- Run unit tests, TypeScript validation, and a production build after migration.

---

### Task 1: Tailwind design foundation

**Files:** `src/app/globals.css`, `src/app/page.tsx`, `src/app/page.test.tsx`.

- [ ] Add a failing landing-page assertion for the Tailwind primary action class.
- [ ] Add `@theme` tokens for Jellyshops ink, paper, guava, citrus, mint, blue,
  radii, shadows, and font stacks.
- [ ] Replace landing-page semantic style classes with responsive Tailwind
  utilities, including focus and reduced-motion-safe transitions.
- [ ] Run the landing-page test and `npm run typecheck`.

### Task 2: Shared application components

**Files:** `src/components/app-shell.tsx`, `src/components/admin-nav.tsx`,
`src/components/empty-state.tsx`, `src/components/product-card.tsx`,
`src/components/cart-panel.tsx`, `src/components/store-header.tsx`, and their
existing tests.

- [ ] Write failing assertions for utility-driven active navigation and cart
  panel surfaces.
- [ ] Replace shared semantic layout and control classes with Tailwind
  utilities and `clsx` variants.
- [ ] Run component tests and check mobile responsive classes in the rendered
  class lists.

### Task 3: Merchant administration and editor routes

**Files:** `src/app/admin/**/*.tsx`, `src/features/store-editor/**/*.tsx`.

- [ ] Migrate each route's static card, table, form, editor, and mobile layout
  classes to Tailwind utilities.
- [ ] Preserve all form labels, validation messages, keyboard controls, and
  editor drag behavior.
- [ ] Run admin and editor unit tests.

### Task 4: Public storefront and checkout routes

**Files:** `src/app/[storeSlug]/**/*.tsx`, `src/features/storefront/**/*.tsx`,
`src/components/storefront-frame.tsx`.

- [ ] Migrate static storefront, shop, product, checkout, and order layouts to
  Tailwind utilities.
- [ ] Retain the data-driven `--store-*` CSS variables on storefront roots and
  use Tailwind arbitrary values only where those runtime variables are needed.
- [ ] Run storefront and checkout tests.

### Task 5: Remove obsolete global CSS and verify

**Files:** `src/app/globals.css`, all migrated files.

- [ ] Delete selectors no longer referenced by JSX; retain only reset, token,
  runtime-theme, and reduced-motion rules.
- [ ] Run `npm test`, `npm run typecheck`, and `npm run build`.
- [ ] Check the landing page, admin home, storefront, and checkout at desktop
  and mobile widths.
