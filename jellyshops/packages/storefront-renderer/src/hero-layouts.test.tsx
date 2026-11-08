import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import type { SectionNode } from "@jelly/storefront-schema";
import { validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { StorefrontRuntimeContext } from "./runtime-context";
import { HeroSection } from "./sections/hero";
import { countdownParts, countdownTarget, HeroCountdown } from "./sections/hero-countdown";

const context: StorefrontRuntimeContext = { mode: "published", storeSlug: "demo", commerce: { getProducts: async () => [] } };
const hero = (settings: Record<string, unknown>): SectionNode => ({
  id: "hero", type: "hero", enabled: true,
  settings: { image: { url: "https://cdn.example.com/serum.png", alt: "Serum bottle" }, ...settings },
  blocks: [{ id: "h", type: "heading", enabled: true, settings: { text: "Glow, gently" } }, { id: "b", type: "button", enabled: true, settings: { label: "Shop now", href: "/shop" } }],
});
const noViolations = async (container: HTMLElement) => (await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations.map((violation) => violation.id);

describe("countdown time", () => {
  it("reads the date as UK time, in winter and in summer", () => {
    expect(new Date(countdownTarget("2026-12-01 18:00")!).toISOString()).toBe("2026-12-01T18:00:00.000Z");
    expect(new Date(countdownTarget("2026-07-01 18:00")!).toISOString()).toBe("2026-07-01T17:00:00.000Z");
    expect(new Date(countdownTarget("2026-07-01")!).toISOString()).toBe("2026-06-30T23:00:00.000Z");
  });

  it("refuses text that is not a date", () => {
    expect(countdownTarget("next Friday")).toBeNull();
    expect(countdownTarget(undefined)).toBeNull();
  });

  it("splits the time left into days, hours, minutes and seconds", () => {
    expect(countdownParts(((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
    expect(countdownParts(-10)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });

  it("shows the numbers with a summary for screen readers, then the end text", () => {
    const target = Date.UTC(2026, 11, 1, 18);
    const { rerender } = render(<HeroCountdown target={target} endText="Out now" now={target - ((24 + 2) * 3600 + 30 * 60) * 1000} />);
    expect(screen.getByRole("timer")).toHaveAttribute("aria-label", "Starts in 1 days, 2 hours and 30 minutes");
    expect(screen.getByRole("timer").textContent).toBe("01days02hours30mins00secs");
    rerender(<HeroCountdown target={target} endText="Out now" now={target + 1000} />);
    expect(screen.queryByRole("timer")).toBeNull();
    expect(screen.getByText("Out now")).toBeTruthy();
  });
});

describe("hero layouts", () => {
  it("spotlight: product photo kept whole, with up to four callouts", async () => {
    const { container } = render(<HeroSection section={hero({ layout: "spotlight", callouts: "Vitamin C\n\nFragrance free\nVegan\nRefillable\nFifth" })} context={context} />);
    expect(container.querySelector(".jelly-hero")).toHaveAttribute("data-layout", "spotlight");
    expect([...container.querySelectorAll(".jelly-hero-callouts li")].map((item) => item.textContent)).toEqual(["Vitamin C", "Fragrance free", "Vegan", "Refillable"]);
    expect((container.querySelector(".jelly-hero-media img") as HTMLImageElement).style.objectFit).toBe("contain");
    expect(await noViolations(container)).toEqual([]);
  });

  it("statement and countdown work without a photo; spotlight falls back to text only", () => {
    const withoutImage = (settings: Record<string, unknown>) => ({ ...hero(settings), settings: { ...settings } });
    const statement = render(<HeroSection section={withoutImage({ layout: "statement" })} context={context} />);
    expect(statement.container.querySelector(".jelly-hero")).toHaveAttribute("data-layout", "statement");
    statement.unmount();
    const spotlight = render(<HeroSection section={withoutImage({ layout: "spotlight" })} context={context} />);
    expect(spotlight.container.querySelector(".jelly-hero")).toHaveAttribute("data-layout", "text");
  });

  it("countdown: draws the timer area only for a valid date", () => {
    const valid = render(<HeroSection section={hero({ layout: "countdown", countdownTo: "2099-01-01 09:00" })} context={context} />);
    expect(valid.container.querySelector(".jelly-hero-countdown")).toBeTruthy();
    valid.unmount();
    const invalid = render(<HeroSection section={hero({ layout: "countdown", countdownTo: "soon" })} context={context} />);
    expect(invalid.container.querySelector(".jelly-hero-countdown")).toBeNull();
  });

  it("the registry accepts the new layouts and refuses a badly written date", () => {
    const base = { id: "hero", type: "hero", enabled: true, blocks: [] };
    expect(validateSectionAgainstRegistry({ ...base, settings: { layout: "countdown", countdownTo: "2026-12-01 18:00" } } as SectionNode, "home")).toEqual([]);
    expect(validateSectionAgainstRegistry({ ...base, settings: { layout: "countdown", countdownTo: "1 December" } } as SectionNode, "home").length).toBeGreaterThan(0);
  });
});
