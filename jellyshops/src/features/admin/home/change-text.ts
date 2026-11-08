/** "Up 12% on the 7 days before", or a plain sentence when there is nothing to compare with. */
export function changeText(current: number, previous: number, previousLabel: string) {
  if (!previous) return current ? `New this period (nothing in ${previousLabel})` : `Same as ${previousLabel}`;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return `Same as ${previousLabel}`;
  return `${change > 0 ? "Up" : "Down"} ${Math.abs(change)}% on ${previousLabel}`;
}
