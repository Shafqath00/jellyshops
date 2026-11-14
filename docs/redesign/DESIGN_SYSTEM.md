# Jelly Shop design system

The Jelly Shop admin is a sibling of Jelly Links: warm neutrals, pills, generous corners, soft watercolour washes. Jelly Shop has its own accent: **Jelly blue for actions, lime as the family highlight**.

All of it lives in code:

| What | Where |
| --- | --- |
| Tokens (light and dark) | `jellyshops/src/app/admin/admin-kit.css`, top of the file (`html.admin-ui`, `html.admin-ui.admin-dark`) |
| Kit components (CSS) | same file, then the "Jelly identity layer" at the end |
| Kit components (React) | `jellyshops/src/components/admin/` (exported from `index.ts`) |
| Frame: sidebar, header, canvas, drawer | `jellyshops/src/components/layout/app-shell.tsx`, `admin-shell.css` |
| Live demo of every part | `/admin/design-kit` (not in the menu) |
| Usage rules (one primary action, plain words…) | `docs/admin-design-guide.md` |

Rule: page code never writes a colour, radius or shadow value. Use a token or a kit component. Dark mode only swaps tokens.

## Colour

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--jk-page` | `#F3F2EC` stone | `#0F0F0E` | Window background, sidebar |
| `--jk-bg` | `#FAFAF7` | `#161614` | Rounded canvas, header row |
| `--jk-surface` | `#FFFFFF` | `#1E1E1B` | Cards, tables, dialogs |
| `--jk-surface-subdued` / `-hover` / `-selected` | `#F7F6F1` / `#F2F0EA` / `#EEF2FF` | … | Table headings, hover rows, selected rows |
| `--jk-border` / `-strong` | `#E6E3DA` / `#D3CFC4` | `#34332E` / `#46443D` | Card edges, dividers |
| `--jk-control-border` | `#8F8A7E` | `#7A766C` | Inputs, selects, search: 3:1 against white so fields are visible (WCAG 1.4.11) |
| `--jk-text` / `-subdued` | `#0A0A0A` / `#6B675F` | `#F3F2EC` / `#ACA89D` | Body / secondary text (5.6:1 on white, 5.0:1 on stone) |
| `--jk-accent` (+`-hover`, `-text`) | Jelly blue `#2F5BFF` on white text (4.9:1) | `#8EA6FF` with ink text | Primary buttons, links, focus, chart bars |
| `--jk-lime` / `--jk-brand` | `#C9FF18` with ink text | same | Brand mark, active nav icon, progress, save button on the ink save bar, welcome-card main button |
| `--jk-ink` | `#0A0A0A` | – | Active tabs/chips, save bar, toasts, tooltips, welcome card |
| Tones `--jk-{info,success,warning,attention,critical,neutral}-{bg,text,dot}` | pale fill + dark text, all ≥ 4.5:1 | dark fill + pale text | Status badges and banners |
| Icon tile tones `--jk-tone-{lime,blue,pink,peach,violet,mint}-{bg,fg}` | soft fill + coloured glyph | – | Sidebar groups, settings tiles, empty states |
| Washes `--jk-wash-{lime,blue,pink,peach}` | soft pastels | muted | Watercolour corners on stat tiles; welcome card glow |

**Watercolour rule:** washes sit only in a corner of a summary tile or the welcome card, blurred and behind content (`z-index:-1`), never under paragraphs or form fields. Text keeps its normal contrast.

## Typography

Inter (self-hosted through `next/font`, no new dependency).

| Role | Size / weight / tracking |
| --- | --- |
| Welcome title | 28–40px (clamp), 720, −0.035em |
| Page title (`h1`) | 24px, 680, −0.02em |
| Card / section title | 15–16px, 650–680, −0.01em |
| Body | 14px, 400 (tables 13px) |
| Secondary | 13px, `--jk-text-subdued` |
| Labels, eyebrows, table headings | 11px, 600, uppercase, +0.08em, often with a dot (`● SELL`) |
| Figures | 30px, 700, −0.03em, tabular numbers |

