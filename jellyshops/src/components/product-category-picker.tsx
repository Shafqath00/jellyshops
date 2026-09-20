"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  getCategoryBreadcrumb,
  getCategoryChildren,
  type Category,
} from "@/lib/domain";

type ProductCategoryPickerProps = {
  categories: Category[];
  value?: string;
  recentCategoryIds?: string[];
  onChange: (categoryId: string) => void;
  onCreateCategory?: (parentId?: string) => void;
  label?: string;
};

const inputClass =
  "h-10 w-full rounded-xl border border-black/[0.07] bg-[#fffdfc] " +
  "text-[11px] font-semibold text-[#3d3537] outline-none transition " +
  "placeholder:text-[#b1a6a8] focus:border-[#d09aaa] " +
  "focus:ring-4 focus:ring-[#e8a9b8]/10";

export function ProductCategoryPicker({
  categories,
  value,
  recentCategoryIds = [],
  onChange,
  onCreateCategory,
  label = "Primary category",
}: ProductCategoryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [browseId, setBrowseId] = useState<string>();

  const selected = categories.find((item) => item.id === value);
  const browseCategory = categories.find((item) => item.id === browseId);

  const recent = useMemo(
    () =>
      recentCategoryIds
        .map((id) => categories.find((item) => item.id === id))
        .filter((item): item is Category => Boolean(item)),
    [categories, recentCategoryIds],
  );

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) return [];

    return categories.filter((category) => {
      const breadcrumb = getCategoryBreadcrumb(
        category.id,
        categories,
      ).toLowerCase();

      return (
        category.name.toLowerCase().includes(term) ||
        breadcrumb.includes(term)
      );
    });
  }, [categories, query]);

  const rows = query
    ? searchResults
    : getCategoryChildren(browseId, categories);

  function close() {
    setOpen(false);
    setQuery("");
    setBrowseId(undefined);
  }

  function select(categoryId: string) {
    onChange(categoryId);
    close();
  }

  function goBack() {
    setBrowseId(browseCategory?.parentId);
  }

  return (
    <div className="relative">
      <label className="block">
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#887c7f]">
          {label}
        </span>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={[
            "mt-2 flex min-h-11 w-full items-center justify-between gap-3",
            "rounded-[14px] border px-3.5 text-left transition",
            open
              ? "border-[#d6a8b4] bg-white ring-4 ring-[#e8a9b8]/10"
              : "border-black/[0.07] bg-[#fffdfc] hover:border-black/[0.12]",
          ].join(" ")}
        >
          <span
            className={
              selected
                ? "min-w-0 truncate text-[11px] font-bold text-[#403739]"
                : "min-w-0 truncate text-[11px] font-semibold text-[#aaa0a2]"
            }
          >
            {selected
              ? getCategoryBreadcrumb(selected.id, categories)
              : "Select a category"}
          </span>

          <ChevronDown
            size={14}
            className={`shrink-0 text-[#9b5968] transition ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </label>

      {open && (
        <div
          role="dialog"
          aria-label={`Choose ${label.toLowerCase()}`}
          className={[
            "absolute left-0 z-40 mt-2 w-full overflow-hidden",
            "min-w-[min(380px,calc(100vw-2rem))]",
            "rounded-[20px] border border-black/[0.07] bg-white",
            "shadow-[0_22px_60px_rgba(70,49,55,0.16)]",
          ].join(" ")}
        >
          {/* Search */}
          <div className="border-b border-black/[0.055] p-3">
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a3989b]"
              />

              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search categories"
                aria-label="Search categories"
                className={`${inputClass} pl-9 pr-9`}
              />

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-[#9c707b] transition hover:bg-[#fff0f3]"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[360px] overflow-y-auto p-2">
            {/* Recent */}
            {!query && !browseId && recent.length > 0 && (
              <div className="mb-2">
                <p className="px-2 pb-1.5 pt-1 text-[8px] font-black uppercase tracking-[0.14em] text-[#a05d6d]">
                  Recently used
                </p>

                {recent.map((category) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    categories={categories}
                    onSelect={select}
                    showBreadcrumb
                  />
                ))}

                <div className="mx-2 my-2 border-t border-black/[0.05]" />
              </div>
            )}

            {/* Browse header */}
            {!query && (
              <div className="mb-1 flex min-h-9 items-center gap-2 px-1">
                {browseId && (
                  <button
                    type="button"
                    onClick={goBack}
                    aria-label="Go back"
                    className="grid size-7 shrink-0 place-items-center rounded-full bg-[#fff3f5] text-[#9b5968] transition hover:bg-[#ffe9ee]"
                  >
                    <ChevronLeft size={13} />
                  </button>
                )}

                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-[0.13em] text-[#96898c]">
                    {browseId ? "Browsing" : "Categories"}
                  </p>

                  {browseCategory && (
                    <p className="truncate text-[10px] font-bold text-[#4c4345]">
                      {getCategoryBreadcrumb(
                        browseCategory.id,
                        categories,
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Rows */}
            <div className="space-y-0.5">
              {rows.map((category) => {
                const hasChildren =
                  getCategoryChildren(category.id, categories).length > 0;

                return (
                  <div
                    key={category.id}
                    className="group flex items-center rounded-[12px] transition hover:bg-[#fff7f8]"
                  >
                    <button
                      type="button"
                      onClick={() => select(category.id)}
                      className="min-w-0 flex-1 px-3 py-2.5 text-left"
                    >
                      <span className="block truncate text-[11px] font-bold text-[#493f42]">
                        {category.name}
                      </span>

                      {query && (
                        <span className="mt-0.5 block truncate text-[9px] font-medium text-[#9d9194]">
                          {getCategoryBreadcrumb(
                            category.id,
                            categories,
                          )}
                        </span>
                      )}
                    </button>

                    {!query && hasChildren && (
                      <button
                        type="button"
                        onClick={() => setBrowseId(category.id)}
                        aria-label={`Browse ${category.name}`}
                        className="mr-1 grid size-8 shrink-0 place-items-center rounded-full text-[#a15e6f] transition hover:bg-white"
                      >
                        <ChevronRight size={13} />
                      </button>
                    )}
                  </div>
                );
              })}

              {rows.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <p className="text-[11px] font-bold text-[#756a6d]">
                    No categories found
                  </p>
                  <p className="mt-1 text-[9px] text-[#aaa0a2]">
                    Try another search or create a new category.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          {onCreateCategory && (
            <div className="border-t border-black/[0.055] bg-[#fcfaf9] p-2">
              <button
                type="button"
                onClick={() => {
                  onCreateCategory(browseId);
                  close();
                }}
                className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2.5 text-left text-[10px] font-black text-[#9b5968] transition hover:bg-[#fff0f3]"
              >
                <span className="grid size-6 place-items-center rounded-full bg-[#fff0f3]">
                  <Plus size={12} />
                </span>

                <span>
                  Create{" "}
                  {browseCategory
                    ? `under ${browseCategory.name}`
                    : "category"}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  category,
  categories,
  onSelect,
  showBreadcrumb = false,
}: {
  category: Category;
  categories: Category[];
  onSelect: (id: string) => void;
  showBreadcrumb?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(category.id)}
      className="block w-full rounded-[12px] px-3 py-2.5 text-left transition hover:bg-[#fff7f8]"
    >
      <span className="block truncate text-[10px] font-black text-[#4a4043]">
        {category.name}
      </span>

      {showBreadcrumb && (
        <span className="mt-0.5 block truncate text-[9px] font-medium text-[#9b8f92]">
          {getCategoryBreadcrumb(category.id, categories)}
        </span>
      )}
    </button>
  );
}