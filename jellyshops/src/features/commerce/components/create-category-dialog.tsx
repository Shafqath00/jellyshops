"use client";

import { getCategoryBreadcrumb } from "@/lib/domain";
import type { useShop } from "@/contexts/shop-context";
import { inputClass, labelClass } from "./product-form-styles";

type Categories = ReturnType<ReturnType<typeof useShop>["repository"]["getCategories"]>;

export function CreateCategoryDialog({ createName, setCreateName, createParentId, createError, categories, onCancel, onCreate }: {
  createName: string;
  setCreateName: (value: string) => void;
  createParentId: string | undefined;
  createError: string;
  categories: Categories;
  onCancel: () => void;
  onCreate: () => void;
}) {
  return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create category"
        className="fixed inset-0 z-50 grid place-items-center bg-primary/35 p-4 backdrop-blur-[2px]"
      >
        <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/50 bg-card shadow-[0_30px_90px_rgba(56,39,44,0.22)]">
          <div className="border-b border-black/[0.055] px-6 py-5">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-tint-foreground">
              Organization
            </p>

            <h2 className="mt-1 text-[19px] font-black tracking-[-0.025em] text-foreground">
              Create category
            </h2>
          </div>

          <div className="p-6">
            <label className="block">
              <span className={labelClass}>Category name</span>

              <input
                autoFocus
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Polo Shirts"
              />
            </label>

            <div className="mt-5">
              <p className={labelClass}>Parent category</p>

              <div className="mt-2 rounded-[14px] border border-border bg-muted/50 px-3.5 py-3 text-[11px] font-bold leading-5 text-muted-foreground">
                {createParentId
                  ? getCategoryBreadcrumb(createParentId, categories)
                  : "Root category"}
              </div>
            </div>

            {createError && (
              <p
                role="alert"
                className="mt-4 rounded-[14px] bg-muted/50 px-3 py-2.5 text-[10px] font-bold text-tint-foreground"
              >
                {createError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onCancel()}
                className="h-9 rounded-full px-4 text-[10px] font-black text-muted-foreground transition hover:bg-muted/50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={onCreate}
                className="h-9 rounded-full bg-primary px-5 text-[10px] font-black text-primary-foreground shadow-[0_5px_16px_rgba(48,41,43,0.16)] transition hover:bg-primary"
              >
                Create category
              </button>
            </div>
          </div>
        </div>
      </div>
  );
}
