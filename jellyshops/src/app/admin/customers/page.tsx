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
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9b5968]">
          People
        </p>

        <h1 className="mt-2 text-[30px] font-black tracking-[-0.045em] text-[#292426] sm:text-[34px]">
          Customers
        </h1>

        <p className="mt-2 max-w-xl text-[13px] leading-6 text-[#756b6d]">
          See who shops with you, how often they return, and what they have
          spent over time.
        </p>
      </header>

      <section className="overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-[0_14px_44px_rgba(83,61,66,0.055)]">
        <div className="flex flex-col gap-3 border-b border-black/[0.06] bg-[#fffdfb] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <label className="relative block w-full sm:max-w-sm">
            <Search
              size={15}
              strokeWidth={1.9}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9b8f92]"
            />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search customers"
              placeholder="Search by name or email"
              className="h-10 w-full rounded-full border border-black/[0.08] bg-white pl-10 pr-4 text-[12px] font-semibold text-[#342d2f] outline-none transition placeholder:text-[#aaa0a2] focus:border-[#d39aaa] focus:ring-4 focus:ring-[#ff8da4]/10"
            />
          </label>

          <p className="text-[10px] font-bold text-[#8a7f81]">
            {customers.length}{" "}
            {customers.length === 1 ? "customer" : "customers"}
          </p>
        </div>

        {query.loading ? (
          <div className="grid min-h-64 place-items-center px-6">
            <div className="flex items-center gap-2.5 text-[12px] font-bold text-[#766a6d]">
              <Loader2 size={16} className="animate-spin" />
              Loading customers…
            </div>
          </div>
        ) : query.error ? (
          <div className="m-5 rounded-2xl border border-[#edcbd2] bg-[#fff5f7] p-4">
            <p
              role="alert"
              className="text-[12px] font-semibold text-[#914f60]"
            >
              {query.error.message}
            </p>

            <button
              type="button"
              onClick={query.retry}
              className="mt-3 inline-flex h-9 items-center rounded-full border border-[#e4c7ce] bg-white px-3.5 text-[10px] font-black text-[#884c5b] transition hover:bg-[#fff0f3]"
            >
              Try again
            </button>
          </div>
        ) : customers.length === 0 ? (
          <div className="grid min-h-72 place-items-center px-6 py-12 text-center">
            <div>
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff0f3] text-[#a35467]">
                <UserRound size={22} strokeWidth={1.8} />
              </span>

              <h2 className="mt-4 text-[16px] font-black tracking-[-0.02em] text-[#322a2c]">
                No customers yet
              </h2>

              <p className="mx-auto mt-2 max-w-sm text-[12px] leading-5 text-[#817477]">
                Customer profiles are created automatically when someone
                places an order.
              </p>
            </div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="grid min-h-60 place-items-center px-6 text-center">
            <div>
              <Search className="mx-auto text-[#aa9ea0]" size={22} />
              <p className="mt-3 text-[13px] font-black text-[#3b3335]">
                No customers match “{search}”
              </p>
              <p className="mt-1 text-[11px] text-[#8a7f81]">
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
                className="group bg-white p-5 transition duration-200 hover:bg-[#fffaf7]"
              >
                <div className="flex items-start gap-3.5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#f8ecef] text-[12px] font-black text-[#8f5261] ring-1 ring-black/[0.04]">
                    {initials(customer.name)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-[13px] font-black tracking-[-0.015em] text-[#332b2d]">
                          {customer.name}
                        </h2>

                        <p className="mt-1 truncate text-[10px] font-medium text-[#95898c]">
                          {customer.email ?? "Email unavailable"}
                        </p>
                      </div>

                      <ArrowUpRight
                        size={14}
                        className="shrink-0 text-[#b1a5a7] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#7f626a]"
                      />
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-[#756b6d]">
                      <span>
                        {customer.orderCount}{" "}
                        {customer.orderCount === 1 ? "order" : "orders"}
                      </span>
                      <span className="text-[#c0b6b8]">•</span>
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
