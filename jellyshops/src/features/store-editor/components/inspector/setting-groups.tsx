import type {
  ControlDefinition,
  ControlGroup,
} from "@jelly/storefront-registry";

import type {
  DemoCatalog,
  DynamicSourceDescriptor,
  MediaRecord,
} from "../../api/types";
import { DynamicSourcePicker } from "../dynamic-source-picker";
import { ControlRenderer } from "./control-renderer";
import { RichTextSetting } from "./rich-text-setting";

const groups: Array<{
  id: ControlGroup;
  label: string;
}> = [
  { id: "content", label: "Content" },
  { id: "layout", label: "Layout" },
  { id: "style", label: "Appearance" },
  { id: "advanced", label: "Advanced" },
];

const descriptions: Record<string, string> = {
  heading: "The title shown in this section.",
  text: "The text shown to your customers.",
  image: "The image displayed in this section.",
  link: "Where customers go when they select this item.",
  productId: "Choose the product to display.",
  collectionId: "Choose the collection to display.",
  columns: "The number of items shown side by side.",
  colorScheme: "The colors used for this section.",
  padding: "The space around the content.",
};

function displayValue(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const setting = value as Record<string, unknown>;
  if (setting.kind === "dynamic") return setting.fallback;
  if (setting.kind === "static") return setting.value;
  return value;
}

export function SettingGroups({
  controls,
  settings,
  catalog,
  upload,
  dynamicSources = [],
  onChange,
  onPatch,
}: {
  controls: ControlDefinition[];
  settings: Record<string, unknown>;
  catalog: DemoCatalog;
  upload?: (
    file: File,
    onProgress?: (percent: number) => void
  ) => Promise<MediaRecord>;
  dynamicSources?: DynamicSourceDescriptor[];
  onChange(key: string, value: unknown): void;
  /** Saves several settings at once; rich text settings need it to keep their formatted copy. */
  onPatch?(patch: Record<string, unknown>): void;
}) {
  // A control with `showWhen` appears only while the other setting has that value (e.g. border colour once "Solid" is picked).
  const visible = controls.filter((control) => !control.showWhen || displayValue(settings[control.showWhen.key]) === control.showWhen.equals);
  return (
    <div className="space-y-6">
      {groups.map(({ id, label }) => {
        const grouped = visible.filter((control) => control.group === id);
        if (!grouped.length) return null;

        const renderControl = (control: ControlDefinition) => (
          <div key={control.key} data-editor-control-key={control.key}>
            {control.type === "rich-text" && onPatch && (settings[control.key] === undefined || typeof settings[control.key] === "string")
              ? <RichTextSetting id={`setting-${control.key}`} settingKey={control.key} label={control.label} maxLength={control.maxLength} settings={settings} inline={control.inline} onPatch={onPatch} />
              : <ControlRenderer definition={control} value={displayValue(settings[control.key])} catalog={catalog} upload={upload} onChange={(value) => onChange(control.key, value)} />}
            {(control.description ?? descriptions[control.key]) && <p className="mt-1 text-xs text-muted-foreground">{control.description ?? descriptions[control.key]}</p>}
            <DynamicSourcePicker acceptedTypes={control.dynamicTypes ?? []} sources={dynamicSources} onSelect={(binding) => onChange(control.key, { kind: "dynamic", binding })} />
          </div>
        );
        const contents = grouped.map(renderControl);
        // Controls with sub-headings (Layout, Typography, Padding…) get one titled part per heading, like Shopify's panel.
        if (id !== "advanced" && grouped.some((control) => control.heading)) {
          const parts: Array<{ heading: string; controls: ControlDefinition[] }> = [];
          for (const control of grouped) {
            const heading = control.heading ?? label;
            const last = parts[parts.length - 1];
            if (last?.heading === heading) last.controls.push(control);
            else parts.push({ heading, controls: [control] });
          }
          return parts.map((part, index) => (
            <section key={`${id}-${index}`} aria-label={part.heading} className="border-t border-border pt-5">
              <h2 className="mb-3 text-[13px] font-semibold text-foreground">{part.heading}</h2>
              <div className="space-y-4">{part.controls.map(renderControl)}</div>
            </section>
          ));
        }
        if (id === "advanced") return <details key={id} className="border-t border-border pt-5"><summary className="cursor-pointer"><h2 className="inline text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">Advanced</h2></summary><div className="mt-3 space-y-4">{contents}</div></details>;
        return (
          <section key={id}>
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              {label}
            </h2>

            <div className="space-y-4">
              {contents}
            </div>
          </section>
        );
      })}
    </div>
  );
}
