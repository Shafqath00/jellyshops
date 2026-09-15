import { Check, ChevronDown } from "lucide-react";

import type { MediaReference } from "@jelly/storefront-schema";
import type { ControlDefinition } from "@jelly/storefront-registry";

import type {
  DemoCatalog,
  MediaRecord,
} from "../../api/types";
import { ImageControl } from "../controls/image-control";

const inputClass =
  "h-9 w-full rounded-lg border border-[#d7d7d7] bg-white px-3 text-[12px] font-medium text-[#303030] outline-none transition placeholder:text-[#a3a3a3] hover:border-[#bdbdbd] focus:border-[#8c8c8c] focus:ring-2 focus:ring-black/[0.06]";

const labelClass =
  "mb-1.5 block text-[11px] font-medium text-[#454f5b]";

function SelectControl({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{
    label: string;
    value: string;
  }>;
  placeholder?: string;
  onChange(value: string): void;
}) {
  return (
    <label className="block">
      <span className={labelClass}>
        {label}
      </span>

      <div className="relative">
        <select
          aria-label={label}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className={`${inputClass} appearance-none pr-9`}
        >
          {placeholder && (
            <option value="">
              {placeholder}
            </option>
          )}

          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>

        <ChevronDown
          size={14}
          strokeWidth={1.8}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8c9196]"
        />
      </div>
    </label>
  );
}

function ToggleControl({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange(value: boolean): void;
}) {
  return (
    <label className="flex min-h-8 cursor-pointer items-center justify-between gap-4">
      <span className="text-[12px] font-medium text-[#454f5b]">
        {label}
      </span>

      <span className="relative shrink-0">
        <input
          aria-label={label}
          type="checkbox"
          checked={checked}
          onChange={(event) =>
            onChange(event.target.checked)
          }
          className="peer sr-only"
        />

        <span className="block h-5 w-9 rounded-full bg-[#d7d7d7] transition peer-checked:bg-[#303030] peer-focus-visible:ring-2 peer-focus-visible:ring-black/20 peer-focus-visible:ring-offset-2" />

        <span className="absolute left-0.5 top-0.5 grid size-4 place-items-center rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4">
          {checked && (
            <Check
              size={9}
              strokeWidth={3}
              className="text-[#303030]"
            />
          )}
        </span>
      </span>
    </label>
  );
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) {
  const pickerValue =
    /^#[0-9a-fA-F]{6}$/.test(value)
      ? value
      : "#ffffff";

  return (
    <div>
      <label
        htmlFor={`control-color-${label}`}
        className={labelClass}
      >
        {label}
      </label>

      <div className="flex h-9 items-center gap-2 rounded-lg border border-[#d7d7d7] bg-white px-2 transition hover:border-[#bdbdbd] focus-within:border-[#8c8c8c] focus-within:ring-2 focus-within:ring-black/[0.06]">
        <label className="relative size-5 shrink-0 cursor-pointer overflow-hidden rounded-md border border-black/10">
          <input
            type="color"
            aria-label={`${label} color picker`}
            value={pickerValue}
            onChange={(event) =>
              onChange(event.target.value)
            }
            className="absolute -inset-2 size-10 cursor-pointer border-0 p-0"
          />
        </label>

        <input
          id={`control-color-${label}`}
          aria-label={label}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder="#FFFFFF"
          className="min-w-0 flex-1 bg-transparent text-[12px] font-medium uppercase text-[#303030] outline-none placeholder:text-[#a3a3a3]"
        />
      </div>
    </div>
  );
}

