import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import { DeveloperTokensSettings, type DeveloperTokenSummary } from "./developer-tokens-settings";

const summary = (over: Partial<DeveloperTokenSummary> = {}): DeveloperTokenSummary => ({ id: "t1", name: "Studio laptop", prefix: "jdt_abcd1234", createdAt: "2026-11-01T00:00:00Z", lastUsedAt: null, expiresAt: null, revokedAt: null, ...over });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("Settings > Developer tokens", () => {
  it("creates a token, shows it once, and lists it without the secret", async () => {
    let list: DeveloperTokenSummary[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        expect(body).toEqual({ name: "CI server", expiresInDays: 90 });
        list = [summary({ name: "CI server" })];
        return json({ token: "jdt_secret-value", summary: list[0] }, 201);
      }
      expect(url).toMatch(/\/api\/stores\/store-1\/developer-tokens$/);
      return json({ tokens: list });
    });
    render(<DeveloperTokensSettings storeId="store-1" token="session" fetcher={fetcher as never} />);
    expect(await screen.findByText("No tokens yet.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Name/), "CI server");
    await userEvent.click(screen.getByRole("button", { name: "Create token" }));
    expect(await screen.findByLabelText("New developer token")).toHaveTextContent("jdt_secret-value");
    expect(screen.getByText(/will not be shown again/)).toBeInTheDocument();
    const listed = await screen.findByRole("list", { name: "Developer tokens" });
    expect(listed).toHaveTextContent("CI server");
    expect(listed).toHaveTextContent("jdt_abcd1234…");
    expect(listed).not.toHaveTextContent("jdt_secret-value");
  });

  it("revokes a token and shows its state", async () => {
    let list = [summary({ lastUsedAt: "2026-11-04T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z" })];
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/revoke")) { list = [{ ...list[0], revokedAt: "2026-11-05T00:00:00Z" }]; return new Response(null, { status: 204 }); }
      return json({ tokens: list });
    });
    render(<DeveloperTokensSettings storeId="store-1" token="session" fetcher={fetcher as never} />);
    expect(await screen.findByText(/Last used/)).toHaveTextContent(/Expires/);
    await userEvent.click(screen.getByRole("button", { name: "Revoke Studio laptop" }));
    await userEvent.click(await screen.findByRole("button", { name: "Switch off token" }));
    await waitFor(() => expect(screen.getByText(/Revoked/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Revoke Studio laptop" })).toBeNull();
  });

  it("explains when the person signed in may not manage tokens", async () => {
    const fetcher = vi.fn(async () => json({ error: { message: "forbidden" } }, 403));
    render(<DeveloperTokensSettings storeId="store-1" token="session" fetcher={fetcher as never} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Only the store owner or a developer can manage developer tokens.");
  });

  it("has no accessibility problems axe can find", async () => {
    const fetcher = vi.fn(async () => json({ tokens: [summary()] }));
    const view = render(<DeveloperTokensSettings storeId="store-1" token="session" fetcher={fetcher as never} />);
    await screen.findByRole("list", { name: "Developer tokens" });
    const results = await axe.run(view.container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
