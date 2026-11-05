import { isStoreIconName, type StoreIconName } from "@jelly/storefront-schema";

/** Line drawings on a 24px grid, drawn with the text colour. */
const paths: Record<StoreIconName, string> = {
  check: "m5 12.5 4.5 4.5L19 7.5",
  truck: "M3 6h11v10H3zM14 9h4l3 3v4h-7M7.5 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  shield: "M12 3 5 6v5c0 4.5 3 8.4 7 10 4-1.6 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z",
  home: "M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  percent: "M19 5 5 19M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9L12 3Z",
  phone: "M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z",
  leaf: "M5 19C5 10 10 5 20 4c-1 10-6 15-15 15ZM5 19l7-7",
  gift: "M4 9h16v4H4zM5 13h14v8H5zM12 9v12M12 9S10.5 4 8 4.5 7.5 9 12 9ZM12 9s1.5-5 4-4.5S16.5 9 12 9Z",
  return: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  palette: "M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.6 0-1.4-1-1.9-1-3 0-1 .8-1.9 1.9-1.9H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3ZM7.5 11.5h.01M10 7.5h.01M15 7.5h.01",
  tag: "M3 12V4h8l10 10-8 8L3 12ZM7.5 8.5h.01",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
};

/** One of the store icons; unknown names draw the tick. Decorative: the text next to it carries the meaning. */
export function StoreIcon({ name, size = 20 }: { name: unknown; size?: number }) {
  const icon: StoreIconName = isStoreIconName(name) ? name : "check";
  return <svg className="jelly-icon" data-icon={icon} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[icon]} /></svg>;
}
