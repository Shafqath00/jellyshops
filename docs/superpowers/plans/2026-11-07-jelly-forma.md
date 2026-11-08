# Jelly Forma Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a standalone, editable furniture theme inspired by Hyper.
**Architecture:** Scaffold with the Jelly CLI, replace its sample design with contract tokens and built-in sections, register its preview, and ship source assets plus a scoped application stylesheet. No renderer or backend changes.
**Tech Stack:** Jelly manifest/starter JSON, CSS, Next.js preview, Vitest and Playwright.
**Spec:** docs/theme-briefs/jelly-forma.md

## Global Constraints
Preserve existing edits and published themes. ID `jelly-forma`, version `1.0.0`. Fixed platform breakpoints. Scheme-role colours only in CSS; shared frame controls page edges. No staging writes.

## Review Focus
Empty catalogues; long product/menu names; scheme and font edits; mobile navigation and overflow; functioning cart/options rather than decorative controls.

### Task 1: Theme system and starter
- [x] Scaffold `jellyshops/packages/storefront-themes/src/themes/jelly-forma` using the CLI.
- [x] Replace manifest defaults/schema, starter pages/menus and source stylesheet; use existing built-in sections, square cards and four AA schemes.
- [x] Provide independent furniture imagery and preview artwork in assets; remove the scaffold's unused custom recipe.
- [x] Run CLI validate and conformance; fix failures.

### Task 2: Application preview and integration
- [x] Regenerate `themes/index.generated.ts`; add a Forma config and route under `src/app/theme-preview/jelly-forma/page.tsx`.
- [x] Generate a scoped stylesheet from theme.css and import it in app layout; make generation reproducible.
- [x] Build storefront packages and start preview/dev servers.

### Task 3: Verification and delivery
- [x] Add `e2e/jelly-forma-theme.spec.ts` for seven pages, three widths, navigation/options/cart and axe.
- [x] Verify actual rendered appearance, fix theme-specific problems, run design lint without adding baseline findings.
- [x] Run unit tests, typecheck and lint; record exact outcomes and any existing failures in the theme REPORT.md.
- [x] Package the theme for review; defer backend shared-package replacement and staging/publishing until release approval.

Execution notes: used the existing checkout and preserved its unrelated edits. The full unit-suite attempt did not complete; targeted tests, conformance, build, typecheck, changed-file lint and browser verification are documented in the theme REPORT.md. Repository-wide lint reports existing errors.
