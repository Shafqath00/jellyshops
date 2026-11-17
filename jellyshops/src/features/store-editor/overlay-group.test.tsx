import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPresetSection, listSectionDefinitionsForGroup, listSectionDefinitionsForPage, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import { RegistrySectionRenderer, cartDrawerSectionSettings, popupDue } from "@jelly/storefront-renderer";
import type { RuntimeStorefrontSnapshotV4, SectionNode } from "@jelly/storefront-schema";
import { expandRawRuntimeLayout } from "@/features/storefront/resource-loader";
import { TemplateHierarchy } from "./components/template-hierarchy";
import { addToGroup } from "./section-group-editing";

/** Theme plan T6 part 2: the overlay group (pop-up, slide-out bag). */
const popup = (): SectionNode => ({ ...createPresetSection("popup", () => "popup-1"), id: "popup-1" });
const page = { pageType: "home" as const, resource: null };

afterEach(() => { vi.useRealTimers(); window.localStorage.clear(); });

describe("overlay group", () => {
  it("offers the pop-up and slide-out bag in the overlay group only", () => {
    expect(listSectionDefinitionsForGroup("overlay").map((definition) => definition.type)).toEqual(expect.arrayContaining(["popup", "cart-drawer"]));
    expect(listSectionDefinitionsForPage("home").map((definition) => definition.type)).not.toContain("popup");
    expect(listSectionDefinitionsForGroup("footer").map((definition) => definition.type)).not.toContain("popup");
    expect(validateSectionAgainstRegistry(popup(), { group: "overlay" })).toEqual([]);
    expect(validateSectionAgainstRegistry(popup(), { group: "footer" }).map((issue) => issue.code)).toContain("SECTION_NOT_ALLOWED_IN_GROUP");
  });

  it("lays overlay sections out from the saved groups", () => {
    const globalSections = { "g-pop": { id: "g-pop", section: popup() } } as unknown as RuntimeStorefrontSnapshotV4["globalSections"];
    const layout = expandRawRuntimeLayout({ globalSections, sectionGroups: { header: [], footer: [], overlay: ["g-pop"] } }, { layout: { sections: [] } });
    expect(layout.overlay.map((section) => section.type)).toEqual(["popup"]);
    expect(expandRawRuntimeLayout({ globalSections }, { layout: { sections: [] } }).overlay).toEqual([]);
    expect(addToGroup({ header: [], footer: [], overlay: ["a"] }, "overlay", "b", "popup", () => undefined).overlay).toEqual(["a", "b"]);
  });

  it("opens the pop-up after its delay, closes on Escape and stays closed for the chosen days", () => {
    vi.useFakeTimers();
    const { unmount } = render(<div data-jelly-theme="jelly-signature"><RegistrySectionRenderer section={popup()} mode="published" page={page} storeSlug="shop" commerce={{ getProducts: async () => [] }} region="footer" /></div>);
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => { vi.advanceTimersByTime(5000); });
    const dialog = screen.getByRole("dialog", { name: /Get 10% off/ });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();
    // Closed just now: not shown again on the next page.
    render(<div data-jelly-theme="jelly-signature"><RegistrySectionRenderer section={popup()} mode="published" page={page} storeSlug="shop" commerce={{ getProducts: async () => [] }} region="footer" /></div>);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(popupDue(Date.now() - 15 * 24 * 60 * 60 * 1000, 14)).toBe(true);
    expect(popupDue(null, 14)).toBe(true);
  });

  it("draws overlay sections in place in the editor", () => {
    render(<div data-jelly-theme="jelly-signature"><RegistrySectionRenderer section={popup()} mode="editor" page={page} commerce={{ getProducts: async () => [] }} region="footer" /></div>);
    expect(screen.getByText(/Pop-up: opens 5 seconds after a shopper arrives/)).toBeInTheDocument();
    expect(screen.getByText("Get 10% off your first order")).toBeInTheDocument();
    const bag: SectionNode = { id: "bag", type: "cart-drawer", enabled: true, settings: { heading: "Your basket", freeDeliveryFrom: 50, style: "sheet" }, blocks: [] };
    expect(cartDrawerSectionSettings(bag)).toEqual({ variant: "sheet", heading: "Your basket", emptyText: undefined, freeDeliveryFromMinor: 5000 });
    render(<div data-jelly-theme="jelly-signature"><RegistrySectionRenderer section={bag} mode="editor" page={page} commerce={{ getProducts: async () => [] }} region="footer" /></div>);
    expect(screen.getByText("Your basket")).toBeInTheDocument();
    const { container } = render(<RegistrySectionRenderer section={bag} mode="published" page={page} commerce={{ getProducts: async () => [] }} region="footer" />);
    expect(container.querySelector(".jelly-cart-drawer-preview")).toBeNull();
  });

  it("shows an Overlays area in the page tree", () => {
    const labels = { "g-pop": { id: "g-pop", name: "Pop-up", sectionType: "popup", sectionId: "popup-1" } };
    render(<TemplateHierarchy template={{ id: "home", name: "Home", layout: { sections: [] } } as never} globalSections={labels} selection={null} onSelect={vi.fn()} onAddSection={vi.fn()}
      sectionGroups={{ header: [], footer: [], overlay: ["g-pop"] }} onGroupRemove={vi.fn()} onGroupMove={vi.fn()} />);
    const overlays = screen.getByRole("heading", { name: /Overlays/ }).closest("section")!;
    expect(within(overlays).getByRole("button", { name: "Pop-up" })).toBeInTheDocument();
    expect(within(overlays).getByRole("button", { name: "Remove Pop-up from the overlay" })).toBeInTheDocument();
    expect(within(overlays).getByRole("button", { name: "Add section to Overlays" })).toBeInTheDocument();
  });
});
