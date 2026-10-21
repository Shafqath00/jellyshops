"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Loader2,
  Search,
  UserRound,
} from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import {
  authApiOrigin,
  useAuth,
} from "@/features/auth/auth-provider";
import { createAdminApi } from "@/features/admin/api";
import { useAdminQuery } from "@/features/admin/use-admin-query";
import { SkeletonRows } from "@/components/ui/skeleton";

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function CustomersPage() {
  const { session, activeStore } = useAuth();

  const api = useMemo(() => {
    if (!session) return null;

    return createAdminApi({
      baseUrl: authApiOrigin(),
      token: session.access_token,
    });
  }, [session]);

  const load = useCallback(
    (_signal: AbortSignal) => api!.listCustomers(activeStore!.id),
    [api, activeStore]
  );

  const query = useAdminQuery(
    api && activeStore ? `customers:${activeStore.id}` : null,
    load
  );

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const customers = query.data?.customers ?? [];

  const filteredCustomers = useMemo(() => {
    const value = deferredSearch.trim().toLowerCase();

    if (!value) return customers;

    return customers.filter((customer) =>
      [customer.name, customer.email]
        .filter(Boolean)
        .some((field) =>
          String(field).toLowerCase().includes(value)
        )
    );
  }, [customers, deferredSearch]);

  const currency = activeStore?.currency ?? "INR";

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-tint-foreground">
          People
        </p>

        <h1 className="mt-2 text-[30px] font-black tracking-[-0.045em] text-foreground sm:text-[34px]">
          Customers
        </h1>

        <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted-foreground">
          See who shops with you, how often they return, and what they have
          spent over time.
        </p>
      </header>

      <section className="overflow-hidden rounded-[24px] border border-black/[0.06] bg-card shadow-[0_14px_44px_rgba(83,61,66,0.055)]">
        <div className="flex flex-col gap-3 border-b border-black/[0.06] bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <label className="relative block w-full sm:max-w-sm">
            <Search
              size={15}
              strokeWidth={1.9}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search customers"
              placeholder="Search by name or email"
              className="h-10 w-full rounded-full border border-black/[0.08] bg-card pl-10 pr-4 text-[12px] font-semibold text-foreground outline-none transition placeholder:text-muted-foreground focus:border-tint-border focus:ring-4 focus:ring-ring/40"
            />
          </label>

          <p className="text-[10px] font-bold text-muted-foreground">
            {customers.length}{" "}
            {customers.length === 1 ? "customer" : "customers"}
          </p>
        </div>

        {query.loading ? (
          <SkeletonRows label="Loading customers…" />
        ) : query.error ? (
          <div className="m-5 rounded-2xl border border-tint-border bg-muted/50 p-4">
            <p
              role="alert"
              className="text-[12px] font-semibold text-tint-foreground"
            >
              {query.error.message}
            </p>

            <button
              type="button"
              onClick={query.retry}
              className="mt-3 inline-flex h-9 items-center rounded-full border border-tint-border bg-card px-3.5 text-[10px] font-black text-tint-foreground transition hover:bg-muted"
            >
              Try again
            </button>
          </div>
        ) : customers.length === 0 ? (
          <div className="grid min-h-72 place-items-center px-6 py-12 text-center">
            <div>
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted text-tint-foreground">
                <UserRound size={22} strokeWidth={1.8} />
              </span>

              <h2 className="mt-4 text-[16px] font-black tracking-[-0.02em] text-foreground">
                No customers yet
              </h2>

              <p className="mx-auto mt-2 max-w-sm text-[12px] leading-5 text-muted-foreground">
                Customer profiles are created automatically when someone
                places an order.
              </p>
            </div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="grid min-h-60 place-items-center px-6 text-center">
            <div>
              <Search className="mx-auto text-muted-foreground" size={22} />
              <p className="mt-3 text-[13px] font-black text-foreground">
                No customers match “{search}”
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Try a different name or email address.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-px bg-black/[0.06] sm:grid-cols-2 xl:grid-cols-3">
            {filteredCustomers.map((customer) => (
              <Link
                key={customer.id}
                href={`/admin/customers/${encodeURIComponent(customer.id)}`}
                className="group bg-card p-5 transition duration-200 hover:bg-muted/50"
              >
                <div className="flex items-start gap-3.5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted text-[12px] font-black text-tint-foreground ring-1 ring-black/[0.04]">
                    {initials(customer.name)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-[13px] font-black tracking-[-0.015em] text-foreground">
                          {customer.name}
                        </h2>

                        <p className="mt-1 truncate text-[10px] font-medium text-muted-foreground">
                          {customer.email ?? "Email unavailable"}
                        </p>
                      </div>

                      <ArrowUpRight
                        size={14}
                        className="shrink-0 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                      />
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                      <span>
                        {customer.orderCount}{" "}
                        {customer.orderCount === 1 ? "order" : "orders"}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span>
                        {formatMoney(
                          customer.lifetimeSpendMinor,
                          currency
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
