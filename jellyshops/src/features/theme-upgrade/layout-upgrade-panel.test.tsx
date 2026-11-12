import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { LayoutUpgradePanel, type LayoutUpgradeOffer, type LayoutUpgradePreview } from "./layout-upgrade-panel";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const offer = (over: Partial<LayoutUpgradeOffer> = {}): LayoutUpgradeOffer => ({
  themeId: "jelly-resthaven", draft: { revision: 2, label: "Showroom layout (5 November 2026)", recognised: true },
  current: { revision: 4, label: "Current layout" }, behind: true, generation: 7, lastUpgrade: null, ...over,
});
const preview = (over: Partial<LayoutUpgradePreview> = {}): LayoutUpgradePreview => ({
  from: { revision: 2, label: "Showroom layout" }, to: { revision: 4, label: "Current layout" }, generation: 7,
  shared: { added: [], carried: [{ section: "Header", settings: ["showAccount"], blocks: false }], kept: [] },
  pages: [{ page: "Home page", added: ["Collection list"], carried: [{ section: "Hero banner", settings: ["heading"], blocks: false }], kept: ["Rich text"], removed: ["Image gallery"], skipped: [] }],
  problems: [], ...over,
});

describe("Store designs > Page layout", () => {
  it("draws nothing when the draft already uses the current layout", async () => {
    const fetcher = vi.fn(async () => json({ offer: offer({ behind: false, draft: { revision: 4, label: "Current layout", recognised: false } }) }));
    const view = render(<LayoutUpgradePanel storeId="s" token="t" fetcher={fetcher as never} />);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(view.container.innerHTML).toBe("");
  });

  it("draws nothing when the backend has no layout upgrades", async () => {
    const fetcher = vi.fn(async () => json({ error: { message: "Not found" } }, 404));
    const view = render(<LayoutUpgradePanel storeId="s" token="t" fetcher={fetcher as never} />);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(view.container.innerHTML).toBe("");
  });

  it("previews the changes, upgrades with the preview's generation, then offers undo", async () => {
    const calls: Array<[string, unknown]> = [];
    let current = offer();
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push([url, init?.body ? JSON.parse(String(init.body)) : undefined]);
      if (url.endsWith("/preview")) return json({ preview: preview() });
      if (url.endsWith("/apply")) { current = offer({ behind: false, draft: { revision: 4, label: "Current layout", recognised: false }, generation: 8, lastUpgrade: { id: "b1", fromRevision: 2, toRevision: 4, createdAt: "x" } }); return json({ revision: 4, generation: 8, backupId: "b1" }); }
      if (url.endsWith("/rollback")) { current = offer({ generation: 9 }); return json({ revision: 2, generation: 9 }); }
      return json({ offer: current });
    });
    const onChanged = vi.fn();
    const view = render(<LayoutUpgradePanel storeId="store-1" token="t" fetcher={fetcher as never} onChanged={onChanged} />);
    expect(await screen.findByText(/Showroom layout \(5 November 2026\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upgrade draft pages" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "See what changes" }));
    const changes = await screen.findByLabelText("Changes to your draft pages");
    expect(changes).toHaveTextContent("New sections: Collection list");
    expect(changes).toHaveTextContent("Your changes kept: Hero banner");
    expect(changes).toHaveTextContent("Your own sections kept (moved to the end of the page): Rich text");
    expect(changes).toHaveTextContent("Replaced (you had not changed them): Image gallery");
    expect((await axe.run(view.container)).violations).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Upgrade draft pages" }));
    expect(await screen.findByRole("status")).toHaveTextContent("now use the current layout");
    expect(calls.find(([url]) => url.endsWith("/apply"))?.[1]).toEqual({ expectedGeneration: 7 });
    expect(onChanged).toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Undo layout upgrade" }));
    expect(await screen.findByRole("status")).toHaveTextContent("back as they were");
    expect(calls.find(([url]) => url.endsWith("/rollback"))?.[1]).toEqual({ expectedGeneration: 8 });
    expect(calls[0]?.[0]).toContain("/api/stores/store-1/storefront/layout-upgrade");
  });

  it("refuses to upgrade while the preview lists problems", async () => {
    const fetcher = vi.fn(async (url: string) => url.endsWith("/preview") ? json({ preview: preview({ problems: ["Home page, hero: Unknown setting."] }) }) : json({ offer: offer() }));
    render(<LayoutUpgradePanel storeId="s" token="t" fetcher={fetcher as never} />);
    await userEvent.click(await screen.findByRole("button", { name: "See what changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unknown setting");
    expect(screen.getByRole("button", { name: "Upgrade draft pages" })).toBeDisabled();
  });
});
