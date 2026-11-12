import { notFound } from "next/navigation";

/** Any address the store has no page for: the store's 404 template (`../not-found.tsx`), with status 404. */
export default function UnmatchedStorefrontPathPage(): never {
  notFound();
}
