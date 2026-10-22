"use client";

import { Plus, Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { majorToMinor, minorToMajor, type ProductOption, type ProductOptionDisplay, type ProductOptionKind, type ProductOptionValue } from "@/lib/domain";
import { cardClass, inputClass, labelClass } from "./product-form-styles";

const newOption = (position: number): ProductOption => ({ id: `option-${crypto.randomUUID()}`, name: "", type: "configuration", display: "buttons", required: false, position, values: [] });
const newValue = (position: number): ProductOptionValue => ({ id: `value-${crypto.randomUUID()}`, label: "", priceAdjustmentMinor: 0, position });

export function ProductOptionsEditor({ options, showOptions, setOptions, setShowOptions, updateOption, updateValue }: {
  options: ProductOption[];
  showOptions: boolean;
  setOptions: Dispatch<SetStateAction<ProductOption[]>>;
  setShowOptions: Dispatch<SetStateAction<boolean>>;
  updateOption: (id: string, patch: Partial<ProductOption>) => void;
  updateValue: (optionId: string, valueId: string, patch: Partial<ProductOptionValue>) => void;
}) {
  return (
        <section className={cardClass}>
          <div className="flex flex-col gap-3 border-b border-black/[0.055] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-[15px] font-black tracking-[-0.02em] text-foreground">
                Product options
              </h2>

              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                Add sizes, colours, configurations, or add-ons.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowOptions(true);
                setOptions((items) => [
                  ...items,
                  newOption(items.length),
                ]);
              }}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border bg-muted/50 px-3.5 text-[10px] font-black text-tint-foreground transition hover:border-tint-border hover:bg-muted"
            >
              <Plus size={13} />
              Add option
            </button>
          </div>

          {!showOptions || options.length === 0 ? (
            <div className="p-5 sm:p-6">
              <button
                type="button"
                onClick={() => {
                  setShowOptions(true);
                  setOptions((items) => [
                    ...items,
                    newOption(items.length),
                  ]);
                }}
                className="group flex w-full flex-col items-center justify-center rounded-[20px] border border-dashed border-border bg-muted/50 px-5 py-10 text-center transition hover:border-tint-border hover:bg-muted/50"
              >
                <span className="grid size-10 place-items-center rounded-full bg-muted text-tint-foreground transition group-hover:scale-105">
                  <Plus size={17} />
                </span>

                <span className="mt-3 text-[12px] font-black text-foreground">
                  Add product options
                </span>

                <span className="mt-1 max-w-sm text-[10px] leading-5 text-muted-foreground">
                  Use options for size, colour, storage, material, add-ons, and
                  other customer choices.
                </span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 p-5 sm:p-6">
              {options.map((option, optionIndex) => (
                <div
                  key={option.id}
                  className="overflow-hidden rounded-[20px] border border-black/[0.065] bg-muted/50"
                >
                  <div className="flex items-center justify-between border-b border-black/[0.055] bg-muted/50 px-4 py-3.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="grid size-6 place-items-center rounded-full bg-muted text-[9px] font-black text-tint-foreground">
                          {optionIndex + 1}
                        </span>

                        <p className="text-[12px] font-black text-foreground">
                          {option.name || "New option"}
                        </p>
                      </div>

                      <p className="ml-8 mt-0.5 text-[9px] font-semibold capitalize text-muted-foreground">
                        {option.type === "variant"
                          ? "Inventory variant"
                          : option.type}
                      </p>
                    </div>

                    <button
                      type="button"
                      aria-label="Remove option"
                      onClick={() =>
                        setOptions((items) =>
                          items.filter((item) => item.id !== option.id),
                        )
                      }
                      className="grid size-8 place-items-center rounded-full text-tint-foreground transition hover:bg-muted"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="p-4">
                    <div className="grid gap-3 lg:grid-cols-3">
                      <label>
                        <span className={labelClass}>Option name</span>
                        <input
                          value={option.name}
                          onChange={(e) =>
                            updateOption(option.id, {
                              name: e.target.value,
                            })
                          }
                          className={inputClass}
                          placeholder="e.g. Size"
                        />
                      </label>

                      <label>
                        <span className={labelClass}>Used for</span>
                        <select
                          value={option.type}
                          onChange={(e) =>
                            updateOption(option.id, {
                              type: e.target.value as ProductOptionKind,
                            })
                          }
                          className={inputClass}
                        >
                          <option value="variant">
                            Inventory variant
                          </option>
                          <option value="configuration">
                            Configuration
                          </option>
                          <option value="addon">Add-on</option>
                        </select>
                      </label>

                      <label>
                        <span className={labelClass}>Display as</span>
                        <select
                          value={option.display}
                          onChange={(e) =>
                            updateOption(option.id, {
                              display:
                                e.target.value as ProductOptionDisplay,
                            })
                          }
                          className={inputClass}
                        >
                          <option value="buttons">Buttons</option>
                          <option value="dropdown">Dropdown</option>
                          <option value="color">Colour swatches</option>
                          <option value="image">Image cards</option>
                        </select>
                      </label>
                    </div>

                    <label className="mt-4 inline-flex items-center gap-2 text-[10px] font-black text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={option.required}
                        onChange={(e) =>
                          updateOption(option.id, {
                            required: e.target.checked,
                          })
                        }
                        className="size-4 rounded border-black/10 accent-[#9b5968]"
                      />
                      Customers must choose an option
                    </label>

                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between">
                        <span className={labelClass}>Values</span>
                        <span className="text-[9px] font-semibold text-muted-foreground">
                          {option.values.length} values
                        </span>
                      </div>

                      <div className="space-y-2">
                        {option.values.map((value, valueIndex) => (
                          <div
                            key={value.id}
                            className="grid items-end gap-2 rounded-[14px] border border-black/[0.055] bg-card p-3 sm:grid-cols-[32px_minmax(0,1fr)_145px_34px]"
                          >
                            <div className="hidden size-8 items-center justify-center rounded-[10px] bg-muted text-[9px] font-black text-muted-foreground sm:flex">
                              {valueIndex + 1}
                            </div>

                            <label>
                              <span className={labelClass}>Value</span>
                              <input
                                value={value.label}
                                onChange={(e) =>
                                  updateValue(option.id, value.id, {
                                    label: e.target.value,
                                  })
                                }
                                className={inputClass}
                                placeholder="e.g. Black"
                              />
                            </label>

                            <label>
                              <span className={labelClass}>Price change</span>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={minorToMajor(
                                    value.priceAdjustmentMinor,
                                  )}
                                  onChange={(e) =>
                                    updateValue(option.id, value.id, {
                                      priceAdjustmentMinor:
                                        majorToMinor(e.target.value) || 0,
                                    })
                                  }
                                  className={`${inputClass} pl-7`}
                                />
                                <span className="pointer-events-none absolute left-2.5 top-[21px] text-[10px] font-black text-muted-foreground">
                                  ₹
                                </span>
                              </div>
                            </label>

                            <button
                              type="button"
                              aria-label="Remove value"
                              onClick={() =>
                                updateOption(option.id, {
                                  values: option.values.filter(
                                    (item) => item.id !== value.id,
                                  ),
                                })
                              }
                              className="mb-1 grid size-8 place-items-center rounded-full text-tint-foreground transition hover:bg-muted"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          updateOption(option.id, {
                            values: [
                              ...option.values,
                              newValue(option.values.length),
                            ],
                          })
                        }
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full px-1 py-1 text-[10px] font-black text-tint-foreground"
                      >
                        <Plus size={12} />
                        Add value
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
  );
}
