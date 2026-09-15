import {
  ArrowLeft,
  Check,
  ChevronDown,
} from "lucide-react";

import { listThemes } from "@jelly/storefront-themes";
import type { StorefrontDocument } from "@jelly/storefront-schema";

import type {
  EditorCommand,
  EditorSelection,
} from "../../model/types";

function formatOption(
  value: string
) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function SelectField({
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
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium text-[#454f5b]">
        {label}
      </span>

      <div className="relative">
        <select
          aria-label={label}
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          className="h-9 w-full appearance-none rounded-lg border border-[#d7d7d7] bg-white px-3 pr-9 text-[12px] font-medium text-[#303030] outline-none transition hover:border-[#bdbdbd] focus:border-[#8c8c8c] focus:ring-2 focus:ring-black/[0.06]"
        >
          {options.map(
            (option) => (
              <option
                key={
                  option.value
                }
                value={
                  option.value
                }
              >
                {option.label}
              </option>
            )
          )}
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

function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-[#eeeeee] px-4 py-5 last:border-b-0">
      <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.07em] text-[#8c9196]">
        {title}
      </h2>

      <div className="space-y-4">
        {children}
      </div>
    </section>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange(
    checked: boolean
  ): void;
}) {
  return (
    <label className="flex min-h-8 cursor-pointer items-center justify-between gap-4">
      <span className="text-[12px] font-medium text-[#454f5b]">
        {label}
      </span>

      <span className="relative shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) =>
            onChange(
              event.target.checked
            )
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

export function ThemeInspector({
  document,
  onSelect,
  onCommand,
}: {
  document: StorefrontDocument;
  onSelect(
    selection: EditorSelection
  ): void;
  onCommand(
    command: EditorCommand
  ): void;
}) {
  const settings =
    document.theme.settings;

  const update = (
    group:
      | "colors"
      | "typography"
      | "buttons"
      | "layout"
      | "productCards",
    key: string,
    value: unknown
  ) => {
    onCommand({
      type: "update-theme-setting",
      group,
      key,
      value,
    });
  };

  return (
    <aside
      className="flex h-full min-h-0 flex-col bg-white"
      aria-label="Theme settings panel"
    >
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[#eeeeee] px-3">
        <button
          type="button"
          aria-label="Back to page hierarchy"
          onClick={() =>
            onSelect(null)
          }
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[#6d7175] transition hover:bg-[#f1f1f1] hover:text-[#202223]"
        >
          <ArrowLeft
            size={16}
            strokeWidth={1.8}
          />
        </button>

        <div className="min-w-0">
          <p className="text-[10px] font-medium text-[#8c9196]">
            Global
          </p>

          <h1 className="mt-0.5 truncate text-[13px] font-semibold text-[#303030]">
            Theme settings
          </h1>
        </div>
      </header>

      {/* Settings */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Theme preset */}
        <SettingsGroup title="Theme preset">
          <SelectField
            label="Preset"
            value={
              document.theme.presetId
            }
            options={listThemes().map(
              ({ id }) => ({
                value: id,
                label:
                  formatOption(id),
              })
            )}
            onChange={(
              presetId
            ) =>
              onCommand({
                type: "update-theme-preset",
                presetId:
                  presetId as StorefrontDocument["theme"]["presetId"],
              })
            }
          />
        </SettingsGroup>

        {/* Colors */}
        <SettingsGroup title="Colors">
          {Object.entries(
            settings.colors
          ).map(
            ([key, value]) => {
              const label =
                key === "background"
                  ? "Background color"
                  : formatOption(key);

              const id = `theme-color-${key}`;

              return (
                <div
                  key={key}
                  className="space-y-1.5"
                >
                  <label
                    htmlFor={id}
                    className="block text-[11px] font-medium text-[#454f5b]"
                  >
                    {label}
                  </label>

                  <div className="flex h-9 items-center gap-2 rounded-lg border border-[#d7d7d7] bg-white px-2 transition focus-within:border-[#8c8c8c] focus-within:ring-2 focus-within:ring-black/[0.06]"
                  >
                    <label className="relative size-5 shrink-0 cursor-pointer overflow-hidden rounded-md border border-black/10">
                      <input
                        type="color"
                        aria-label={`${label} color picker`}
                        value={value}
                        onChange={(
                          event
                        ) =>
                          update(
                            "colors",
                            key,
                            event
                              .target
                              .value
                          )
                        }
                        className="absolute -inset-2 size-10 cursor-pointer border-0 p-0"
                      />
                    </label>

                    <input
                      id={id}
                      value={value}
                      onChange={(
                        event
                      ) =>
                        update(
                          "colors",
                          key,
                          event
                            .target
                            .value
                        )
                      }
                      className="min-w-0 flex-1 bg-transparent text-[12px] font-medium uppercase text-[#303030] outline-none"
                    />
                  </div>
                </div>
              );
            }
          )}
        </SettingsGroup>

        {/* Typography */}
        <SettingsGroup title="Typography">
          <SelectField
            label="Heading font"
            value={
              settings.typography
                .headingFont
            }
            options={[
              "Arial Rounded MT Bold",
              "Inter",
              "Georgia",
              "Arial",
            ].map((value) => ({
              value,
              label: value,
            }))}
            onChange={(value) =>
              update(
                "typography",
                "headingFont",
                value
              )
            }
          />

          <SelectField
            label="Body font"
            value={
              settings.typography
                .bodyFont
            }
            options={[
              "Aptos",
              "Inter",
              "Georgia",
              "Arial",
            ].map((value) => ({
              value,
              label: value,
            }))}
            onChange={(value) =>
              update(
                "typography",
                "bodyFont",
                value
              )
            }
          />

          <SelectField
            label="Heading scale"
            value={
              settings.typography
                .headingScale
            }
            options={[
              "compact",
              "standard",
              "large",
            ].map((value) => ({
              value,
              label:
                formatOption(value),
            }))}
            onChange={(value) =>
              update(
                "typography",
                "headingScale",
                value
              )
            }
          />
        </SettingsGroup>

        {/* Buttons */}
        <SettingsGroup title="Buttons">
          <SelectField
            label="Style"
            value={
              settings.buttons.style
            }
            options={[
              "solid",
              "outline",
            ].map((value) => ({
              value,
              label:
                formatOption(value),
            }))}
            onChange={(value) =>
              update(
                "buttons",
                "style",
                value
              )
            }
          />

          <SelectField
            label="Corners"
            value={
              settings.buttons.radius
            }
            options={[
              "square",
              "soft",
              "rounded",
              "pill",
            ].map((value) => ({
              value,
              label:
                formatOption(value),
            }))}
            onChange={(value) =>
              update(
                "buttons",
                "radius",
                value
              )
            }
          />
        </SettingsGroup>

        {/* Layout */}
        <SettingsGroup title="Layout">
          <SelectField
            label="Container width"
            value={
              settings.layout
                .containerWidth
            }
            options={[
              "narrow",
              "standard",
              "wide",
            ].map((value) => ({
              value,
              label:
                formatOption(value),
            }))}
            onChange={(value) =>
              update(
                "layout",
                "containerWidth",
                value
              )
            }
          />

          <SelectField
            label="Section spacing"
            value={
              settings.layout
                .sectionSpacing
            }
            options={[
              "compact",
              "standard",
              "spacious",
            ].map((value) => ({
              value,
              label:
                formatOption(value),
            }))}
            onChange={(value) =>
              update(
                "layout",
                "sectionSpacing",
                value
              )
            }
          />
        </SettingsGroup>

        {/* Product cards */}
        <SettingsGroup title="Product cards">
          <SelectField
            label="Image ratio"
            value={
              settings.productCards
                .imageRatio
            }
            options={[
              "square",
              "portrait",
              "landscape",
            ].map((value) => ({
              value,
              label:
                formatOption(value),
            }))}
            onChange={(value) =>
              update(
                "productCards",
                "imageRatio",
                value
              )
            }
          />

          <div className="border-t border-[#eeeeee] pt-3">
            <ToggleField
              label="Show vendor"
              checked={
                settings
                  .productCards
                  .showVendor
              }
              onChange={(
                checked
              ) =>
                update(
                  "productCards",
                  "showVendor",
                  checked
                )
              }
            />

            <ToggleField
              label="Show quick add"
              checked={
                settings
                  .productCards
                  .showQuickAdd
              }
              onChange={(
                checked
              ) =>
                update(
                  "productCards",
                  "showQuickAdd",
                  checked
                )
              }
            />
          </div>
        </SettingsGroup>
      </div>
    </aside>
  );
}
