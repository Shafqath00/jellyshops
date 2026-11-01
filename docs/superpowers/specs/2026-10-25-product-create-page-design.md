# Product creation page design

## Intent

Make adding a product feel clear and manageable for a small-store seller. Keep the single-page flow, make the essential tasks easy to scan, and keep optional details available without competing for attention.

## Goals and boundaries

- Keep the existing product data, gallery, options, variant, validation, and save behavior.
- Give the page a clear hierarchy: product name and photos first, selling details next, optional information when needed.
- Keep the shopper preview available without letting it dominate the editing surface.
- Work at mobile and desktop sizes, with visible keyboard focus and reduced-motion support.
- Do not change catalog APIs, the legacy product form, or rollout flags as part of this visual redesign.

## Approaches

1. **One-page essentials with optional details tucked away — selected.** Keep the current capabilities and order, but group the main decisions into a calm, narrow editing column; make description, original price, SKU, and other secondary details expandable; and make preview a deliberate side panel on wide screens that moves below the form on small screens. This best matches the request for a simpler page without turning ordinary product creation into a multi-step process.
2. **Dense two-column form with a persistent preview.** This makes the preview easy to compare while editing, but keeps every control visible and leaves the page feeling busy.
3. **Minimal quick-create with most settings hidden.** This is visually spare, but hides choices, variants, and gallery tools that are central to the product workflow.

## Visual direction

Use a tidy seller workbench grounded in Jelly Shop's existing ink, paper, citrus, and line colors: ink `#14213d`, paper `#fffdf8`, soft paper `#f7f4ed`, citrus `#ffd85a`, and line `#dcd8ce`. Keep Aptos/Segoe as the working text face and use the existing rounded display face sparingly for the page title. Use compact, clear labels; larger section titles; generous spacing around essential actions; and consistent 12–16px control radii. The photo section gets the signature treatment: a clear cover tile and quiet thumbnail rail that makes the gallery order immediately understandable.

## Layout and interaction

The page begins with a compact header that names the task and gives a direct route back to products. The form uses a primary column for the product name, photos, category, choices, and price; the live shopper preview is visually quieter and collapses below the form on narrow screens. The save action remains easy to reach in a restrained sticky footer. Optional description, compare-at price, SKU, and other infrequent fields sit behind plain-language expanders. Category loading errors use a clear, recoverable message and do not obscure the rest of the form.

## Calls left to implementation

Choose exact spacing, border, and responsive breakpoints in the existing Tailwind system. Keep interaction and data semantics accessible; do not add decorative steps or labels that imply a required sequence.
