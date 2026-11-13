# Admin design guide

How to build an admin page so it looks and behaves like every other one. The parts live in `jellyshops/src/components/admin/` (import from `@/components/admin`), the styles and tokens in `jellyshops/src/app/admin/admin-kit.css`. See every part working at `/admin/design-kit` (signed in; not in the menu).

When you add or change a kit part: update it in the kit, show it on `/admin/design-kit`, add a test to `admin-kit.test.tsx` (behaviour + axe), and add a line here.

## Which part for what

| You need | Use | Notes |
| --- | --- | --- |
| A page | `AdminPage` | Always give `title` and a one-line `description`. `width`: `full` for lists, `detail` for a record, `narrow` for settings forms. One `primaryAction`; the rest are `secondaryActions` or `moreActions`. |
| A box of related content | `Card` | `title` + optional `description`. `flush` when it holds a table or list. |
| Record page with a side column | `DetailLayout` | The side column drops below under 1024px. |
| A list of records | `IndexTable` | Tabs for views, `search`, `filters`, `sort`, `bulkActions`, `pagination`, `emptyState`, `error` + `onRetry`, `loading`. Rows become cards on phones: mark one column `mobile: "primary"` and hide the least useful with `mobile: "hidden"`. |
| Pick one item from a short list beside its detail | `SelectList` + `SplitLayout` | Pages, Blog posts, Menus. |
| A form | `ResourceForm` + `Card` + `Field` | The save bar, the leave-page warning and the "Not saved" banner come with it. Throw an `Error` with a plain message from `onSubmit` to show it. |
| A save bar without `ResourceForm` | `SaveBar` | Only when the page saves several things at once (Inventory). |
| A button | `Button` | See "Buttons" below. For a link that looks like a button: `className={buttonClass("primary")}`. |
| A label with help and errors | `Field` | Give the control the same `id`. `required` marks the label. `help` for a standing hint, `error` for what is wrong now. |
| Extra explanation next to a label | `HelpTip` | One or two sentences. If everyone needs it, use `help` on the field instead. |
| Choose from a long list (7+), or type a new value | `Combobox` | Countries, time zones, product type, brand (`allowCustom`). |
| Choose from a short fixed list | native `<select>` inside `Field` | 2 to 6 choices. |
| Choose several records, or records with photos | `Picker` | Products, collections, files. Opens as a dialog. |
| Tags | `TagInput` | |
| Switch between views of one page | `Tabs` (built into `IndexTable`) | Not for navigation between pages: that is the sidebar. |
| Quick on/off filters | `.jk-chips` with `.jk-chip` buttons (`aria-pressed`) | |
| A status | `StatusBadge` | `kind` + `value` for API codes. New codes get a label in `status.ts`. |
| Something happened (saved, sent, deleted) | `useToast()` | Short, past tense: "Product saved". Offer Undo when you can. |
| Something the merchant must know or fix on this page | `Banner` | `critical` = blocked, `warning` = needs attention soon, `info`, `success`. Give it an action when there is one. |
| Nothing to show yet | `EmptyState` | Say what the page is for and offer the one next step. A filtered list with no matches gets a different message without the "add" button. |
| Loading | `TableSkeleton`, `CardSkeleton`, `SkeletonBlock` | Shape-matched placeholders. Never the word "Loading…" on its own. |
| Confirm before removing or replacing something | `ConfirmDialog` | See "Confirming". Never `window.confirm`. |
| A side drawer for a secondary form | Sheet with class `jk-sheet` | Collections, stock history. |

## Buttons

| Variant | When |
| --- | --- |
| `primary` | The one main action of a page, card form or dialog ("Save", "Add product"). |
| `secondary` (default) | Every other action. |
| `quiet` | Low-emphasis: "Clear selection", "Cancel" inside dense areas. |
| `destructive-quiet` | Starts something that removes data; it opens a confirm. |
| `destructive` | The confirm button inside that dialog. |

- Sizes: `medium` everywhere; `small` inside table rows, banners and card footers; `large` only on empty states and sign-in style pages.
- Any button that starts a request takes `loading` (and a `loadingLabel` such as "Saving…"). It then cannot be pressed twice and screen readers are told it is busy.
- Labels say what happens: "Send invoice", not "Submit". Sentence case. No full stop.

## Forms

- Label above the control. Required fields: `required` on `Field` (a red star; the page still validates).
- Help text is one short sentence in plain words, with an example where it helps ("like 499 or 499.50").
- Errors sit under the field (`error`), say what is wrong and how to fix it, and never show a code. Problems that are not about one field go in the form's banner.
- Advanced or rarely used fields go in a collapsed `<details className="jk-disclosure">`.
- After a successful save: toast. After a failed save: banner at the top of the form, nothing typed is lost.

