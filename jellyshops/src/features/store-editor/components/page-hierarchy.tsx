import clsx from "clsx";
import type { StorefrontDocument } from "@jelly/storefront-schema";
import type { EditorCommand, EditorSelection } from "../model/types";

const labels: Record<string, string> = {
  "announcement-bar": "Announcement bar",
  header: "Header",
  hero: "Hero",
  "product-grid": "Product grid",
  "featured-collection": "Featured collection",
  "rich-text": "Rich text",
  "image-with-text": "Image with text",
  "image-text": "Image with text",
  multicolumn: "Multicolumn",
  newsletter: "Newsletter",
  "spacer-divider": "Spacer / divider",
  spacer: "Spacer / divider",
  divider: "Spacer / divider",
  footer: "Footer",
};

/**
 * V3 compatibility hierarchy only.
 *
 * The canonical Online Store editor uses TemplateHierarchy against normalized
 * templates. This component intentionally no longer creates pages, applies
 * starter templates, or replaces the whole StorefrontDocument.
 */
export function PageHierarchy({
  document,
  activePageId,
  onPageSelect,
  selection,
  onSelect,
}: {
  document: StorefrontDocument;
  activePageId: string;
  onPageSelect(pageId: string): void;
  selection: EditorSelection;
  onSelect(selection: EditorSelection): void;
  onCommand(command: EditorCommand): void;
}) {
  const activePage = document.pages.find((page) => page.id === activePageId) ?? document.pages[0];

  return (
    <aside className="flex h-full min-h-0 flex-col bg-white" aria-label="Legacy page hierarchy">
      <div className="h-14 shrink-0 border-b border-[#eeeeee] px-4 py-2.5">
        <p className="text-[10px] font-medium text-[#8c9196]">Legacy page preview</p>
        <h1 className="mt-0.5 truncate text-[13px] font-semibold text-[#303030]">{activePage?.title ?? "Home page"}</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <section className="mb-4">
          <h2 className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8c9196]">Pages</h2>
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
                  page.id === activePageId ? "bg-[#eeeeee] text-[#202223]" : "text-[#616161] hover:bg-[#f6f6f7]",
                )}
              >
                <span className="truncate">{page.title}</span>
                {page.system && <span className="ml-auto text-[10px] text-[#8c9196]">System</span>}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8c9196]">Sections</h2>
          <div className="space-y-0.5">
            {(activePage?.sections ?? []).map((section) => {
              const selected = selection?.kind === "section" && selection.sectionId === section.id;
              const label = labels[section.type] ?? section.type;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-label={`${label} section`}
                  onClick={() => onSelect({ kind: "section", region: "template", sectionId: section.id })}
                  className={clsx(
                    "flex h-8 w-full items-center rounded-md px-2 text-left text-[12px] font-medium",
                    selected ? "bg-[#eeeeee] text-[#202223]" : "text-[#616161] hover:bg-[#f6f6f7]",
                  )}
                >
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
  );
}
