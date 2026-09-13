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

const groups: Array<{
  id: ControlGroup;
  label: string;
}> = [
  { id: "content", label: "Content" },
  { id: "layout", label: "Layout" },
  { id: "style", label: "Style" },
  { id: "advanced", label: "Advanced" },
];

export function SettingGroups({
  controls,
  settings,
  catalog,
  upload,
  dynamicSources = [],
  onChange,
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
}) {
  return (
    <div className="space-y-6">
      {groups.map(({ id, label }) => {
        const grouped = controls.filter((control) => control.group === id);
        if (!grouped.length) return null;

        return (
          <section
            key={id}
            className={id === "advanced" ? "border-t border-[#eeeeee] pt-5" : ""}
          >
            <h2
              className={
                id === "advanced"
                  ? "mb-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-[#a3a3a3]"
                  : "mb-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-[#8c9196]"
              }
            >
              {label}
            </h2>

            <div className="space-y-4">
              {grouped.map((control) => (
                <div key={control.key} data-editor-control-key={control.key}>
                  <ControlRenderer
                    definition={control}
                    value={settings[control.key]}
                    catalog={catalog}
                    upload={upload}
                    onChange={(value) => onChange(control.key, value)}
                  />
                  <DynamicSourcePicker
                    acceptedTypes={control.dynamicTypes ?? []}
                    sources={dynamicSources}
                    onSelect={(binding) => onChange(control.key, { kind: "dynamic", binding })}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
