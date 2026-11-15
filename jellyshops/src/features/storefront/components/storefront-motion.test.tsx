import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const inView = vi.fn(() => () => undefined);
const animate = vi.fn(() => Promise.resolve());
const hover = vi.fn(() => () => undefined);
vi.mock("framer-motion/dom", () => ({ animate, inView, hover, stagger: () => 0 }));
vi.mock("lenis", () => ({ default: vi.fn(function Lenis() { return { destroy: vi.fn() }; }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/demo" }));

import { SAFETY_MS, sectionsToReveal, StorefrontMotion } from "./storefront-motion";

function page(tokens: string) {
  document.body.innerHTML = `<div data-jelly-theme="jelly-resthaven" style="${tokens}">
    <div data-section-frame data-section-type="header" id="header"></div>
    <div data-section-frame data-section-type="hero" id="hero"></div>
    <div data-section-frame data-section-type="product-grid" id="below"></div>
  </div>`;
  const tops: Record<string, number> = { header: 0, hero: 100, below: 2000 };
  for (const element of document.querySelectorAll<HTMLElement>("[data-section-frame]")) {
    element.getBoundingClientRect = () => ({ top: tops[element.id] ?? 0 } as DOMRect);
  }
}

function motionPreference(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce, addEventListener: vi.fn(), removeEventListener: vi.fn() });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => { vi.clearAllMocks(); document.body.innerHTML = ""; });

describe("StorefrontMotion", () => {
  it("reveals only sections that start below the screen, never the header", () => {
    page("");
    expect(sectionsToReveal(document, 800).map((frame) => frame.id)).toEqual(["below"]);
  });

  it("does nothing unless the theme turns animations on", async () => {
    motionPreference(false);
    page("");
    render(<StorefrontMotion />);
    await flush();
    expect(inView).not.toHaveBeenCalled();
    expect(document.getElementById("below")!.style.opacity).toBe("");
  });

  it("fades lower sections in when the theme asks for it", async () => {
    motionPreference(false);
    page("--jelly-motion-reveal: 1");
    render(<StorefrontMotion />);
    await flush();
    await flush();
    expect(inView).toHaveBeenCalledTimes(1);
    expect(document.getElementById("below")!.style.opacity).toBe("0");
    expect(document.getElementById("hero")!.style.opacity).toBe("");
  });

  it("never moves anything for shoppers who ask for less motion", async () => {
    motionPreference(true);
    page("--jelly-motion-reveal: 1; --jelly-motion-smooth: 1");
    render(<StorefrontMotion />);
    await flush();
    const Lenis = (await import("lenis")).default;
    expect(inView).not.toHaveBeenCalled();
    expect(Lenis).not.toHaveBeenCalled();
  });

  it("shows a section that entered view even if its animation never finishes", async () => {
    motionPreference(false);
    page("--jelly-motion-reveal: 1");
    animate.mockImplementation(() => new Promise(() => undefined));
    render(<StorefrontMotion />);
    await flush();
    await flush();
    vi.useFakeTimers();
    const onStart = (inView.mock.calls[0] as unknown as [Element, () => void])[1];
    onStart();
    expect(document.getElementById("below")!.style.opacity).toBe("0");
    vi.advanceTimersByTime(SAFETY_MS);
    expect(document.getElementById("below")!.style.opacity).toBe("");
    vi.useRealTimers();
    animate.mockImplementation(() => Promise.resolve());
  });

  it("shows hidden sections again when it is removed", async () => {
    motionPreference(false);
    page("--jelly-motion-reveal: 1");
    const view = render(<StorefrontMotion />);
    await flush();
    await flush();
    view.unmount();
    expect(document.getElementById("below")!.style.opacity).toBe("");
  });
});
