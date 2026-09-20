"use client";

import Link from "next/link";
import {
  ChevronDown,
  ExternalLink,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { AdminNav } from "./admin-nav";

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeStore: store, stores, setActiveStoreId } = useAuth();

  if (!store) {
    return null;
  }

  const storeInitial = store.name.slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-[#fffaf4] text-[#241f20] selection:bg-[#ff8da4] selection:text-[#241f20] md:grid md:grid-cols-[252px_minmax(0,1fr)]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen min-h-0 flex-col border-r border-black/[0.06] bg-[#fff7f0] md:flex">
        {/* Brand */}
        <div className="px-3 pb-2 pt-3">
          <Link
            href="/"
            className="group flex h-12 items-center gap-3 rounded-2xl px-2.5 transition duration-300 hover:bg-white/70"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#ff8da4] text-sm font-black text-[#241f20] shadow-[inset_0_-2px_0_rgba(36,31,32,0.12)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
              J
            </span>

            <div className="min-w-0">
              <div className="truncate text-[14px] font-black leading-none tracking-[-0.035em]">
                Jelly Shop
              </div>

              <div className="mt-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.11em] text-[#9a5364]">
                <Sparkles size={10} strokeWidth={2.1} />
                Merchant studio
              </div>
            </div>
          </Link>
        </div>

        {/* Store switcher */}
        <div className="px-3 py-2">
          <div className="rounded-[20px] border border-black/[0.06] bg-white/80 p-2.5 shadow-[0_10px_30px_rgba(83,61,66,0.06)] backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <div className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-[#e7efb8] text-[13px] font-black text-[#465225] shadow-[inset_0_-1px_0_rgba(36,31,32,0.08)]">
                {storeInitial}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black leading-4 tracking-[-0.02em] text-[#31292b]">
                  {store.name}
                </p>

                {stores.length > 1 ? (
                  <label className="relative mt-1 block">
                    <span className="sr-only">Switch store</span>
                    <select
                      aria-label="Switch store"
                      value={store.id}
                      onChange={(event) =>
                        setActiveStoreId(event.target.value)
                      }
                      className="w-full appearance-none bg-transparent pr-5 text-[10px] font-bold text-[#766a6d] outline-none"
                    >
                      {stores.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>

                    <ChevronDown
                      size={12}
                      strokeWidth={2}
                      className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[#9a8d90]"
                    />
                  </label>
                ) : (
                  <span className="mt-1 block text-[10px] font-bold text-[#788543]">
                    Store workspace
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-1">
          <AdminNav />
        </div>

        {/* Sidebar footer */}
        <div className="border-t border-black/[0.06] p-2.5">
          <Link
            href={`/${store.slug}`}
            className="group flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-[12px] font-bold text-[#62575a] transition duration-200 hover:bg-white hover:text-[#241f20]"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-[#fff0f3] text-[#a35467] transition group-hover:bg-[#ffdce4]">
              <ShoppingBag size={14} strokeWidth={1.9} />
            </span>

            <span className="flex-1">View storefront</span>

            <ExternalLink
              size={12}
              strokeWidth={1.9}
              className="text-[#a39799]"
            />
          </Link>
        </div>
      </aside>

      {/* Application */}
      <div className="min-w-0">
        {/* Desktop top bar */}
        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between border-b border-black/[0.06] bg-[#fffaf4]/88 px-6 backdrop-blur-xl md:flex">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#ffdbe2] text-[11px] font-black text-[#8e4759]">
              {storeInitial}
            </div>

            <div className="min-w-0">
              <p className="truncate text-[13px] font-black tracking-[-0.02em] text-[#30282a]">
                {store.name}
              </p>

              <p className="mt-0.5 text-[10px] font-semibold text-[#8a7d80]">
                Merchant studio
              </p>
            </div>
          </div>

          <Link
            href={`/${store.slug}`}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3.5 text-[11px] font-black text-[#43393b] shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-[#fff4f6]"
          >
            View store
            <ExternalLink size={12} strokeWidth={1.9} />
          </Link>
        </header>

        {/* Mobile header */}
        <header className="sticky top-0 z-40 flex h-[64px] items-center justify-between border-b border-black/[0.06] bg-[#fffaf4]/92 px-4 backdrop-blur-xl md:hidden">
          <Link href="/" className="group flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#ff8da4] text-sm font-black text-[#241f20] shadow-[inset_0_-2px_0_rgba(36,31,32,0.12)]">
              J
            </span>

            <div className="min-w-0 leading-none">
              <p className="text-[13px] font-black tracking-[-0.03em]">
                Jelly Shop
              </p>

              <p className="mt-1.5 max-w-[145px] truncate text-[9px] font-bold uppercase tracking-[0.08em] text-[#8a7d80]">
                {store.name}
              </p>
            </div>
          </Link>

          <Link
            href={`/${store.slug}`}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 text-[10px] font-black text-[#43393b] shadow-sm"
          >
            Store
            <ExternalLink size={11} strokeWidth={1.9} />
          </Link>
        </header>

        {/* Mobile navigation */}
        <div className="border-b border-black/[0.06] bg-[#fff7f0] md:hidden">
          <AdminNav />
        </div>

        {/* Page content */}
        <main className="min-w-0">
          <div className="mx-auto w-full max-w-[1600px] px-4 pb-20 pt-5 sm:px-6 md:px-8 md:pb-12 md:pt-7 lg:px-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
