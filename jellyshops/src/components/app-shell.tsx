"use client";

import Link from "next/link";
import {
  ChevronDown,
  ExternalLink,
  ShoppingBag,
  Store,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { AdminNav } from "./admin-nav";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeStore: store, stores, setActiveStoreId } = useAuth();

  if (!store) return null;

  const storeInitial = store.name.slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground md:grid md:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen min-h-0 flex-col border-r bg-card md:flex">
        <div className="border-b px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              J
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Jelly Shop</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Merchant workspace
              </div>
            </div>
          </Link>
        </div>

        <div className="px-3 py-3">
          <div className="rounded-lg border bg-background p-2.5">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold">
                {storeInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{store.name}</p>
                {stores.length > 1 ? (
                  <label className="relative mt-1 block">
                    <span className="sr-only">Switch store</span>
                    <select
                      aria-label="Switch store"
                      value={store.id}
                      onChange={(event) => setActiveStoreId(event.target.value)}
                      className="w-full appearance-none bg-transparent pr-5 text-xs text-muted-foreground outline-none"
                    >
                      {stores.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={12}
                      className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                  </label>
                ) : (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Active store
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <AdminNav />
        </div>

        <div className="border-t p-3">
          <Link
            href={`/${store.slug}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "w-full justify-start",
            )}
          >
            <ShoppingBag />
            View storefront
            <ExternalLink className="ml-auto" />
          </Link>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 hidden h-14 items-center justify-between border-b bg-background/95 px-6 backdrop-blur md:flex">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-8 place-items-center rounded-md bg-muted text-xs font-semibold">
              {storeInitial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{store.name}</p>
              <p className="text-xs text-muted-foreground">Merchant workspace</p>
            </div>
          </div>

          <Link
            href={`/${store.slug}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            View store
            <ExternalLink />
          </Link>
        </header>

        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
              J
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Jelly Shop</p>
              <p className="truncate text-xs text-muted-foreground">{store.name}</p>
            </div>
          </Link>

          <Link
            href={`/${store.slug}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Store />
            Store
          </Link>
        </header>

        <div className="md:hidden">
          <AdminNav />
        </div>

        <main className="min-w-0">
          <div className="mx-auto w-full max-w-[1600px] px-4 pb-24 pt-6 sm:px-6 md:px-8 md:pb-12 lg:px-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
