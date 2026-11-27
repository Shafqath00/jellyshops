# Site preferences restructure: handoff (2026-11-27)

Settings > Store > **Site preferences** (`/admin/settings/preferences`) went from one long page (14 cards, ~73 controls, ~8,700px) to six tabs that share one form and one Save bar. Data model, API and storefront behaviour are unchanged.

## What is built

- Tabs are routes under `src/app/admin/s/[shop]/settings/preferences/(tabs)/`: `page.tsx` = Search, plus `branding`, `policies`, `tracking`, `privacy`, `advanced`. The `(tabs)/layout.tsx` wraps them in `SitePreferences` (`src/features/store-preferences/site-preferences.tsx`), which holds the form state (`usePreferencesForm`), the tab bar, banners, the single SaveBar, Ctrl/Cmd+S and the unsaved-changes warning. `tabForPath()` decides which tab a field (and its error) belongs to; on a failed save the page jumps to the first problem's tab and focuses the field.
- Tab contents: `src/features/store-preferences/preference-tabs.tsx` (`SearchTab`, `BrandingTab`, `PoliciesTab`, `TrackingTab`, `PrivacyTab`, `AdvancedTab`; `More` = collapsed "show more" section).
  - Search: Google preview, homepage title/description with counters, "let search engines find the store", one-line SEO score linking to the bulk SEO editor.
  - Branding: sharing image + share preview, browser-tab icon, social links (collapsed).
  - Policies: policy page per policy, templates.
  - Tracking: GA4, Meta Pixel, GTM (collapsed), Search Console code.
  - Privacy and access: cookie banner, spam protection, store password (saves on its own).
  - Advanced (all collapsed): URL redirects link, sitemap/robots links, structured data, page title templates, bulk SEO link, export/import, change history.
- Business details (legal name, phone, address, language, units) moved to **Settings > General** as their own card with their own Save button: `business-details-section.tsx`. Still stored in store preferences.
- Nav: Online Store > Preferences and the separate URL redirects settings tile removed; old addresses still redirect. Settings pages are now in the top-bar search (`adminDestinations()` in `admin-nav.tsx`). Settings side list stays highlighted on sub-pages.
- Removed: `preferences-page.tsx` (old one-page layout), the setup checklist card, the SEO health card (now one line), jump chips.

## Not done yet (please pick up)

1. **CSS**: the new class names have no styles yet. Add a "Site preferences" block at the end of `src/app/admin/admin-kit.css` (file is CRLF; use `--jk-*` tokens): `.jk-pref-tabs` / `.jk-pref-tab-link` (pill or underline tabs, `aria-current` state, focus ring, sideways scroll on phones), `.jk-pref-body` (column with gap), `.jk-pref-more` / `.jk-pref-more-body` (like `.jk-discount-more`), `.jk-pref-score-line`, `.jk-pref-advanced`, `.jk-pref-links`, `.jk-pref-note`; respect reduced motion.
2. **Tests**: 7 tests in `store-preferences.test.tsx` are `it.skip` with a TODO. They were written for the old layout (old labels, More actions menu, setup checklist) and need rewriting for the tabs: field problems jump to the right tab, tracking snippet paste, server problems + conflict banner, policies + history, export/import from the Advanced tab. Add a test for the General page Business details card.
3. **Dead code**: unused exports still in `cards/seo-card.tsx` (SeoCard, TitleTemplatesCard, SearchVisibilityCard; keep SearchPreview), `cards/tracking-card.tsx` (TrackingCard, PrivacyCard, SpamCard), and possibly SetupCard/HealthCard (keep `useSeoHealth`).
4. **Browser check** (not done): every tab at 1366/768/375px, light and dark; save a change and confirm it reaches the storefront (e.g. homepage title meta); the business details card on General.
5. Update the root `CLAUDE.md` "State of the work" once finished.

Type-check is clean; lint has no errors; the store-preferences, settings and layout test files pass (7 skipped as above).
