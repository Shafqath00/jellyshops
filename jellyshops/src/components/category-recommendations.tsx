"use client";

import { Check, Plus, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import {
  getEffectiveCategoryOptionDefinitions,
  type Category,
  type CategoryOptionDefinition,
  type ProductOption,
} from "@/lib/domain";

type CategoryRecommendationsProps = {
  categoryId?: string;
  categories: Category[];
  definitions: CategoryOptionDefinition[];
  existingOptions: ProductOption[];
  onAdd: (definitions: CategoryOptionDefinition[]) => void;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function CategoryRecommendations({
  categoryId,
  categories,
  definitions,
  existingOptions,
  onAdd,
}: CategoryRecommendationsProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const available = useMemo(() => {
    if (!categoryId) return [];

    const effective = getEffectiveCategoryOptionDefinitions(
      categoryId,
      categories,
      definitions,
    );

    const existingNames = new Set(
      existingOptions.map((option) => normalize(option.name)),
    );

    return effective.filter(
      (definition) => !existingNames.has(normalize(definition.name)),
    );
  }, [
    categoryId,
    categories,
    definitions,
    existingOptions,
  ]);

  if (!categoryId || available.length === 0) {
    return null;
  }

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }

  function addSelected() {
    const definitionsToAdd = available.filter((item) =>
      selected.includes(item.id),
    );

    onAdd(definitionsToAdd);
    setSelected([]);
  }

  return (
    <div className="mt-3 overflow-hidden rounded-[16px] border border-[#eddee2] bg-[#fffbfc]">
      <div className="flex items-start gap-3 px-3.5 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#fff0f3] text-[#9b5968]">
          <Sparkles size={13} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black text-[#493f42]">
                Suggested options
              </p>

              <p className="mt-0.5 text-[9px] leading-4 text-[#978b8e]">
                Common options for this category.
              </p>
            </div>

            <span className="shrink-0 rounded-full bg-[#f7f1f2] px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-[#95898c]">
              Optional
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-black/[0.045] px-2.5 py-2">
        <div className="space-y-1">
          {available.map((definition) => {
            const active = selected.includes(definition.id);

            return (
              <button
                key={definition.id}
                type="button"
                onClick={() => toggle(definition.id)}
                className={[
                  "flex w-full items-center justify-between gap-3 rounded-[11px]",
                  "px-2.5 py-2 text-left transition",
                  active
                    ? "bg-[#fff0f3]"
                    : "hover:bg-[#faf6f5]",
                ].join(" ")}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={[
                      "grid size-[18px] shrink-0 place-items-center rounded-[6px] border transition",
                      active
                        ? "border-[#9b5968] bg-[#9b5968] text-white"
                        : "border-black/[0.1] bg-white text-transparent",
                    ].join(" ")}
                  >
                    <Check size={11} strokeWidth={3} />
                  </span>

                  <span className="truncate text-[10px] font-bold text-[#514649]">
                    {definition.name}
                  </span>
                </span>

                <span className="shrink-0 text-[8px] font-bold capitalize text-[#a09597]">
                  {definition.optionKind === "variant"
                    ? "Variant"
                    : definition.optionKind}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex items-center justify-between border-t border-black/[0.045] bg-[#fcf9f8] px-3.5 py-2.5">
          <span className="text-[9px] font-bold text-[#8c8083]">
            {selected.length} selected
          </span>

          <button
            type="button"
            onClick={addSelected}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#30292b] px-3.5 text-[9px] font-black text-white transition hover:bg-[#1f1a1c]"
          >
            <Plus size={11} />
            Add options
          </button>
        </div>
      )}
    </div>
  );
}