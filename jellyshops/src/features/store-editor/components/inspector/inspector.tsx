import {
  useEffect,
  useRef,
} from "react";
import {
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

import {
  getBlockDefinition,
  getSectionDefinition,
} from "@jelly/storefront-registry";
import type { StorefrontDocument } from "@jelly/storefront-schema";

import type {
  DemoCatalog,
  DynamicSourceDescriptor,
  MediaRecord,
} from "../../api/types";
import type {
  EditorCommand,
  EditorSelection,
} from "../../model/types";
import { SettingGroups } from "./setting-groups";

const sectionLabels: Record<string, string> = {
  "announcement-bar": "Announcement bar",
  header: "Header",
  hero: "Hero",
  "product-grid": "Product grid",
  "featured-collection": "Featured collection",
  "rich-text": "Rich text",
  "image-with-text": "Image with text",
  multicolumn: "Multicolumn",
  newsletter: "Newsletter",
  "spacer-divider": "Spacer / divider",
  footer: "Footer",
};

function title(value: string): string {
  return sectionLabels[value] ?? value
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function Inspector({
  document,
  selection,
  catalog,
  onSelect,
  onCommand,
  upload,
  dynamicSources = [],
}: {
  document: StorefrontDocument;
  selection: Exclude<EditorSelection, null | { kind: "theme" }>;
  catalog: DemoCatalog;
  onSelect(selection: EditorSelection): void;
  onCommand(command: EditorCommand): void;
  upload?: (
    file: File,
    onProgress?: (percent: number) => void
  ) => Promise<MediaRecord>;
  dynamicSources?: DynamicSourceDescriptor[];
}) {
  const section = document.regions[selection.region].find(({ id }) => id === selection.sectionId);
  const bodyRef = useRef<HTMLDivElement>(null);
  const requestedFieldKey = selection.kind === "block" ? selection.fieldKey : undefined;
  const focusRequestId = selection.kind === "block" ? selection.focusRequestId : undefined;

  if (!section) return null;

  const sectionDefinition = getSectionDefinition(section.type);
  const selectedBlock = selection.kind === "block"
    ? section.blocks.find(({ id }) => id === selection.blockId)
    : undefined;
  const blockDefinition = selectedBlock ? getBlockDefinition(selectedBlock.type) : undefined;
  const controls = selectedBlock ? blockDefinition?.controls ?? [] : sectionDefinition?.controls ?? [];
  const settings = selectedBlock?.settings ?? section.settings;

  useEffect(() => {
    if (!selectedBlock || !requestedFieldKey) return;
    bodyRef.current
      ?.querySelector<HTMLElement>(
        `[data-editor-control-key="${requestedFieldKey}"] input,
         [data-editor-control-key="${requestedFieldKey}"] textarea,
         [data-editor-control-key="${requestedFieldKey}"] select`,
      )
      ?.focus();
  }, [selectedBlock, requestedFieldKey, focusRequestId]);

  const update = (key: string, value: unknown) => {
    if (selectedBlock) {
      onCommand({
        type: "update-block-setting",
        region: selection.region,
        sectionId: section.id,
        blockId: selectedBlock.id,
        key,
        value,
      });
      return;
    }

    onCommand({
      type: "update-section-setting",
      region: selection.region,
      sectionId: section.id,
      key,
      value,
    });
  };

  const heading = selectedBlock
    ? `${title(selectedBlock.type)} block settings`
    : `${title(section.type)} settings`;

  return (
    <aside className="flex h-full min-h-0 flex-col bg-white" aria-label="Section settings">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[#eeeeee] px-3">
        <button
          type="button"
          aria-label="Back to page hierarchy"
          onClick={() => onSelect(null)}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[#6d7175] transition hover:bg-[#f1f1f1] hover:text-[#202223]"
        >
          <ArrowLeft size={16} strokeWidth={1.8} />
        </button>
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-[#8c9196]">{selectedBlock ? title(section.type) : "Section"}</p>
          <h1 className="mt-0.5 truncate text-[13px] font-semibold text-[#303030]">{heading}</h1>
        </div>
      </header>

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto">
        {selectedBlock && (
          <div className="border-b border-[#eeeeee] p-2">
            <button
              type="button"
              onClick={() => onSelect({ kind: "section", region: selection.region, sectionId: section.id })}
              className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[11px] font-medium text-[#616161] transition hover:bg-[#f6f6f7] hover:text-[#202223]"
            >
              <ArrowLeft size={13} />
              {title(section.type)}
            </button>
          </div>
        )}

        <div className="px-4 py-4">
          {controls.length > 0 ? (
            <SettingGroups
              controls={controls}
              settings={settings}
              catalog={catalog}
              upload={upload}
              dynamicSources={dynamicSources}
              onChange={update}
            />
          ) : (
            <div className="py-12 text-center">
              <p className="text-[12px] font-medium text-[#616161]">No settings</p>
              <p className="mx-auto mt-1 max-w-[220px] text-[11px] leading-5 text-[#9a9a9a]">This item doesn&apos;t have additional settings.</p>
            </div>
          )}
        </div>

        {!selectedBlock && section.blocks.length > 0 && (
          <section className="border-t border-[#eeeeee] px-2 py-3">
            <h2 className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8c9196]">Content</h2>
            <div className="space-y-0.5">
              {section.blocks.map((block) => (
                <button
                  type="button"
                  key={block.id}
                  onClick={() => onSelect({
                    kind: "block",
                    region: selection.region,
                    sectionId: section.id,
                    blockId: block.id,
                  })}
                  className="flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-2.5 text-left text-[12px] font-medium text-[#454f5b] transition hover:bg-[#f6f6f7] hover:text-[#202223]"
                >
                  <span className="truncate">{title(block.type)} block</span>
                  <ChevronRight size={14} className="shrink-0 text-[#a3a3a3]" />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
