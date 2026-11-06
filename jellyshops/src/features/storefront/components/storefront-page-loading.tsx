/**
 * What a storefront page shows while the store's own design and the shopper's saved bag load, instead of the
 * built-in fallback page (which would briefly show an empty bag or a £0.00 price before the real page).
 */
export function StorefrontPageLoading({ label }: { label: string }) {
  return <main className="flex min-h-[60vh] items-center justify-center" aria-busy="true">
    <p role="status" className="text-sm opacity-70">{label}</p>
  </main>;
}