## Lists

Every list page has, where it makes sense: search, sort, filters, paging, row select with bulk actions, a skeleton while loading, a helpful empty state and an error with "Try again" (`error` + `onRetry`).

- A list the page already holds in full (collections, reviews): `useClientList(rows, { text, sortBy, noun, searchLabel })` gives `rows`, `search`, `sort` and `pagination` to spread onto `IndexTable`. Lists that can grow large (products, orders, customers) are searched, filtered and paged by the API.
- `SelectList` shows its own search box once it has more than eight items.
- Filters are small `jk-select` dropdowns in `filters`, each starting with an "All …" choice, left out when the store has nothing to choose from, with a "Clear filters" button while any is set.
- Sorting: give columns a `sortKey` and pass `sort`. Column headings are hidden on phones, so keep a "Sort" select in `filters` when phone users need to sort.
- Bulk actions that remove or hide things open a `ConfirmDialog` that says how many items are affected.

## Confirming

The title names the thing ("Delete Linen Tote Bag?"). The description says what will happen and whether it can be undone ("The product and its photos are removed from your store. This cannot be undone." / "You can make it active again later."). The confirm button repeats the verb ("Delete product"), never "OK" or "Yes".

## Words

- Never show API codes, ids, handles or HTTP status numbers. Use `StatusBadge` / `statusLabel`; hide empty values or say "None".
- UK spelling ("colour", "organise", "fulfil").
- Say "you" and "your store". Avoid jargon; when a technical term is the one merchants search for, put it in brackets: "Stock code (SKU)".
- Same word for the same thing everywhere: Stock, Customers, Store design, Collection.

## Tokens (in `admin-kit.css`)

Pages and components never write a colour, a font size in px, or a z-index. Use:

| Group | Tokens |
| --- | --- |
| Surfaces and text | `--jk-surface`, `-subdued`, `-hover`, `-selected`, `--jk-bg`, `--jk-border`, `--jk-border-strong`, `--jk-text`, `--jk-text-subdued` |
| Actions and brand | `--jk-accent`, `--jk-accent-text`, `--jk-brand`, `--jk-brand-soft`, `--jk-brand-strong` |
| Tones | `--jk-{info,success,warning,attention,critical,neutral}-{bg,text,dot}`, `--jk-on-critical`, `--jk-positive`, `--jk-negative` |
| Space | `--jk-space-1` (4px) to `--jk-space-8` (32px) |
| Type | `--jk-text-xs` (12px) to `--jk-text-3xl` (28px); weights 400, 550, 650 |
| Shape | `--jk-radius-sm` (8px, controls), `--jk-radius` (12px, cards), `--jk-radius-lg`, `--jk-shadow`, `--jk-shadow-raised` |
| Focus | `outline: var(--jk-focus-ring)` on anything focusable that is not a native control inside `Field` |
| Motion | `--jk-motion-fast` (120ms), `--jk-motion` (180ms), `--jk-ease`; switch movement off under `prefers-reduced-motion` |
| Stacking | `--jk-z-sticky`, `--jk-z-dropdown`, `--jk-z-overlay`, `--jk-z-dialog`, `--jk-z-toast` |

Dark mode swaps the colour tokens (`html.admin-dark`); a page that uses only tokens needs no dark-mode work.

## Do and don't

| Do | Don't |
| --- | --- |
| Build from kit parts | Write new card, table, button or field styles in a page |
| Use tokens | Hard-code colours or utility colour classes (`bg-amber-50`, `text-[#333]`) |
| Use the old class names nowhere | Add `admin-card`, `form-card`, `admin-field`, `admin-button`, `.field` to new code (they are being removed) |
| Show loading, empty and error states on every page | Leave a blank page while loading or after a failed request |
| Check the page at 1440, 768 and 375px, light and dark | Rely on desktop only |
| Add an axe test for new UI | Skip accessibility because "it is the admin" |
| Keep the files LF in git (some working copies are CRLF: keep whatever the file has) | Convert line endings |

## Checklist for a new page

1. `AdminPage` with title and description; entry in `ADMIN_NAV` (`components/layout/admin-nav.tsx`) so the sidebar and page search find it.
2. Loading, empty, error (with Try again) and success states.
3. Every label in plain language; no codes (the `no-raw-codes` tests help).
4. Destructive actions confirmed; every save answers with a toast or a banner.
5. Works with the keyboard only; focus is visible; dialogs return focus.
6. 375px: no sideways scrolling; tables become cards.
7. Dark mode: readable, no hard-coded colours.
8. Tests: logic, and an axe check of the rendered page.