## Shape, depth, spacing

- Radius: `--jk-radius-sm` 10px (small boxes), inputs 12px, `--jk-radius` 16px (cards), `--jk-radius-lg` 24px (canvas, welcome card), dialogs 20px, `--jk-radius-pill` for buttons, chips, tabs, search and the save bar.
- Shadow: `--jk-shadow` = 1px warm border ring + inner top highlight + 1px drop; `--jk-shadow-raised` for menus, dialogs, hovered tiles.
- Spacing: 4px grid, `--jk-space-1` … `--jk-space-10`. Page sections 20px apart; card padding 16px (20px from 1024px).
- Motion: `--jk-motion-fast` 120ms, `--jk-motion` 180ms, `--jk-ease`. Everything turns off under `prefers-reduced-motion`.

## Layout and breakpoints

| Width | Frame |
| --- | --- |
| ≥ 1280px | Sidebar 248px on stone + canvas inset 8px with 24px corners; content max 1200px, 32px padding; header labels visible ("View store") |
| 1024–1279px | Same, header shows icons only |
| 768–1023px (tablet) | Canvas fills the screen; menu button opens the sidebar as a drawer; content padding 24px; detail pages stack to one column below 1024px |
| < 768px (phone) | Tables turn into cards (label: value rows); stat tiles two per row; content padding 16px |
| < 480px | Header keeps menu, mark, search, theme, account ("View store" moves into the account menu) |

## Components

| Part | Look |
| --- | --- |
| Sidebar | Logo top left; dotted uppercase section labels; each group has a tinted icon tile; active group = white pill with ink tile + lime glyph; sub-pages indented under a line, active one marked by an ink bar; store card pinned at the foot |
| Header row | Inside the canvas, translucent with blur, sticky; pill search with Ctrl K hint; theme toggle; View store; account pill with an ink avatar |
| Welcome card (`AdminPage hero`) | Ink card, dotted texture, blue/lime glow top right, date eyebrow, large greeting, lime main button, ghost pills |
| Page header | Title + badges + one-line description; actions right: More actions, secondary, one primary |
| Buttons | Pills, 36px; primary blue; secondary white with border ring; quiet = text only; destructive red; loading shows a spinner and keeps width |
| Tabs, chips, segmented choices | Pills; selected = ink with white text |
| Index table | One card: pill tabs, pill search + filters, uppercase column headings on a pale strip, 12px row padding, row hover, selected rows blue-tinted, bulk bar replaces the toolbar, pager at the foot; cards on phones |
| Fields | Label above, 40px input with 12px corners, focus = 2px blue ring + soft halo, error text under the field, required star |
| Save bar | Floating ink pill at the bottom; Discard ghost, Save in lime |
| Stat tiles | White tile, coloured glossy icon tile (lime, blue, pink, peach in order), watercolour wash in the corner, big figure, change line with arrow |
| Setup guide | Card with lime progress bar, open step on a pale panel |
| Dialogs, sheets | 20px corners, blurred dim backdrop, title row, footer on a pale strip |
| Toasts, tooltips | Ink pills / ink bubbles |
| Badges | Pills with a dot, tone colours |
| Empty states | Lime icon tile, title, one line, first action |
| Skeletons | Warm shimmer, off with reduced motion |

## States

- **Hover:** surface → `--jk-surface-hover`; tiles lift 1px with the raised shadow.
- **Focus:** always visible: 2px `--jk-focus` outline (fields use an inset ring + halo). Inside the welcome card the ring is lime.
- **Active / selected:** ink pill (tabs, chips, active nav), blue tint (selected rows, bulk bar).
- **Disabled:** 55% opacity, not-allowed cursor.
- **Loading:** skeletons in place of the content; buttons show a spinner.
- **Empty:** `EmptyState`. **Error:** critical `Banner` with "Try again". **Success:** toast, or a success banner for lasting states.
</content>
</invoke>
