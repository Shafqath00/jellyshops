import { render } from "@testing-library/react";
import axe, { type AxeResults } from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { getBlockDefinition, getSectionDefinition } from "@jelly/storefront-registry";
import { GlobalSectionPanel } from "./global-section-panel";
import { SettingGroups } from "./inspector/setting-groups";
import { LinkedPaddingControl, isPaddingControl } from "./inspector/linked-padding";
import { OptionalColorControl } from "./inspector/style-controls";
import { SectionLibrary } from "./section-library";
import { TemplateHierarchy } from "./template-hierarchy";
import { ThemeLibraryPanel } from "./theme-library-panel";
import { WorkspaceToolbar } from "./workspace-toolbar";
import { ShopProvider } from "@/contexts/shop-context";
import { createRepository } from "@/lib/repository";
import { StorefrontPasswordPage } from "@/features/storefront-access/password-page";
import { ThemeCartDrawer } from "@/features/storefront/components/theme-cart-drawer";
import { ProductOptionsSection } from "../../../../packages/storefront-renderer/src/sections/product-sections";

/**
 * Automated WCAG A/AA checks (axe) on the editor's panels. jsdom has no layout, so
 * colour contrast and other layout rules are checked in the browser instead.
 */
async function violations(container: HTMLElement): Promise<string[]> {
  const results: AxeResults = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] }, rules: { "color-contrast": { enabled: false }, region: { enabled: false }, "landmark-one-main": { enabled: false }, "page-has-heading-one": { enabled: false } } });
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(" | ")}`);
}

const catalog = { products: [], collections: [] } as never;
const section = (type: string) => getSectionDefinition(type)!;

describe("editor accessibility (axe)", () => {
  it("the page tree", async () => {
    const template = { id: "home", name: "Home", layout: { sections: [
      { kind: "inline", section: { id: "a", type: "custom-content", enabled: true, settings: {}, blocks: [{ id: "h", type: "heading", enabled: true, settings: { text: "Hello" } }, { id: "g", type: "group", enabled: false, settings: {}, blocks: [{ id: "b", type: "button", enabled: true, settings: { label: "Go" } }] }] } },
      { kind: "inline", section: { id: "f", type: "faq", enabled: false, settings: {}, blocks: [] } },
    ] } };
    const { container } = render(<TemplateHierarchy template={template} globalSections={{}} selection={null} onSelect={vi.fn()} onMove={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} onBlockAction={vi.fn()} onAddSection={vi.fn()} onAddBlock={vi.fn()} />);
    expect(await violations(container)).toEqual([]);
  });

  it("section settings (content, layout, appearance, advanced)", async () => {
    const { container } = render(<SettingGroups controls={section("custom-content").controls} settings={{ stylePaddingTop: 8 }} catalog={catalog} onChange={vi.fn()} onPatch={vi.fn()} />);
    expect(await violations(container)).toEqual([]);
  });

  it("block settings with the padding box and colour fields", async () => {
    const { container } = render(<SettingGroups controls={getBlockDefinition("button")!.controls} settings={{ blockPaddingTop: 4, blockPaddingBottom: 4, blockPaddingLeft: 4, blockPaddingRight: 4, blockBackgroundColor: "#112233" }} catalog={catalog} onChange={vi.fn()} onPatch={vi.fn()} />);
    expect(await violations(container)).toEqual([]);
  });

  it("the colour field and the padding box on their own", async () => {
    const padding = getBlockDefinition("heading")!.controls.filter(isPaddingControl);
    const { container } = render(<><OptionalColorControl label="Text colour" value="#112233" onChange={vi.fn()} /><LinkedPaddingControl controls={padding} values={{}} onPatch={vi.fn()} /></>);
    expect(await violations(container)).toEqual([]);
  });

  it("saved looks, shared sections and the section library", async () => {
    const look = { id: "l", name: "Winter", themeId: "jelly-avenue", themeVersion: "1.0.0", settings: {} };
    const section = { id: "s", type: "rich-text", enabled: true, settings: {}, blocks: [] };
    const { container } = render(<>
      <ThemeLibraryPanel looks={[look]} currentThemeName="Jelly Minimal" themeName={() => "Jelly Avenue"} error="Something went wrong" onSave={vi.fn()} onApply={vi.fn()} onRename={vi.fn()} onDelete={vi.fn()} />
      <GlobalSectionPanel globalSections={[{ id: "g", name: "Promo", section }]} localSection={section} onMakeGlobal={vi.fn()} onInsertGlobal={vi.fn()} onDetachGlobal={vi.fn()} onSaveToLibrary={vi.fn()} />
      <SectionLibrary presets={[{ id: "p", name: "Story", section }]} builtIns={[{ id: "rich-text", name: "Rich text", category: "content" }]} onInsertPreset={vi.fn()} onInsertBuiltIn={vi.fn()} onDeletePreset={vi.fn()} />
    </>);
    expect(await violations(container)).toEqual([]);
  });

  it("the editor toolbar", async () => {
    const { container } = render(<WorkspaceToolbar themeName="Jelly Minimal" pagePicker={<span>Home</span>} actions={<button type="button">Publish</button>} viewport="desktop" inspector={false} themeSelected={false} canUndo canRedo={false} onBack={vi.fn()} onSections={vi.fn()} onTheme={vi.fn()} onViewport={vi.fn()} onInspector={vi.fn()} onUndo={vi.fn()} onRedo={vi.fn()} />);
    expect(await violations(container)).toEqual([]);
  });

  it("the password page, with and without an error", async () => {
    const { container } = render(<StorefrontPasswordPage storeSlug="shop" storeName="Oak & Ash" message="Opening soon" />);
    expect(await violations(container)).toEqual([]);
  });

  it("the slide-out bag, empty and with items", async () => {
    localStorage.clear();
    const repository = createRepository(localStorage);
    const cart = repository.createCart("sweet-bakes");
    repository.updateCartItem(cart.id, "vanilla-cake", 2);
    const { container } = render(<ShopProvider><ThemeCartDrawer storeSlug="sweet-bakes" open onClose={vi.fn()} /></ShopProvider>);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(await violations(document.body)).toEqual([]);
  });

  it("colour swatches on a product page", async () => {
    const presentation = { product: { id: "p", title: "Chair", description: "", imageUrl: "", options: [{ id: "c", name: "Colour", required: true, display: "color", values: [{ id: "a", label: "Oak", selected: true, available: true, color: "#c8a36a" }, { id: "b", label: "Ash", selected: false, available: false, color: "#dddddd" }] }] }, selectOption: vi.fn(), addToCart: vi.fn() };
    const context = { mode: "published", commerce: { getProducts: async () => [] }, page: { pageType: "product", resource: { data: { productPresentation: presentation } } } } as never;
    const { container } = render(<ProductOptionsSection context={context} />);
    expect(await violations(container)).toEqual([]);
  });
});
