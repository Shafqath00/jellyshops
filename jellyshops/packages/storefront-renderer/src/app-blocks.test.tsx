import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { appEmbedSource, registerAppBlockProvider } from "@jelly/storefront-schema";
import { validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import { RegistrySectionRenderer } from "./registry-section-renderer";

const commerce = { getProducts: async () => [] };
const map = "https://www.google.com/maps/embed?pb=!1m18!1m12";
const app = (settings: Record<string, unknown>): BlockNode => ({ id: "a1", type: "app", enabled: true, settings });
const section = (type: string, blocks: BlockNode[]): SectionNode => ({ id: "s", type, enabled: true, settings: {}, blocks });

it("accepts only each provider's own https embed links", () => {
  expect(appEmbedSource("google-maps", map)).toBe(map);
  expect(appEmbedSource("google-maps", "https://evil.test/maps/embed?x")).toBeNull();
  expect(appEmbedSource("google-maps", "javascript:alert(1)")).toBeNull();
  expect(appEmbedSource("calendly", "https://calendly.com/shop/visit")).toBe("https://calendly.com/shop/visit");
  expect(appEmbedSource("unknown", map)).toBeNull();
});

it("validates app blocks in the Apps and Custom content sections", () => {
  expect(validateSectionAgainstRegistry(section("apps", [app({ provider: "google-maps", url: map, height: 360 })]), "home")).toEqual([]);
  expect(validateSectionAgainstRegistry(section("custom-content", [app({ provider: "google-maps", url: map })]), "home")).toEqual([]);
  expect(validateSectionAgainstRegistry(section("apps", [app({ provider: "google-maps", url: "https://evil.test/x" })]), "home").map(({ code }) => code)).toEqual(["SETTINGS_INVALID"]);
  expect(validateSectionAgainstRegistry(section("apps", [app({ provider: "nope" })]), "home").map(({ code }) => code)).toEqual(["SETTINGS_INVALID"]);
  expect(validateSectionAgainstRegistry(section("apps", [{ id: "h", type: "heading", enabled: true, settings: { text: "Hi" } }]), "home").map(({ code }) => code)).toEqual(["BLOCK_NOT_ALLOWED"]);
});

it("draws the app in a sandboxed frame, and only a hint in the editor until the link is valid", () => {
  const live = render(<RegistrySectionRenderer section={section("apps", [app({ provider: "google-maps", url: map, title: "Map to our shop" })])} mode="published" commerce={commerce} />);
  const frame = live.container.querySelector("iframe")!;
  expect(frame).toHaveAttribute("src", map);
  expect(frame).toHaveAttribute("title", "Map to our shop");
  expect(frame.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin");
  expect(frame).toHaveAttribute("height", "400");
  live.unmount();
  const empty = render(<RegistrySectionRenderer section={section("apps", [app({ provider: "google-maps", url: "https://evil.test" })])} mode="published" commerce={commerce} />);
  expect(empty.container.querySelector("iframe")).toBeNull();
  empty.unmount();
  render(<RegistrySectionRenderer section={section("apps", [app({ provider: "google-maps", url: "https://evil.test" })])} mode="editor" commerce={commerce} />);
  expect(screen.getByText(/can't be used for Google Maps/)).toBeInTheDocument();
});

it("lets an integration register its own provider", () => {
  registerAppBlockProvider({ id: "reviews-test", name: "Reviews", help: "Your widget link.", pattern: /^https:\/\/widgets\.reviews\.test\/[\w-]+$/, defaultHeight: 300, sandbox: ["allow-popups"] });
  expect(appEmbedSource("reviews-test", "https://widgets.reviews.test/shop-1")).toBe("https://widgets.reviews.test/shop-1");
  expect(() => registerAppBlockProvider({ id: "Bad Id", name: "x", help: "", pattern: /x/, defaultHeight: 1 })).toThrow();
});