function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{
    label: string;
    value: string;
  }>;
  onChange(value: string): void;
}) {
  return (
    <div>
      <span className={labelClass}>
        {label}
      </span>

      <div
        role="group"
        aria-label={label}
        className="flex flex-wrap gap-1 rounded-lg bg-[#f1f1f1] p-1"
      >
        {options.map((option) => {
          const active =
            value === option.value;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() =>
                onChange(option.value)
              }
              className={`min-h-7 flex-1 rounded-md px-2.5 text-[11px] font-medium transition ${
                active
                  ? "bg-white text-[#202223] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                  : "text-[#6d7175] hover:text-[#303030]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange(value: number): void;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-[#454f5b]">
          {label}
        </span>

        <span className="min-w-[30px] rounded-md bg-[#f1f1f1] px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums text-[#616161]">
          {value}
        </span>
      </span>

      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) =>
          onChange(
            Number(event.target.value)
          )
        }
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#dedede] accent-[#303030]"
      />
    </label>
  );
}

export function ControlRenderer({
  definition,
  value,
  onChange,
  catalog,
  upload = async () => {
    throw new Error(
      "Image uploads are unavailable"
    );
  },
}: {
  definition: ControlDefinition;
  value: unknown;
  onChange(value: unknown): void;
  catalog: DemoCatalog;
  upload?: (
    file: File,
    onProgress?: (
      percent: number
    ) => void
  ) => Promise<MediaRecord>;
}) {
  const stringValue =
    typeof value === "string"
      ? value
      : "";

  /*
   * Text
   */
  if (definition.type === "text") {
    return (
      <label className="block">
        <span className={labelClass}>
          {definition.label}
        </span>

        <input
          aria-label={definition.label}
          value={stringValue}
          maxLength={
            definition.maxLength
          }
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          className={inputClass}
        />
      </label>
    );
  }

  /*
   * Textarea / rich text
   */
  if (
    definition.type === "textarea" ||
    definition.type === "rich-text"
  ) {
    return (
      <label className="block">
        <span className={labelClass}>
          {definition.label}
        </span>

        <textarea
          aria-label={definition.label}
          value={stringValue}
          maxLength={
            definition.maxLength
          }
          rows={
            definition.type ===
            "rich-text"
              ? 6
              : 4
          }
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          className="w-full resize-y rounded-lg border border-[#d7d7d7] bg-white px-3 py-2.5 text-[12px] font-medium leading-5 text-[#303030] outline-none transition placeholder:text-[#a3a3a3] hover:border-[#bdbdbd] focus:border-[#8c8c8c] focus:ring-2 focus:ring-black/[0.06]"
        />
      </label>
    );
  }

  /*
   * Number
   */
  if (
    definition.type === "number"
  ) {
    const numberValue =
      typeof value === "number"
        ? value
        : definition.min ?? 0;

    return (
      <label className="block">
        <span className={labelClass}>
          {definition.label}
        </span>

        <input
          aria-label={definition.label}
          type="number"
          min={definition.min}
          max={definition.max}
          step={
            "step" in definition
              ? definition.step
              : 1
          }
          value={numberValue}
          onChange={(event) =>
            onChange(
              Number(
                event.target.value
              )
            )
          }
          className={inputClass}
        />
      </label>
    );
  }

  /*
   * Range / spacing
   */
  if (
    definition.type === "range" ||
    definition.type === "spacing"
  ) {
    const numericValue =
      typeof value === "number"
        ? value
        : definition.min ?? 0;

    const step =
      "step" in definition &&
      typeof definition.step ===
        "number"
        ? definition.step
        : 1;

    return (
      <RangeControl
        label={definition.label}
        value={numericValue}
        min={definition.min ?? 0}
        max={definition.max ?? 100}
        step={step}
        onChange={onChange}
      />
    );
  }

  /*
   * Select
   */
  if (
    definition.type === "select"
  ) {
    return (
      <SelectControl
        label={definition.label}
        value={stringValue}
        options={definition.options}
        onChange={onChange}
      />
    );
  }

  /*
   * Segmented
   */
  if (
    definition.type === "segmented"
  ) {
    return (
      <SegmentedControl
        label={definition.label}
        value={stringValue}
        options={definition.options}
        onChange={onChange}
      />
    );
  }

  /*
   * Toggle
   */
  if (
    definition.type === "checkbox"
  ) {
    return (
      <ToggleControl
        label={definition.label}
        checked={Boolean(value)}
        onChange={onChange}
      />
    );
  }

  /*
   * Color
   */
  if (
    definition.type === "color"
  ) {
    return (
      <ColorControl
        label={definition.label}
        value={
          stringValue ||
          "#ffffff"
        }
        onChange={onChange}
      />
    );
  }

  /*
   * Font
   */
  if (
    definition.type === "font"
  ) {
    return (
      <SelectControl
        label={definition.label}
        value={stringValue}
        options={[
          "Aptos",
          "Inter",
          "Georgia",
          "Arial",
        ].map((font) => ({
          label: font,
          value: font,
        }))}
        onChange={onChange}
      />
    );
  }

  /*
   * Link
   */
  if (
    definition.type === "link"
  ) {
    return (
      <label className="block">
        <span className={labelClass}>
          {definition.label}
        </span>

        <input
          aria-label={definition.label}
          type="url"
          value={stringValue}
          placeholder="https://"
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          className={inputClass}
        />
      </label>
    );
  }

  /*
   * Image
   */
  if (
    definition.type === "image"
  ) {
    return (
      <ImageControl
        label={definition.label}
        value={
          value as
            | MediaReference
            | undefined
        }
        onChange={onChange}
        upload={upload}
      />
    );
  }

  /*
   * Product / collection
   */
  const options =
    definition.type === "product"
      ? catalog.products
      : catalog.collections;

  return (
    <SelectControl
      label={definition.label}
      value={stringValue}
      placeholder={`Choose ${definition.type}`}
      options={options.map(
        (option) => ({
          label: option.name,
          value: option.id,
        })
      )}
      onChange={onChange}
    />
  );
}