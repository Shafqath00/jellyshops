import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  LayoutTemplate,
  PackageCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

const features = [
  {
    title: "Products",
    description:
      "Create a polished catalog, organize inventory, and keep every product ready to sell.",
    icon: Boxes,
    accent: "bg-[#ffd4dc] text-[#7a3243]",
  },
  {
    title: "Orders",
    description:
      "See what needs attention and move every order smoothly from checkout to delivery.",
    icon: PackageCheck,
    accent: "bg-[#e3efb2] text-[#485526]",
  },
  {
    title: "Store design",
    description:
      "Shape your storefront with flexible sections and a visual editor that stays simple.",
    icon: LayoutTemplate,
    accent: "bg-[#dcd7ff] text-[#4d4584]",
  },
];

const benefits = [
  "Simple product management",
  "A storefront that feels like your brand",
  "Orders and design in one workspace",
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fffaf4] text-[#241f20] selection:bg-[#ff8da4] selection:text-[#241f20]">
      {/* Navigation */}
      <nav
        className="sticky top-0 z-50 border-b border-black/[0.06] bg-[#fffaf4]/90 backdrop-blur-xl"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="Jelly Shop home"
            className="group flex items-center gap-3"
          >
            <span className="grid size-9 place-items-center rounded-[12px] bg-[#ff8da4] text-sm font-black text-[#241f20] shadow-[inset_0_-2px_0_rgba(36,31,32,0.12)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
              J
            </span>

            <span className="text-[15px] font-bold tracking-[-0.035em]">
              Jelly Shop
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-black/[0.07] bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-[#6b6264] sm:inline-flex">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#63b87c] opacity-50" />
                <span className="relative inline-flex size-2 rounded-full bg-[#39975b]" />
              </span>
              Store online
            </span>

            <Link
              href="/admin"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#241f20] px-4 text-[12px] font-bold text-white shadow-[0_8px_24px_rgba(36,31,32,0.16)] transition hover:-translate-y-0.5 hover:bg-[#3a3234]"
            >
              Open studio
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative">
        <div className="pointer-events-none absolute -left-24 top-20 size-72 rounded-full bg-[#ffd8df]/70 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-6 size-[420px] rounded-full bg-[#e9f0b7]/60 blur-3xl" />

        <div className="relative mx-auto grid max-w-[1240px] gap-14 px-5 pb-24 pt-16 sm:px-6 sm:pt-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-16 lg:px-8 lg:pb-28 lg:pt-24">
          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e5c7cd] bg-[#fff1f4] px-3 py-1.5 text-[11px] font-bold text-[#7b4551] shadow-sm">
              <Sparkles size={13} />
              Commerce made delightfully simple
            </div>

            <h1 className="max-w-[650px] text-[clamp(3.45rem,7vw,6.5rem)] font-black leading-[0.87] tracking-[-0.075em] text-[#241f20]">
              Your shop,
              <br />
              <span className="relative inline-block text-[#e86f8c]">
                beautifully
                <svg
                  aria-hidden="true"
                  className="absolute -bottom-3 left-0 h-4 w-full text-[#e6dd7b]"
                  viewBox="0 0 300 20"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M4 13C74 2 205 3 296 9"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="9"
                  />
                </svg>
              </span>
              <br />
              yours.
            </h1>

            <p className="mt-8 max-w-[560px] text-[16px] leading-7 text-[#6f6466] sm:text-[18px] sm:leading-8">
              Build a storefront customers love and run products, orders,
              customers, and design from one calm merchant workspace.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/admin"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#241f20] px-5 text-[13px] font-bold text-white shadow-[0_12px_30px_rgba(36,31,32,0.18)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#3a3234]"
              >
                Open merchant studio
                <ArrowUpRight size={15} />
              </Link>

              <Link
                href="/sweet-bakes"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-black/[0.09] bg-white/80 px-5 text-[13px] font-bold text-[#3f3739] shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-white"
              >
                <ShoppingBag size={15} />
                Visit storefront
              </Link>
            </div>

            <div className="mt-9 grid max-w-[500px] gap-3 text-[12px] font-semibold text-[#74696b] sm:grid-cols-2">
              {benefits.map((benefit) => (
                <span key={benefit} className="flex items-center gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#e6efbd] text-[#49562a]">
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                  {benefit}
                </span>
              ))}
            </div>
          </div>

          {/* Storefront preview */}
          <div className="relative mx-auto w-full max-w-[690px] lg:mx-0">
            <div className="absolute -left-6 -top-7 hidden rotate-[-8deg] rounded-2xl border border-black/[0.06] bg-[#e4edaa] px-4 py-3 shadow-[0_14px_40px_rgba(36,31,32,0.10)] sm:block">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#52602f]">
                Made for small shops
              </p>
            </div>

            <div className="absolute -right-3 top-20 size-16 rotate-12 rounded-[22px] bg-[#dcd6ff] shadow-[0_14px_40px_rgba(36,31,32,0.08)] sm:-right-8 sm:size-20" />

            <div className="relative overflow-hidden rounded-[30px] border border-black/[0.08] bg-white p-2.5 shadow-[0_34px_90px_rgba(75,55,60,0.16)]">
              <div className="overflow-hidden rounded-[22px] border border-black/[0.06] bg-[#fffdf9]">
                {/* Browser bar */}
                <div className="flex h-11 items-center gap-2 border-b border-black/[0.05] bg-[#fbf8f5] px-4">
                  <div className="flex gap-1.5">
                    <span className="size-2 rounded-full bg-[#ff9caf]" />
                    <span className="size-2 rounded-full bg-[#efd873]" />
                    <span className="size-2 rounded-full bg-[#9dcc99]" />
                  </div>

                  <div className="ml-2 flex h-6 flex-1 items-center rounded-full bg-white px-3 text-[9px] font-semibold text-[#9b9092] shadow-[inset_0_0_0_1px_rgba(36,31,32,0.05)]">
                    sweetbakes.jelly.shop
                  </div>
                </div>

                {/* Storefront */}
                <div className="bg-[#fffaf5]">
                  <div className="flex h-16 items-center justify-between border-b border-black/[0.06] px-5 sm:px-7">
                    <span className="font-serif text-[18px] italic text-[#31282a]">
                      Sweet Bakes
                    </span>

                    <div className="flex items-center gap-4 text-[10px] font-bold text-[#766b6d] sm:gap-5">
                      <span>Shop</span>
                      <span>About</span>
                      <span className="hidden sm:inline">Cart (0)</span>
                    </div>
                  </div>

                  <div className="grid min-h-[450px] lg:grid-cols-[1.03fr_0.97fr]">
                    <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-11">
                      <div className="mb-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#f8e9eb] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#a16270]">
                        Fresh from the oven
                      </div>

                      <h2 className="max-w-[380px] font-serif text-[clamp(2.8rem,5vw,4.6rem)] leading-[0.92] tracking-[-0.05em] text-[#302729]">
                        Little joys,
                        <br />
                        baked daily.
                      </h2>

                      <p className="mt-5 max-w-[330px] text-[12px] leading-5 text-[#786d6f]">
                        Small-batch cakes and pastries made with good butter,
                        bright fruit, and plenty of care.
                      </p>

                      <Link
                        href="/sweet-bakes"
                        className="mt-7 inline-flex w-fit items-center gap-2 border-b border-[#302729] pb-1 text-[11px] font-black text-[#302729] transition hover:gap-3"
                      >
                        Shop collection
                        <ArrowRight size={12} />
                      </Link>
                    </div>

                    <div className="grid min-h-[330px] grid-cols-2 gap-3 bg-[#f7eee7] p-4 sm:p-5 lg:min-h-[450px] lg:grid-cols-1">
                      <div className="relative flex min-h-[155px] flex-col justify-end overflow-hidden rounded-[140px_140px_24px_24px] bg-[#f4bdc9] p-5">
                        <span className="absolute right-5 top-5 size-8 rounded-full bg-white/35" />
                        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#7a4b55]">
                          Berry
                        </span>
                        <span className="mt-1 font-serif text-[20px] text-[#3e2d31]">
                          Cloud Cake
                        </span>
                        <span className="mt-1 text-[10px] font-semibold text-[#865b64]">
                          $32
                        </span>
                      </div>

                      <div className="relative flex min-h-[155px] flex-col justify-end overflow-hidden rounded-[140px_140px_24px_24px] bg-[#f0df8d] p-5">
                        <span className="absolute right-5 top-5 size-8 rounded-full bg-white/30" />
                        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#716538]">
                          Citrus
                        </span>
                        <span className="mt-1 font-serif text-[20px] text-[#3f3a21]">
                          Lemon Joy
                        </span>
                        <span className="mt-1 text-[10px] font-semibold text-[#756a3c]">
                          $28
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-5 left-5 flex items-center gap-3 rounded-2xl border border-black/[0.07] bg-white px-4 py-3 shadow-[0_14px_45px_rgba(58,44,48,0.14)] sm:left-8">
              <span className="grid size-9 place-items-center rounded-xl bg-[#e3efb2] text-[#485526]">
                <ShoppingBag size={16} />
              </span>
              <div>
                <p className="text-[11px] font-black text-[#332c2e]">
                  Store is live
                </p>
                <p className="mt-0.5 text-[9px] font-medium text-[#95898b]">
                  Ready for your next order
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature section */}
      <section className="relative border-y border-black/[0.06] bg-[#241f20] text-white">
        <div className="pointer-events-none absolute right-0 top-0 size-72 rounded-full bg-[#5d4c50]/50 blur-3xl" />
        <div className="relative mx-auto max-w-[1240px] px-5 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#ff9eb2]">
                One workspace
              </p>
              <h2 className="mt-4 max-w-[560px] text-[38px] font-black leading-[0.98] tracking-[-0.055em] sm:text-[52px]">
                Everything your shop needs. Nothing it doesn’t.
              </h2>
            </div>

            <p className="max-w-[540px] text-[14px] leading-7 text-[#c8bec0] lg:justify-self-end lg:text-[15px]">
              Keep the day-to-day easy while giving customers a storefront
              that feels thoughtful, personal, and unmistakably yours.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {features.map(({ title, description, icon: Icon, accent }, index) => (
              <article
                key={title}
                className="group rounded-[24px] border border-white/10 bg-white/[0.055] p-6 backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:bg-white/[0.08] sm:p-7"
              >
                <div className="flex items-start justify-between">
                  <span className={`grid size-11 place-items-center rounded-2xl ${accent}`}>
                    <Icon size={19} strokeWidth={1.8} />
                  </span>
                  <span className="text-[11px] font-black text-white/25">
                    0{index + 1}
                  </span>
                </div>

                <h3 className="mt-7 text-[18px] font-bold tracking-[-0.025em] text-white">
                  {title}
                </h3>

                <p className="mt-3 text-[13px] leading-6 text-[#bdb2b4]">
                  {description}
                </p>

                <span className="mt-7 inline-flex items-center gap-2 text-[11px] font-bold text-white/80 transition group-hover:gap-3">
                  Built into Jelly Shop
                  <ArrowRight size={12} />
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative mx-auto max-w-[1240px] px-5 py-20 sm:px-6 lg:px-8 lg:py-24">
        <div className="relative overflow-hidden rounded-[32px] border border-black/[0.07] bg-[#ff8da4] px-7 py-10 shadow-[0_24px_70px_rgba(133,72,85,0.16)] sm:px-10 sm:py-12 lg:px-14 lg:py-14">
          <div className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full border-[28px] border-white/20" />
          <div className="pointer-events-none absolute bottom-[-70px] right-32 size-40 rounded-full bg-[#e9efae]/75 blur-[2px]" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#6f3542]">
                Ready when you are
              </p>
              <h2 className="mt-3 max-w-[650px] text-[34px] font-black leading-[1] tracking-[-0.055em] text-[#2b2224] sm:text-[48px]">
                Make your shop feel like your shop.
              </h2>
              <p className="mt-4 max-w-[560px] text-[14px] leading-6 text-[#6e3d48]">
                Set up products, manage orders, and shape your storefront from
                one focused merchant studio.
              </p>
            </div>

            <Link
              href="/admin"
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-[#241f20] px-5 text-[13px] font-bold text-white shadow-[0_12px_28px_rgba(36,31,32,0.2)] transition hover:-translate-y-0.5 hover:bg-[#3a3234] lg:self-auto"
            >
              Go to merchant studio
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/[0.06] bg-[#fffaf4]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-5 py-7 text-[11px] text-[#8b7f81] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-[#ff8da4] text-[10px] font-black text-[#241f20]">
              J
            </span>
            <span className="font-bold text-[#493f41]">Jelly Shop</span>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 font-semibold">
            <span>Products</span>
            <span>Orders</span>
            <span>Store design</span>
            <span>Built for independent sellers</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
