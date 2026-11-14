# Shopify Admin: structure and workflows to adopt

Sources: Shopify's public Help Center and Polaris documentation (structure and workflows only; no visual styling copied), and the earlier comparison in `docs/reports/2026-11-08-admin-shopify-comparison-and-redesign-plan.md`, which was made in the owner's own Shopify admin.

## Patterns and decisions

| Area | Shopify pattern | Jelly Shop decision |
| --- | --- | --- |
| Navigation | Flat left list: Home, Orders, Products, Customers, Content, Analytics, Marketing, Discounts; sub-pages appear only inside the active group; Settings pinned at the bottom; sales channels in their own section | **Adopt** (already in `ADMIN_NAV`). Keep groups collapsed unless active. Add dotted section labels in the Jelly style |
| Global search | One search box for pages and records, keyboard shortcut | **Adopt** for pages (exists, Ctrl/Cmd+K). Record search stays in each list |
| Home | Greeting, date range, key figures with change vs previous period, sales chart, "things to do" (orders to fulfil, low stock), setup guide | **Adopt**. Already present; redesign gives it a welcome card and Jelly stat tiles |
| Analytics | Separate dashboards and reports | **Leave out for now**: no reporting backend; Home holds the figures. Recommend as follow-up |
| Index pages | One table card: saved-view tabs, search + filters + sort in one bar, row checkboxes, bulk action bar replaces the toolbar, pagination, row click opens detail | **Adopt** (IndexTable). Restyle only |
| Detail pages | Title row with back arrow, status badges, primary actions on the right and "More actions"; two columns: main (2/3) + side summary (1/3) | **Adopt** (AdminPage + DetailLayout) |
| Forms | Contextual save bar that appears when something changed; leave-page warning | **Adopt** (SaveBar). Restyle as a floating ink pill bar |
| Products | One page: title, description, media, pricing, inventory, variants (options → combinations table), organisation (type, brand, collections, tags), status side card | **Adopt** (product builder). Keep its sections, restyle cards |
| Inventory | Table of variants with editable "available" counts, adjust with a reason, history | **Adopt** (exists) |
| Orders | Payment and fulfilment badges, timeline, fulfil/refund flows, packing slips, tags | **Adopt** (exists) |
| Customers | List with spend/orders, segments by filters, profile with notes, tags, address, consent | **Adopt** (exists, filters lighter than Shopify segments) |
| Collections | Manual or automated by rules | **Partly**: manual only today; automated rules are new functionality, not UI |
| Bulk actions | Bulk editor, CSV import/export | **Adopt** (exists) |
| Settings | Index of grouped tiles, each a focused page | **Adopt** (exists) |
| Discounts, Marketing, Apps, Markets | Full modules | **Leave out**: not built in Jelly Shop; showing empty menu items would confuse beginners |
| Status language | Plain words, coloured tone per meaning (success, attention, critical, info) | **Adopt** (`status.ts`), never raw API codes |

## Simplicity rules taken from Shopify

1. One primary action per page, top right.
2. Secondary actions grouped under "More actions".
3. Empty states explain what the page is for and offer the first step.
4. Tables keep three to six columns; detail lives on the detail page.
5. Sub-navigation only shows inside the section you are in.
</content>
</invoke>
