"use client";

import Link from "next/link";
import { ExternalLink, RotateCcw } from "lucide-react";
import { useShop } from "@/contexts/shop-context";
import { AdminNav } from "./admin-nav";

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state, resetDemo } = useShop();

  const store =
    state.stores.find((item) => item.id === state.activeStoreId) ??
    state.stores[0];

  if (!store) {
    return null;
  }

  const storeInitial = store.name.slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-[#202223] md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen min-h-0 flex-col border-r border-[#dedede] bg-[#ebebeb] md:flex">
        {/* Brand */}
        <div className="px-3 pb-2 pt-3">
          <Link
            href="/"
            className="group flex h-10 items-center gap-2.5 rounded-lg px-2 transition-colors hover:bg-black/[0.04]"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-jelly-guava text-sm font-black text-jelly-ink shadow-[0_1px_1px_rgba(0,0,0,0.08)]">
              J
            </span>

            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold leading-none tracking-[-0.01em]">
                Jelly Shop
              </div>

              <div className="mt-1 text-[10px] font-medium text-[#6d7175]">
                Commerce admin
              </div>
            </div>
          </Link>
        </div>

        {/* Store */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2.5 rounded-[10px] border border-[#d8d8d8] bg-[#f7f7f7] p-2.5 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-[13px] font-bold text-[#303030] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
              {storeInitial}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-4 text-[#303030]">
                {store.name}
              </p>

              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={`size-1.5 rounded-full ${
                    store.published ? "bg-[#29845a]" : "bg-[#8c9196]"
                  }`}
                />

                <span
                  className={`text-[11px] font-medium ${
                    store.published ? "text-[#29845a]" : "text-[#6d7175]"
                  }`}
                >
                  {store.published ? "Live" : "Draft"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-1">
          <AdminNav />
        </div>

        {/* Sidebar footer */}
        <div className="border-t border-[#d7d7d7] p-2">
          <Link
            href={`/${store.slug}`}
            className="group flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-[12px] font-medium text-[#4a4a4a] transition-colors hover:bg-black/[0.05] hover:text-[#202223]"
          >
            <ExternalLink
              size={15}
              strokeWidth={1.8}
              className="text-[#6d7175]"
            />

            <span>View storefront</span>
          </Link>

          <button
            type="button"
            onClick={resetDemo}
            className="group flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[12px] font-medium text-[#4a4a4a] transition-colors hover:bg-black/[0.05] hover:text-[#202223]"
          >
            <RotateCcw
              size={15}
              strokeWidth={1.8}
              className="text-[#6d7175]"
            />

            <span>Reset demo data</span>
          </button>
        </div>
      </aside>

      {/* Application */}
      <div className="min-w-0">
        {/* Desktop top bar */}
        <header className="sticky top-0 z-30 hidden h-14 items-center justify-between border-b border-[#e3e3e3] bg-white/95 px-6 backdrop-blur-md md:flex">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-[#303030]">
                {store.name}
              </p>
            </div>

            <div className="h-4 w-px bg-[#dedede]" />

            <div className="flex items-center gap-1.5">
              <span
                className={`size-1.5 rounded-full ${
                  store.published ? "bg-[#29845a]" : "bg-[#8c9196]"
                }`}
              />

              <span className="text-[11px] font-medium text-[#6d7175]">
                {store.published ? "Online store live" : "Store draft"}
              </span>
            </div>
          </div>

          <Link
            href={`/${store.slug}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#c9cccf] bg-white px-3 text-[12px] font-semibold text-[#303030] shadow-[0_1px_0_rgba(0,0,0,0.04)] transition hover:bg-[#f6f6f7]"
          >
            View store
            <ExternalLink size={13} strokeWidth={1.8} />
          </Link>
        </header>

        {/* Mobile header */}
        <header className="sticky top-0 z-40 flex h-[58px] items-center justify-between border-b border-[#e3e3e3] bg-white/95 px-4 backdrop-blur-md md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-[9px] bg-jelly-guava text-sm font-black text-jelly-ink">
              J
            </span>

            <div className="leading-none">
              <p className="text-[13px] font-bold tracking-[-0.01em]">
                Jelly Shop
              </p>

              <p className="mt-1 max-w-[130px] truncate text-[10px] font-medium text-[#6d7175]">
                {store.name}
              </p>
            </div>
          </Link>

          <Link
            href={`/${store.slug}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#c9cccf] bg-white px-2.5 text-[11px] font-semibold text-[#303030]"
          >
            View store
            <ExternalLink size={12} />
          </Link>
        </header>

        {/* Mobile navigation */}
        <div className="border-b border-[#e3e3e3] bg-white md:hidden">
          <AdminNav />
        </div>

        {/* Page content */}
        <main className="min-w-0">
          <div className="mx-auto w-full max-w-[1600px] px-4 pb-20 pt-6 sm:px-6 md:px-8 md:pb-12 md:pt-8 lg:px-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}