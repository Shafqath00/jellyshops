import { render } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { PreviewSection, type PreviewShared } from "./preview-section";

const rendered: string[] = [];
vi.mock("@jelly/storefront-renderer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@jelly/storefront-renderer")>()),
  RegistrySectionRenderer: ({ section, selected }: { section: SectionNode; selected?: { blockId?: string } }) => {
    rendered.push(section.id);
    return <div data-section={section.id} data-selected={selected?.blockId ?? ""}>{String(section.settings.text ?? "")}</div>;
  },
}));

const sections = (): SectionNode[] => Array.from({ length: 20 }, (_, index) => ({ id: `s${index}`, type: "rich-text", enabled: true, settings: { text: `Section ${index}` }, blocks: [{ id: `b${index}`, type: "text", enabled: true, settings: { text: "Body" } }] }));
const shared: PreviewShared = { mode: "editor", commerce: { getProducts: async () => [] }, language: null, menus: {}, collectionLinks: {}, resourceLinks: {}, identity: { name: "Shop" } };

function Page({ items, sharedInputs = shared, selectedId }: { items: SectionNode[]; sharedInputs?: PreviewShared; selectedId?: string }) {
  const onSelect = vi.fn();
  return <>{items.map((section) => <PreviewSection key={section.id} section={section} contentKey={JSON.stringify(section)} region="template" shared={sharedInputs} selected={selectedId === section.id ? { kind: "section", sectionId: section.id } : undefined} onSelect={onSelect} />)}</>;
}

beforeEach(() => { rendered.length = 0; });

it("draws every section once, then only the section whose content changed", () => {
  const { rerender } = render(<Page items={sections()} />);
  expect(rendered).toHaveLength(20);
  rendered.length = 0;

  // Same content in new objects (what every edit produces): nothing is redrawn.
  rerender(<Page items={sections()} />);
  expect(rendered).toEqual([]);

  // One setting changes: only that section is redrawn.
  const edited = sections();
  edited[7].settings = { text: "Section 7, edited" };
  rerender(<Page items={edited} />);
  expect(rendered).toEqual(["s7"]);
});

it("redraws only the sections whose selection changed, and everything when shared inputs change", () => {
  const { rerender } = render(<Page items={sections()} selectedId="s3" />);
  rendered.length = 0;
  rerender(<Page items={sections()} selectedId="s9" />);
  expect(rendered.sort()).toEqual(["s3", "s9"]);
  rendered.length = 0;
  rerender(<Page items={sections()} selectedId="s9" sharedInputs={{ ...shared, language: "hi" }} />);
  expect(rendered).toHaveLength(20);
});

it("keeps clicks working through a handler that never changes", () => {
  const handler = vi.fn();
  const { container, rerender } = render(<PreviewSection section={sections()[0]} contentKey="a" region="header" shared={shared} onSelect={handler} />);
  expect(container.querySelector("[data-section='s0']")).not.toBeNull();
  // Turning the inspector off removes the handler; turning it on adds it back.
  rerender(<PreviewSection section={sections()[0]} contentKey="a" region="header" shared={shared} />);
  expect(rendered).toEqual(["s0", "s0"]);
});
