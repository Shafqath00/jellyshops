"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Box,
  Loader2,
  PackageOpen,
  Plus,
  Search,
} from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import type { CatalogAdminProduct } from "@/features/store-editor/api/types";

const API_URL =
  process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=1200&q=85";

function formatMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function productStatus(status: string) {
  return status === "ACTIVE"
    ? {
        label: "Live",
        className: "bg-[#edf5e8] text-[#4f6a43]",
      }
    : {
        label: "Draft",
        className: "bg-[#f3f0ed] text-[#756b68]",
      };
}

export default function ProductsPage() {
  const { session, activeStore } = useAuth();
  const token = session?.access_token;

  const api = useMemo(() => {
    if (!token) return null;

    return createStoreEditorApi({
      baseUrl: API_URL,
      token,
    });
  }, [token]);

  const [products, setProducts] = useState<CatalogAdminProduct[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      if (!api || !activeStore) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const result = await api.listProducts(activeStore.id);

        if (!cancelled) {
          setProducts(
            result.nodes.filter(
              (product) => product.status !== "ARCHIVED"
            )
          );
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load products."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, [activeStore, api]);

  const filteredProducts = useMemo(() => {
    const value = deferredQuery.trim().toLowerCase();

    if (!value) return products;

    return products.filter((product) => {
      const variant = product.variants[0];

      return [
        product.title,
        product.productType,
        variant?.sku,
      ]
        .filter(Boolean)
        .some((field) =>
          String(field).toLowerCase().includes(value)
        );
    });
  }, [deferredQuery, products]);

  const currency = activeStore?.currency ?? "INR";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9b5968]">
            Catalog
          </p>

          <h1 className="mt-2 text-[30px] font-black tracking-[-0.045em] text-[#292426] sm:text-[34px]">
            Products
          </h1>

          <p className="mt-2 max-w-xl text-[13px] leading-6 text-[#756b6d]">
            Manage what customers see, buy, and discover in your shop.
          </p>
        </div>

        <Link
          href="/admin/products/new"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#241f20] px-4 text-[11px] font-black text-white shadow-[0_10px_24px_rgba(36,31,32,0.14)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#3a3234]"
        >
          <Plus size={15} strokeWidth={2.2} />
          Add product
        </Link>
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
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search products"
              placeholder="Search products, type or SKU"
              className="h-10 w-full rounded-full border border-black/[0.08] bg-white pl-10 pr-4 text-[12px] font-semibold text-[#342d2f] outline-none transition placeholder:text-[#aaa0a2] focus:border-[#d39aaa] focus:ring-4 focus:ring-[#ff8da4]/10"
            />
          </label>

          <div className="flex items-center gap-2 text-[10px] font-bold text-[#8a7f81]">
            <Box size={13} strokeWidth={1.8} />
            {products.length} {products.length === 1 ? "product" : "products"}
          </div>
        </div>

        {loading ? (
          <div className="grid min-h-64 place-items-center px-6">
            <div className="flex items-center gap-2.5 text-[12px] font-bold text-[#766a6d]">
              <Loader2 size={16} className="animate-spin" />
              Loading products…
            </div>
          </div>
        ) : error ? (
          <div className="m-5 rounded-2xl border border-[#edcbd2] bg-[#fff5f7] p-4 text-[12px] font-semibold text-[#914f60]">
            {error}
          </div>
        ) : products.length === 0 ? (
          <div className="grid min-h-72 place-items-center px-6 py-12 text-center">
            <div>
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff0f3] text-[#a35467]">
                <PackageOpen size={22} strokeWidth={1.8} />
              </span>

              <h2 className="mt-4 text-[16px] font-black tracking-[-0.02em] text-[#322a2c]">
                Your catalog is ready for its first product
              </h2>

              <p className="mx-auto mt-2 max-w-sm text-[12px] leading-5 text-[#817477]">
                Add a product with a clear image, price, and stock level. You
                can publish it whenever you are ready.
              </p>

              <Link
                href="/admin/products/new"
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-[#241f20] px-4 text-[11px] font-black text-white transition hover:bg-[#3a3234]"
              >
                <Plus size={14} />
                Add first product
              </Link>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="grid min-h-60 place-items-center px-6 text-center">
            <div>
              <Search className="mx-auto text-[#aa9ea0]" size={22} />
              <p className="mt-3 text-[13px] font-black text-[#3b3335]">
                No products match “{query}”
              </p>
              <p className="mt-1 text-[11px] text-[#8a7f81]">
                Try a product name, category, or SKU.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,1.8fr)_0.7fr_0.8fr_0.8fr] gap-4 border-b border-black/[0.06] bg-[#fffaf7] px-5 py-3 text-[9px] font-black uppercase tracking-[0.11em] text-[#9a8e90] md:grid">
              <span>Product</span>
              <span>Status</span>
              <span>Inventory</span>
              <span className="text-right">Price</span>
            </div>

            <div className="divide-y divide-black/[0.06]">
              {filteredProducts.map((product) => {
                const variant = product.variants[0];
                const image = product.media[0]?.url ?? FALLBACK_IMAGE;
                const status = productStatus(product.status);
                const stock = variant?.quantity ?? 0;

                return (
                  <Link
                    href={`/admin/products/${product.id}`}
                    key={product.id}
                    className="group grid gap-4 px-4 py-4 transition duration-200 hover:bg-[#fffaf7] sm:px-5 md:grid-cols-[minmax(0,1.8fr)_0.7fr_0.8fr_0.8fr] md:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <span className="relative size-14 shrink-0 overflow-hidden rounded-2xl bg-[#f3efed] ring-1 ring-black/[0.06]">
                        <Image
                          src={image}
                          alt={product.title}
                          fill
                          sizes="56px"
                          className="object-cover transition duration-300 group-hover:scale-[1.04]"
                        />
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-black tracking-[-0.015em] text-[#332b2d]">
                          {product.title}
                        </p>

                        <p className="mt-1 truncate text-[10px] font-medium text-[#95898c]">
                          {product.productType ?? "Product"} ·{" "}
                          {variant?.sku ?? "No SKU"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.07em] ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div>
                      <p
                        className={`text-[11px] font-bold ${
                          stock <= 3
                            ? "text-[#a36c24]"
                            : "text-[#665d5f]"
                        }`}
                      >
                        {stock} in stock
                      </p>

                      {stock <= 3 && (
                        <p className="mt-0.5 text-[9px] font-semibold text-[#b58b4a]">
                          Low inventory
                        </p>
                      )}
                    </div>

                    <p className="text-[12px] font-black text-[#332b2d] md:text-right">
                      {formatMoney(variant?.priceMinor ?? 0, currency)}
                    </p>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
