# Premium product pages implementation

Approved source: the user's Premium Product Pages Redesign plan in this chat.

## Constraints
- Product list and create/edit pages only; keep dashboard shell and other pages unchanged.
- Product-scoped neutral graphite tokens, Inter typography, dark-mode equivalents and responsive layouts.
- Preserve APIs, models, existing editor features, pagination and selection behavior.
- Use Framer Motion with lazy features, reduced-motion support and stable form mounting.
- No live products are created or published during visual verification.

## Tasks
- [x] Add list regression coverage for search, filtering, sorting, pagination, row actions, collections and partial failures.
- [x] Add scoped product surface and overlay styling, lazy motion and animated native disclosures.
- [x] Restyle editor controls, gallery, option/variant surfaces, navigation and save bar.
- [x] Add product row actions and use scoped accessible dialogs for product confirmations.
- [x] Run product/editor and shared component tests, typecheck, lint, independent review and responsive browser checks.

## Verification record
- Framer Motion and the Radix row-menu primitive are pinned in the frontend lockfile.
- Product editor, list and shared admin tests: 246 passed in the full run. The remaining variant journey hit its 20-second timeout in parallel and passed when rerun alone in 9.46 seconds.
- TypeScript passed. Targeted ESLint reported zero errors and 15 existing warnings.
- Reviewed the list and editor at 390, 768 and 1440 pixels. Verified dark mode, archive cancellation, preview, hidden-field validation and discard without saving a live product.
- Verified the Inventory page had no product theme wrapper and matched the product page's shell styling. Captured final list and editor screenshots.
- Independent review found two focus restoration edge cases; added and passed regression tests for duplicate titles and removed confirmation triggers.
- Used a temporary write-rejecting loopback listener for final captures because the local API stopped responding. No backend files, persistent configuration or live product data changed.
