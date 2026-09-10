import { useState, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Layers3,
  Palette,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import clsx from "clsx";

import {
  createStorefrontTemplate,
  type StorefrontDocument,
  type StorefrontTemplateId,
} from "@jelly/storefront-schema";
import {
  createPresetSection,
  listSectionPresets,
  type RegionName,
} from "@jelly/storefront-registry";
import { isRenderableHomeSection } from "@jelly/storefront-renderer";

import type {
  EditorCommand,
  EditorSelection,
} from "../model/types";
import {
  dragReorderCommand,
  type DragTreeItem,
} from "./drag-reorder";

const labels: Record<string, string> = {
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

const blockLabels: Record<string, string> = {
  heading: "Heading",
  text: "Text",
  button: "Button",
  image: "Image",
};

function SortableTreeItem({
  id,
  label,
  item,
  children,
  nested = false,
}: {
  id: string;
  label: string;
  item: DragTreeItem;
  children: ReactNode;
  nested?: boolean;
}) {
  const sortable = useSortable({
    id,
    data: item,
  });

  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(
          sortable.transform
        ),
        transition: sortable.transition,
      }}
      className={clsx(
        "group/sortable flex items-stretch",
        nested && "ml-5 border-l border-[#eeeeee] pl-1",
        sortable.isDragging &&
          "relative z-20 opacity-70"
      )}
    >
      <button
        type="button"
        aria-label={`Drag ${label}`}
        {...sortable.attributes}
        {...sortable.listeners}
        className="flex w-6 shrink-0 cursor-grab items-center justify-center rounded-md text-[#b1b1b1] opacity-0 transition hover:bg-[#eeeeee] hover:text-[#616161] group-hover/sortable:opacity-100 focus:opacity-100 active:cursor-grabbing"
      >
        <GripVertical size={13} />
      </button>

      <div className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}

