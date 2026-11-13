import type { CSSProperties } from "react";

/**
 * Columns for a short, curated row of cards (featured products, related, recently viewed): the row never ends with
 * empty slots or a lone card. Fewer cards than columns: one column per card (at least two, so a single card stays
 * card-sized). A few more than one row: the rows are balanced (5 in 4 columns = 3 + 2, 6 = 3 + 3). Longer lists keep
 * the chosen columns. Paged lists (collection, search) keep their columns so the page does not change shape.
 */
export function balancedColumns(count: number, columns: number): number {
  if (!Number.isInteger(count) || count <= 0 || count > columns * 2) return columns;
  const rows = Math.ceil(count / columns);
  return Math.min(columns, Math.max(Math.ceil(count / rows), Math.min(2, columns)));
}

/**
 * The column variables for a curated row: desktop columns, and tablet columns balanced the same way within the
 * tablet's three (storefront-base.css "Balanced rows on tablets" reads --jelly-columns-tablet), so 4 cards are 2 + 2
 * on a tablet rather than 3 + 1.
 */
/** The props for a curated row of cards: its column variables, and `data-short-row` when it has fewer cards than columns. */
export function rowColumnProps(count: number, columns: number): { style: CSSProperties; "data-count": number; "data-short-row"?: "" } {
  return { style: rowColumnStyle(count, columns), "data-count": count, ...(count > 0 && count < columns ? { "data-short-row": "" as const } : {}) };
}

export function rowColumnStyle(count: number, columns: number): CSSProperties {
  const tablet = Math.min(columns, 3);
  return {
    "--jelly-columns": balancedColumns(count, columns),
    "--jelly-columns-tablet": balancedColumns(count, tablet),
    // Fewer cards than columns: each card keeps the width it would have in the full row (storefront-base.css "Short
    // rows"), so two related products are not drawn half the page wide each.
    ...(count > 0 && count < columns ? { "--jelly-row-slots": columns } : {}),
    ...(count > 0 && count < tablet ? { "--jelly-row-slots-tablet": tablet } : {}),
  } as CSSProperties;
}
