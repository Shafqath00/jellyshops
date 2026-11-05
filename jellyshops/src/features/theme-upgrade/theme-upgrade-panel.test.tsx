import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { ThemeUpgradePanel, type UpgradeOffer, type UpgradePreview } from "./theme-upgrade-panel";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const offer = (over: Partial<UpgradeOffer> = {}): UpgradeOffer => ({
  themeId: "studio", name: "Studio", generation: 4, current: { versionId: "v1", version: "1.0.0" },
  newer: [{ versionId: "v11", version: "1.1.0", createdAt: "2026-11-01" }, { versionId: "v2", version: "2.0.0", createdAt: "2026-11-02" }],
  lastUpgrade: null, ...over,
});
const preview = (over: Partial<UpgradePreview> = {}): UpgradePreview => ({ from: "1.0.0", to: "2.0.0", generation: 4, changes: [{ where: "Theme settings", what: "layout.cardStyle set to “soft”" }], problems: [], ...over });

describe("Store designs > Theme updates", () => {
  it("draws nothing for a draft on a built-in theme", async () => {
    const fetcher = vi.fn(async () => json({ offer: null }));
    const view = render(<ThemeUpgradePanel storeId="s" token="t" fetcher={fetcher as never} />);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(view.container.innerHTML).toBe("");
  });

  it("says when the draft already uses the newest version", async () => {
    render(<ThemeUpgradePanel storeId="s" token="t" fetcher={vi.fn(async () => json({ offer: offer({ newer: [] }) })) as never} />);
    expect(await screen.findByText("This is the newest version you have uploaded.")).toBeInTheDocument();
  });

  it("previews the changes first, then upgrades with the generation from the preview", async () => {
    const calls: Array<[string, unknown]> = [];
    let current = offer();
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push([url, init?.body ? JSON.parse(String(init.body)) : undefined]);
      if (url.endsWith("/preview")) return json({ preview: preview() });
      if (url.endsWith("/apply")) { current = offer({ current: { versionId: "v2", version: "2.0.0" }, newer: [], lastUpgrade: { id: "b1", fromVersion: "1.0.0", toVersion: "2.0.0", createdAt: "x" }, generation: 5 }); return json({ version: "2.0.0", generation: 5 }); }
      return json({ offer: current });
    });
    const onChanged = vi.fn();
    render(<ThemeUpgradePanel storeId="store-1" token="t" fetcher={fetcher as never} onChanged={onChanged} />);
    expect(await screen.findByLabelText("Upgrade to")).toHaveValue("v2");
    expect(screen.queryByRole("button", { name: /Upgrade draft/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "See what changes" }));
    expect(await screen.findByText(/layout.cardStyle set to/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Upgrade draft to 2.0.0" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Your draft now uses version 2.0.0");
    expect(calls.find(([url]) => url.endsWith("/v2/apply"))?.[1]).toEqual({ expectedGeneration: 4 });
    expect(onChanged).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Undo upgrade" })).toBeInTheDocument();
  });

  it("blocks an upgrade the preview found problems with", async () => {
    const fetcher = vi.fn(async (url: string) => url.endsWith("/preview") ? json({ preview: preview({ problems: ["home page, section “hero”: Section settings are invalid."] }) }) : json({ offer: offer() }));
    render(<ThemeUpgradePanel storeId="s" token="t" fetcher={fetcher as never} />);
    await userEvent.click(await screen.findByRole("button", { name: "See what changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This version can't be used yet");
    expect(screen.getByRole("button", { name: "Upgrade draft to 2.0.0" })).toBeDisabled();
  });

  it("undoes the last upgrade with the current generation and shows the platform's reason when refused", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/rollback")) { expect(JSON.parse(String(init?.body))).toEqual({ expectedGeneration: 7 }); return json({ error: { message: "The draft changed since you opened this page. Reload, then undo the upgrade." } }, 409); }
      return json({ offer: offer({ newer: [], generation: 7, lastUpgrade: { id: "b", fromVersion: "1.0.0", toVersion: "1.1.0", createdAt: "x" } }) });
    });
    render(<ThemeUpgradePanel storeId="s" token="t" fetcher={fetcher as never} />);
    await userEvent.click(await screen.findByRole("button", { name: "Undo upgrade" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The draft changed since you opened this page");
  });

  it("has no accessibility problems axe can find", async () => {
    const view = render(<ThemeUpgradePanel storeId="s" token="t" fetcher={vi.fn(async () => json({ offer: offer({ lastUpgrade: { id: "b", fromVersion: "0.9.0", toVersion: "1.0.0", createdAt: "x" } }) })) as never} />);
    await screen.findByLabelText("Upgrade to");
    const results = await axe.run(view.container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