export function PageHierarchy({
  document,
  activePageId,
  onPageSelect,
  selection,
  onSelect,
  onCommand,
}: {
  document: StorefrontDocument;
  activePageId: string;
  onPageSelect(pageId: string): void;
  selection: EditorSelection;
  onSelect(selection: EditorSelection): void;
  onCommand(command: EditorCommand): void;
}) {
  const [showSectionPicker, setShowSectionPicker] =
    useState(false);
  const [showPageForm, setShowPageForm] =
    useState(false);
  const [pageTitle, setPageTitle] =
    useState("");
  const [showTemplatePicker, setShowTemplatePicker] =
    useState(false);
  const activePage =
    document.pages.find(
      (page) => page.id === activePageId
    ) ?? document.pages[0];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter:
        sortableKeyboardCoordinates,
    })
  );

  const presets = listSectionPresets().filter(
    (preset) =>
      isRenderableHomeSection(
        preset.sectionType
      )
  );

  const addSection = (presetId: string) => {
    const section = createPresetSection(
      presetId,
      () => crypto.randomUUID()
    );

    onCommand({
      type: "add-section",
      region: "template",
      toIndex:
        document.regions.template.length,
      section,
    });

    setShowSectionPicker(false);

    onSelect({
      kind: "section",
      region: "template",
      sectionId: section.id,
    });
  };

  const addPage = () => {
    const title = pageTitle.trim();
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!title || !slug) return;

    const page = {
      id: crypto.randomUUID(),
      type: "custom" as const,
      title,
      slug,
      system: false,
      sections: [],
    };

    onCommand({
      type: "add-page",
      page,
    });
    onPageSelect(page.id);
    setPageTitle("");
    setShowPageForm(false);
  };

  const applyTemplate = (
    templateId: StorefrontTemplateId,
  ) => {
    const template = createStorefrontTemplate(
      templateId,
      document.storeId,
    );
    if (
      !window.confirm(
        "Replace the current storefront with this template? You can undo this change before publishing.",
      )
    ) {
      return;
    }
    onCommand({
      type: "replace-document",
      document: template,
    });
    onPageSelect(template.pages[0].id);
    setShowTemplatePicker(false);
  };

  const onDragEnd = (
    event: DragEndEvent
  ) => {
    if (!event.over) return;

    const active = event.active.data
      .current as
      | DragTreeItem
      | undefined;

    const over = event.over.data
      .current as
      | DragTreeItem
      | undefined;

    if (!active || !over) return;

    const orderedIds =
      active.kind === "section"
        ? document.regions[
            active.region
          ].map((section) => section.id)
        : document.regions[
            active.region
          ]
            .find(
              (section) =>
                section.id ===
                active.sectionId
            )
            ?.blocks.map(
              (block) => block.id
            ) ?? [];

    const command =
      dragReorderCommand(
        active,
        over,
        orderedIds
      );

    if (command) {
      onCommand(command);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <aside
        className="flex h-full min-h-0 flex-col bg-white"
        aria-label="Store page hierarchy"
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#eeeeee] px-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-[#8c9196]">
              Page
            </p>

            <h1 className="mt-0.5 truncate text-[13px] font-semibold text-[#303030]">
              {activePage?.title ?? "Home page"}
            </h1>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-5 pt-2">
          <section className="mb-3 px-2">
            <div className="mb-1.5 flex items-center justify-between">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8c9196]">
                Pages
              </h2>
              <button
                type="button"
                aria-label="Add page"
                onClick={() => setShowPageForm(true)}
                className="grid size-6 place-items-center rounded-md text-[#616161] hover:bg-[#f1f1f1] hover:text-[#202223]"
              >
                <Plus size={15} />
              </button>
            </div>
            <div className="space-y-0.5">
              {document.pages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  aria-label={page.title}
                  aria-current={page.id === activePageId ? "page" : undefined}
                  onClick={() => onPageSelect(page.id)}
                  className={clsx(
                    "flex h-8 w-full items-center rounded-md px-2 text-left text-[12px] font-medium",
                    page.id === activePageId
                      ? "bg-[#eeeeee] text-[#202223]"
                      : "text-[#616161] hover:bg-[#f6f6f7]"
                  )}
                >
                  <span className="truncate">{page.title}</span>
                  {page.system && (
                    <span className="ml-auto text-[10px] text-[#8c9196]">
                      System
                    </span>
                  )}
                </button>
              ))}
            </div>
            {showPageForm && (
              <form
                className="mt-2 rounded-lg border border-[#d9d9d9] bg-[#fafafa] p-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  addPage();
                }}
              >
                <label className="sr-only" htmlFor="new-page-title">
                  Page title
                </label>
                <input
                  id="new-page-title"
                  aria-label="Page title"
                  value={pageTitle}
                  onChange={(event) => setPageTitle(event.target.value)}
                  placeholder="Page title"
                  className="h-8 w-full rounded-md border border-[#c9cccf] bg-white px-2 text-[12px] outline-none focus:border-[#303030]"
                  autoFocus
                />
                <div className="mt-2 flex justify-end gap-1">
                  <button type="button" onClick={() => setShowPageForm(false)} className="h-7 px-2 text-[11px] font-medium text-[#616161]">
                    Cancel
                  </button>
                  <button type="submit" className="h-7 rounded-md bg-[#303030] px-2.5 text-[11px] font-semibold text-white">
                    Create page
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="mb-3 px-2">
            <button
              type="button"
              onClick={() => setShowTemplatePicker((open) => !open)}
              className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[12px] font-medium text-[#454f5b] hover:bg-[#f6f6f7] hover:text-[#202223]"
            >
              <Layers3 size={14} className="text-[#6d7175]" />
              Templates
              <ChevronDown
                size={14}
                className={clsx(
                  "ml-auto transition",
                  showTemplatePicker && "rotate-180",
                )}
              />
            </button>
            {showTemplatePicker && (
              <div className="mt-1 grid gap-1">
                {[
                  {
                    id: "bakes" as const,
                    name: "Bakes",
                    description: "Warm editorial storefront",
                  },
                  {
                    id: "essentials" as const,
                    name: "Essentials",
                    description: "Clean product catalog",
                  },
                ].map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template.id)}
                    className="rounded-lg border border-[#e3e3e3] bg-[#fafafa] px-2.5 py-2 text-left hover:border-[#b9b9b9] hover:bg-white"
                  >
                    <span className="block text-[12px] font-semibold text-[#303030]">
                      {template.name}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-[#6d7175]">
                      {template.description}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Theme */}
          <button
            type="button"
            onClick={() =>
              onSelect({
                kind: "theme",
              })
            }
            className={clsx(
              "flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[12px] font-medium transition",
              selection?.kind === "theme"
                ? "bg-[#eeeeee] text-[#202223]"
                : "text-[#454f5b] hover:bg-[#f6f6f7]"
            )}
          >
            <Palette
              size={15}
              strokeWidth={1.8}
              className="text-[#6d7175]"
            />

            <span>Theme settings</span>
          </button>

          <div className="my-3 h-px bg-[#eeeeee]" />

          {(
            [
              "header",
              "template",
              "footer",
            ] as RegionName[]
          ).map((region) => {
            const sections =
              document.regions[region];

            return (
              <section
                key={region}
                className="mb-5"
              >
                <div className="mb-1.5 flex h-6 items-center px-2">
                  <h2 className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8c9196]">
                    {region === "template"
                      ? "Template"
                      : region[0].toUpperCase() +
                        region.slice(1)}
                  </h2>
                </div>

                <SortableContext
                  items={sections.map(
                    (section) =>
                      `section:${region}:${section.id}`
                  )}
                  strategy={
                    verticalListSortingStrategy
                  }
                >
                  <div
                    data-testid={
                      region === "template"
                        ? "template-hierarchy"
                        : undefined
                    }
                    className="space-y-0.5"
                  >
                    {sections.map(
                      (
                        section,
                        index
                      ) => {
                        const label =
                          labels[
                            section.type
                          ] ??
                          section.type;

                        const sectionSelected =
                          selection?.kind ===
                            "section" &&
                          selection.region ===
                            region &&
                          selection.sectionId ===
                            section.id;

                        const childSelected =
                          selection?.kind ===
                            "block" &&
                          selection.region ===
                            region &&
                          selection.sectionId ===
                            section.id;

                        const expanded =
                          sectionSelected ||
                          childSelected;

                        return (
                          <div
                            key={section.id}
                          >
                            <SortableTreeItem
                              id={`section:${region}:${section.id}`}
                              label={`${label} section`}
                              item={{
                                kind: "section",
                                region,
                                id: section.id,
                              }}
                            >
                              <div
                                data-testid="hierarchy-row"
                                className={clsx(
                                  "group/row flex min-h-9 items-center rounded-lg transition",
                                  expanded
                                    ? "bg-[#eeeeee]"
                                    : "hover:bg-[#f6f6f7]"
                                )}
                              >
                                <button
                                  type="button"
                                  aria-label={`${label} section`}
                                  aria-current={
                                    sectionSelected
                                      ? "true"
                                      : undefined
                                  }
                                  onClick={() =>
                                    onSelect(
                                      {
                                        kind: "section",
                                        region,
                                        sectionId:
                                          section.id,
                                      }
                                    )
                                  }
                                  className={clsx(
                                    "flex min-w-0 flex-1 items-center gap-2 px-1.5 py-2 text-left text-[12px] font-medium",
                                    expanded
                                      ? "text-[#202223]"
                                      : "text-[#454f5b]"
                                  )}
                                >
                                  <Layers3
                                    size={14}
                                    strokeWidth={
                                      1.8
                                    }
                                    className="shrink-0 text-[#8c9196]"
                                  />

                                  <span className="truncate">
                                    {label}
                                  </span>
                                </button>

                                <div className="flex shrink-0 items-center pr-1">
                                  {/* Visibility stays easy to access */}
                                  <button
                                    type="button"
                                    aria-label={`${
                                      section.enabled
                                        ? "Hide"
                                        : "Show"
                                    } ${label}`}
                                    onClick={() =>
                                      onCommand(
                                        {
                                          type: "toggle-section",
                                          region,
                                          sectionId:
                                            section.id,
                                        }
                                      )
                                    }
                                    className="grid size-7 place-items-center rounded-md text-[#8c9196] transition hover:bg-white hover:text-[#454f5b]"
                                  >
                                    {section.enabled ? (
                                      <Eye
                                        size={
                                          13
                                        }
                                      />
                                    ) : (
                                      <EyeOff
                                        size={
                                          13
                                        }
                                      />
                                    )}
                                  </button>

                                  {/* Secondary actions */}
                                  <div className="hidden items-center group-hover/row:flex group-focus-within/row:flex">
                                    <button
                                      type="button"
                                      aria-label={`Move ${label} up`}
                                      disabled={
                                        index ===
                                        0
                                      }
                                      onClick={() =>
                                        onCommand(
                                          {
                                            type: "move-section",
                                            region,
                                            sectionId:
                                              section.id,
                                            toIndex:
                                              index -
                                              1,
                                          }
                                        )
                                      }
                                      className="grid size-7 place-items-center rounded-md text-[#8c9196] hover:bg-white hover:text-[#454f5b] disabled:opacity-25"
                                    >
                                      <ChevronUp
                                        size={
                                          13
                                        }
                                      />
                                    </button>

                                    <button
                                      type="button"
                                      aria-label={`Move ${label} down`}
                                      disabled={
                                        index ===
                                        sections.length -
                                          1
                                      }
                                      onClick={() =>
                                        onCommand(
                                          {
                                            type: "move-section",
                                            region,
                                            sectionId:
                                              section.id,
                                            toIndex:
                                              index +
                                              1,
                                          }
                                        )
                                      }
                                      className="grid size-7 place-items-center rounded-md text-[#8c9196] hover:bg-white hover:text-[#454f5b] disabled:opacity-25"
                                    >
                                      <ChevronDown
                                        size={
                                          13
                                        }
                                      />
                                    </button>

                                    <button
                                      type="button"
                                      aria-label={`Duplicate ${label}`}
                                      onClick={() =>
                                        onCommand(
                                          {
                                            type: "duplicate-section",
                                            region,
                                            sectionId:
                                              section.id,
                                            createId:
                                              () =>
                                                crypto.randomUUID(),
                                          }
                                        )
                                      }
                                      className="grid size-7 place-items-center rounded-md text-[#8c9196] hover:bg-white hover:text-[#454f5b]"
                                    >
                                      <Copy
                                        size={
                                          13
                                        }
                                      />
                                    </button>

                                    {region ===
                                      "template" && (
                                      <button
                                        type="button"
                                        aria-label={`Delete ${label}`}
                                        onClick={() =>
                                          onCommand(
                                            {
                                              type: "remove-section",
                                              region,
                                              sectionId:
                                                section.id,
                                            }
                                          )
                                        }
                                        className="grid size-7 place-items-center rounded-md text-[#8c9196] hover:bg-[#fff1f0] hover:text-[#b42318]"
                                      >
                                        <Trash2
                                          size={
                                            13
                                          }
                                        />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </SortableTreeItem>

                            {section.blocks
                                .length >
                                0 && (
                                <SortableContext
                                  items={section.blocks.map(
                                    (
                                      block
                                    ) =>
                                      `block:${region}:${section.id}:${block.id}`
                                  )}
                                  strategy={
                                    verticalListSortingStrategy
                                  }
                                >
                                  <div className="mt-0.5 space-y-0.5">
                                    {section.blocks.map(
                                      (
                                        block
                                      ) => {
                                        const blockLabel =
                                          blockLabels[
                                            block
                                              .type
                                          ] ??
                                          block.type;

                                        const isBlockSelected =
                                          selection?.kind ===
                                            "block" &&
                                          selection.blockId ===
                                            block.id;

                                        return (
                                          <SortableTreeItem
                                            key={
                                              block.id
                                            }
                                            id={`block:${region}:${section.id}:${block.id}`}
                                            label={`${blockLabel} block in ${label}`}
                                            item={{
                                              kind: "block",
                                              region,
                                              sectionId:
                                                section.id,
                                              id: block.id,
                                            }}
                                            nested
                                          >
                                            <button
                                              type="button"
                                              aria-label={`${blockLabel} block in ${label}`}
                                              aria-current={
                                                isBlockSelected
                                                  ? "true"
                                                  : undefined
                                              }
                                              onClick={() =>
                                                onSelect(
                                                  {
                                                    kind: "block",
                                                    region,
                                                    sectionId:
                                                      section.id,
                                                    blockId:
                                                      block.id,
                                                  }
                                                )
                                              }
                                              className={clsx(
                                                "flex min-h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[11px] font-medium transition",
                                                isBlockSelected
                                                  ? "bg-[#eeeeee] text-[#202223]"
                                                  : "text-[#616161] hover:bg-[#f6f6f7]"
                                              )}
                                            >
                                              <span className="size-1.5 shrink-0 rounded-full bg-[#c9c9c9]" />

                                              <span className="truncate">
                                                {
                                                  blockLabel
                                                }
                                              </span>
                                            </button>
                                          </SortableTreeItem>
                                        );
                                      }
                                    )}
                                  </div>
                                </SortableContext>
                              )}
                          </div>
                        );
                      }
                    )}
                  </div>
                </SortableContext>

                {region ===
                  "template" && (
                  <button
                    type="button"
                    onClick={() =>
                      setShowSectionPicker(
                        true
                      )
                    }
                    className="mt-2 flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-[12px] font-medium text-[#454f5b] transition hover:bg-[#f6f6f7] hover:text-[#202223]"
                  >
                    <Plus
                      size={15}
                      strokeWidth={1.8}
                    />

                    Add section
                  </button>
                )}
              </section>
            );
          })}
        </div>

        {/* Section picker */}
        {showSectionPicker && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 p-4 backdrop-blur-[1px]"
            role="presentation"
            onMouseDown={() =>
              setShowSectionPicker(false)
            }
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-section-title"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
              className="flex max-h-[min(680px,85vh)] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-[#dedede] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.18)]"
            >
              <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#eeeeee] px-4">
                <div>
                  <p className="text-[10px] font-medium text-[#8c9196]">
                    Home page
                  </p>

                  <h2
                    id="add-section-title"
                    className="mt-0.5 text-[14px] font-semibold text-[#303030]"
                  >
                    Add section
                  </h2>
                </div>

                <button
                  type="button"
                  aria-label="Close section picker"
                  onClick={() =>
                    setShowSectionPicker(
                      false
                    )
                  }
                  className="grid size-8 place-items-center rounded-lg text-[#6d7175] hover:bg-[#f1f1f1] hover:text-[#202223]"
                >
                  <X size={16} />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {(
                  [
                    "banners",
                    "products",
                    "content",
                    "marketing",
                  ] as const
                ).map((category) => {
                  const grouped =
                    presets.filter(
                      (preset) =>
                        preset.category ===
                        category
                    );

                  if (
                    grouped.length === 0
                  ) {
                    return null;
                  }

                  return (
                    <section
                      key={category}
                      className="mb-4"
                    >
                      <h3 className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8c9196]">
                        {category[0].toUpperCase() +
                          category.slice(
                            1
                          )}
                      </h3>

                      <div className="space-y-0.5">
                        {grouped.map(
                          (preset) => (
                            <button
                              key={
                                preset.id
                              }
                              type="button"
                              aria-label={`Add ${preset.label}`}
                              onClick={() =>
                                addSection(
                                  preset.id
                                )
                              }
                              className="flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left transition hover:bg-[#f4f4f5]"
                            >
                              <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[#f1f1f1] text-[#6d7175]">
                                <Layers3
                                  size={
                                    14
                                  }
                                />
                              </span>

                              <span className="text-[12px] font-medium text-[#303030]">
                                {
                                  preset.label
                                }
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </aside>
    </DndContext>
  );
}
