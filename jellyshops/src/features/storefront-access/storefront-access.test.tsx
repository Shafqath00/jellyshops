import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { accessCookieName, loadAccessStatus, requestAccessToken } from "./access-api";
import { StorefrontAccessSettings } from "./access-settings";
import { StorefrontPasswordPage } from "./password-page";

vi.mock("@/features/auth/providers/auth-provider", () => ({ authApiOrigin: () => "http://api.test" }));
afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

it("reads the status with the shopper's token, and leaves the store open when it can't be read", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(json({ protected: true, unlocked: false, message: "Soon" })).mockResolvedValueOnce(json({}, 404)).mockRejectedValueOnce(new Error("offline"));
  await expect(loadAccessStatus("store-1", "tok", fetcher as never)).resolves.toEqual({ protected: true, unlocked: false, message: "Soon" });
  expect(fetcher.mock.calls[0][1].headers["x-storefront-access"]).toBe("tok");
  expect(fetcher.mock.calls[0][0]).toContain("/api/public/stores/store-1/storefront/access/status");
  await expect(loadAccessStatus("store-1", undefined, fetcher as never)).resolves.toMatchObject({ protected: false, unlocked: true });
  await expect(loadAccessStatus("store-1", undefined, fetcher as never)).resolves.toMatchObject({ protected: false, unlocked: true });
  expect(accessCookieName("store/1;x")).toBe("jelly-access-store1x");
});

it("turns a wrong password or a lock-out into a plain message", async () => {
  await expect(requestAccessToken("s", "x", vi.fn().mockResolvedValue(json({ token: "abc" })) as never)).resolves.toBe("abc");
  await expect(requestAccessToken("s", "x", vi.fn().mockResolvedValue(json({ error: { message: "That password isn't right." } }, 401)) as never)).rejects.toThrow("That password isn't right.");
  await expect(requestAccessToken("s", "x", vi.fn().mockResolvedValue(json({}, 429)) as never)).rejects.toThrow(/Too many tries/);
});

it("shows the merchant's message, reports a wrong password and reloads after a right one", async () => {
  const reload = vi.fn();
  vi.stubGlobal("location", { ...window.location, reload });
  const fetchMock = vi.fn().mockResolvedValueOnce(json({ error: "That password isn't right." }, 401)).mockResolvedValueOnce(json({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  render(<StorefrontPasswordPage storeSlug="shop" storeName="Oak & Ash" message="Opening soon" />);
  expect(screen.getByRole("heading", { name: "Oak & Ash" })).toBeInTheDocument();
  expect(screen.getByText("Opening soon")).toBeInTheDocument();
  const box = screen.getByLabelText("Password");
  fireEvent.change(box, { target: { value: "wrong" } });
  fireEvent.submit(box.closest("form")!);
  expect(await screen.findByRole("alert")).toHaveTextContent("That password isn't right.");
  fireEvent.change(box, { target: { value: "tulip" } });
  fireEvent.submit(box.closest("form")!);
  await waitFor(() => expect(reload).toHaveBeenCalled());
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ storeSlug: "shop", password: "tulip" });
});

it("lets the merchant turn protection on with a password, never showing a saved one", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(json({ enabled: false, hasPassword: false, message: "" }))
    .mockResolvedValueOnce(json({ enabled: true, hasPassword: true, message: "Soon" }));
  render(<StorefrontAccessSettings storeId="store-1" token="t" fetcher={fetcher as never} />);
  const password = await screen.findByLabelText(/^Password/);
  fireEvent.change(password, { target: { value: "tulip" } });
  fireEvent.click(screen.getByLabelText(/Ask shoppers for a password/));
  fireEvent.change(screen.getByLabelText(/Message above/), { target: { value: "Soon" } });
  fireEvent.click(screen.getByRole("button", { name: "Save password settings" }));
  expect(await screen.findByText("Password settings saved")).toBeInTheDocument();
  expect(fetcher.mock.calls[1][1].method).toBe("PUT");
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ enabled: true, message: "Soon", password: "tulip" });
  expect(await screen.findByLabelText(/^New password/)).toHaveValue("");
});
