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
