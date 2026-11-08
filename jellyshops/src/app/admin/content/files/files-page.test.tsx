import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import FilesPage from "./page";

vi.mock("@/features/auth/providers/auth-provider", () => {
  const activeStore = { id: "store-a" };
  const session = { access_token: "token" };
  return { useAuth: () => ({ activeStore, session }), authApiOrigin: () => "http://api.local" };
});
afterEach(() => { vi.unstubAllGlobals(); });

const file = (id: string, name: string, referenced: boolean) => ({ id, storeId: "store-a", url: `https://cdn.example.com/${id}.jpg`, mimeType: "image/jpeg", byteSize: 2_500_000, width: 1200, height: 800, originalName: name, referenced, createdAt: "2026-11-01T10:00:00.000Z" });

describe("Files", () => {
  it("lists files with size and use, filters, and warns before deleting one that is in use", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => Promise.resolve(new Response(JSON.stringify(init?.method === "DELETE" ? {} : { nodes: [file("m1", "bed.jpg", true), file("m2", "spare.jpg", false)] }))));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<FilesPage />);
    expect(await screen.findByText("bed.jpg")).toBeVisible();
    expect(screen.getAllByText("2.4 MB")).toHaveLength(2);
    await user.click(screen.getByRole("tab", { name: "Not used" }));
    expect(screen.queryByText("bed.jpg")).toBeNull();
    await user.click(screen.getByRole("tab", { name: "All" }));
    await user.click(screen.getByRole("checkbox", { name: "Select bed.jpg" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete bed.jpg?" });
    expect(dialog).toHaveTextContent("used by a product, page or your store design");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/media/m1"), expect.objectContaining({ method: "DELETE" })));
    await waitFor(() => expect(screen.queryByText("bed.jpg")).toBeNull());
  });
});
