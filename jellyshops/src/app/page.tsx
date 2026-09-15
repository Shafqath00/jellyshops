import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  LayoutTemplate,
  PackageCheck,
  ShoppingBag,
} from "lucide-react";

const features = [
  {
    title: "Products",
    description:
      "Create a clean catalog, manage inventory, and keep products ready to sell.",
    icon: Boxes,
  },
  {
    title: "Orders",
    description:
      "See what needs attention and move every order from checkout to delivery.",
    icon: PackageCheck,
  },
  {
    title: "Store design",
    description:
      "Shape your storefront visually with a simple section-based editor.",
    icon: LayoutTemplate,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f7f7f8] text-[#202223]">
      {/* Navigation */}
      <nav
        className="border-b border-[#e5e5e5] bg-white"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="Jelly Shop home"
            className="flex items-center gap-2.5"
          >
            <span className="grid size-8 place-items-center rounded-[9px] bg-jelly-guava text-sm font-black text-jelly-ink">
              J
            </span>

            <span className="text-[14px] font-semibold tracking-[-0.02em]">
              Jelly Shop
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[11px] font-medium text-[#6d7175] sm:inline-flex">
              <span className="size-1.5 rounded-full bg-[#29845a]" />
              Local demo
            </span>

            <Link
              href="/admin"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#303030] px-3.5 text-[12px] font-semibold text-white transition hover:bg-[#1f1f1f]"
            >
              Open admin
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1200px] gap-12 px-5 pb-20 pt-16 sm:px-6 sm:pt-20 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-16 lg:px-8 lg:pb-28 lg:pt-24">
        <div>
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.09em] text-[#8c9196]">
            Commerce for small shops
          </p>

          <h1 className="max-w-[620px] text-[clamp(3rem,6vw,5.6rem)] font-semibold leading-[0.94] tracking-[-0.065em] text-[#202223]">
            Build your store.
            <br />
            Sell beautifully.
          </h1>

          <p className="mt-6 max-w-[540px] text-[16px] leading-7 text-[#616161] sm:text-[17px]">
            A simple storefront and merchant workspace for
            products, orders, customers, and store design—all in
            one place.
          </p>

          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
            <Link
              href="/admin"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-jelly-ink px-4 text-[13px] font-semibold text-jelly-paper shadow-jelly-guava transition hover:bg-jelly-ink-soft"
            >
              Open merchant studio
              <ArrowUpRight size={15} />
            </Link>

            <Link
              href="/sweet-bakes"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#c9cccf] bg-white px-4 text-[13px] font-semibold text-[#303030] transition hover:bg-[#f3f3f3]"
            >
              <ShoppingBag size={15} />
              View demo store
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-medium text-[#8c9196]">
            <span>No setup required</span>
            <span className="hidden sm:inline">•</span>
            <span>Local demo data</span>
            <span className="hidden sm:inline">•</span>
            <span>Built for first-time sellers</span>
          </div>
        </div>

        {/* Storefront preview */}
        <div className="relative">
          <div className="overflow-hidden rounded-2xl border border-[#dedede] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.09)]">
            {/* Browser bar */}
            <div className="flex h-11 items-center gap-2 border-b border-[#eeeeee] bg-[#fafafa] px-4">
              <div className="flex gap-1.5">
                <span className="size-2 rounded-full bg-[#d8d8d8]" />
                <span className="size-2 rounded-full bg-[#d8d8d8]" />
                <span className="size-2 rounded-full bg-[#d8d8d8]" />
              </div>

              <div className="ml-2 truncate text-[10px] font-medium text-[#8c9196]">
                sweetbakes.jelly.shop
              </div>
            </div>

            {/* Demo storefront */}
            <div className="bg-[#fffdfa]">
              <div className="flex h-14 items-center justify-between border-b border-black/[0.06] px-5 sm:px-7">
                <span className="font-serif text-[16px] italic text-[#2f2b28]">
                  Sweet Bakes
                </span>

                <div className="flex items-center gap-4 text-[10px] font-medium text-[#66615d]">
                  <span>Shop</span>
                  <span>About</span>
                  <span className="hidden sm:inline">Cart (0)</span>
                </div>
              </div>

              <div className="grid min-h-[420px] lg:grid-cols-[1fr_0.9fr]">
                <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9a8f86]">
                    Baked fresh daily
                  </p>

                  <h2 className="mt-4 max-w-[380px] font-serif text-[clamp(2.5rem,5vw,4.3rem)] leading-[0.98] tracking-[-0.045em] text-[#2b2724]">
                    A softer kind of celebration.
                  </h2>

                  <p className="mt-5 max-w-[340px] text-[12px] leading-5 text-[#766f69]">
                    Small-batch cakes and pastries made for
                    thoughtful moments.
                  </p>

                  <Link
                    href="/sweet-bakes"
                    className="mt-6 inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold text-[#2f2b28]"
                  >
                    Shop collection
                    <ArrowRight size={12} />
                  </Link>
                </div>

                <div className="grid min-h-[310px] grid-cols-2 gap-3 bg-[#f5eee8] p-5 sm:p-7 lg:min-h-[420px] lg:grid-cols-1">
                  <div className="flex flex-col justify-end rounded-[140px_140px_20px_20px] bg-[#f3c2ca] p-5">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#715d61]">
                      Fresh
                    </span>

                    <span className="mt-1 font-serif text-[18px] text-[#302729]">
                      Berry Cloud
                    </span>
                  </div>

                  <div className="flex flex-col justify-end rounded-[140px_140px_20px_20px] bg-[#f4df93] p-5">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#73683e]">
                      Classic
                    </span>

                    <span className="mt-1 font-serif text-[18px] text-[#302d21]">
                      Lemon Joy
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-4 left-6 rounded-lg border border-[#e1e1e1] bg-white px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#29845a]" />

              <div>
                <p className="text-[10px] font-semibold text-[#303030]">
                  Store live
                </p>

                <p className="mt-0.5 text-[9px] text-[#8c9196]">
                  Ready for customers
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature section */}
      <section className="border-y border-[#e5e5e5] bg-white">
        <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-[620px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#8c9196]">
              One workspace
            </p>

            <h2 className="mt-3 text-[32px] font-semibold tracking-[-0.04em] text-[#202223] sm:text-[40px]">
              Everything you need to start selling.
            </h2>

            <p className="mt-3 text-[14px] leading-6 text-[#6d7175]">
              Keep the day-to-day simple while giving customers a
              storefront that feels considered.
            </p>
          </div>

          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-[#e3e3e3] bg-[#e3e3e3] md:grid-cols-3">
            {features.map(({ title, description, icon: Icon }) => (
              <article
                key={title}
                className="bg-white p-6 sm:p-7"
              >
                <span className="grid size-9 place-items-center rounded-lg bg-[#f1f1f1] text-[#616161]">
                  <Icon size={17} strokeWidth={1.7} />
                </span>

                <h3 className="mt-5 text-[14px] font-semibold text-[#303030]">
                  {title}
                </h3>

                <p className="mt-2 text-[12px] leading-5 text-[#6d7175]">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-[1200px] px-5 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="flex flex-col gap-7 rounded-2xl border border-[#e3e3e3] bg-white p-7 sm:p-9 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[24px] font-semibold tracking-[-0.035em] text-[#202223]">
              Ready to explore Jelly Shop?
            </h2>

            <p className="mt-2 max-w-[540px] text-[13px] leading-5 text-[#6d7175]">
              Open the merchant workspace and see the complete
              product, order, and storefront design flow.
            </p>
          </div>

          <Link
            href="/admin"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#303030] px-4 text-[12px] font-semibold text-white transition hover:bg-[#1f1f1f]"
          >
            Continue to merchant studio
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e5e5e5] bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-5 py-6 text-[11px] text-[#8c9196] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-jelly-guava text-[10px] font-black text-jelly-ink">
              J
            </span>

            <span className="font-semibold text-[#454f5b]">
              Jelly Shop
            </span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <span>Local demo</span>
            <span>Mock data</span>
            <span>No setup required</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
