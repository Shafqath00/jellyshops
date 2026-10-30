import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { buttonProps, videoSource } from "./sections/block-content";
import { RegistrySectionRenderer } from "./registry-section-renderer";

it("embeds only YouTube, Vimeo and direct https video files", () => {
  expect(videoSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ", false, true)?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&controls=1");
  expect(videoSource("https://youtu.be/dQw4w9WgXcQ", true, false)?.src).toContain("autoplay=1&mute=1&loop=1&playlist=dQw4w9WgXcQ");
  expect(videoSource("https://vimeo.com/123456789", false, true)).toEqual({ kind: "embed", src: "https://player.vimeo.com/video/123456789?controls=1" });
  expect(videoSource("https://cdn.example.com/clip.mp4", false, true)).toEqual({ kind: "file", src: "https://cdn.example.com/clip.mp4" });
  expect(videoSource("http://cdn.example.com/clip.mp4", false, true)).toBeNull();
  expect(videoSource("javascript:alert(1)", false, true)).toBeNull();
  expect(videoSource("https://evil.example.com/page", false, true)).toBeNull();
  expect(videoSource("https://www.youtube.com/watch?v=<script>", false, true)).toBeNull();
});

it("turns button options into classes, link targets and safe colours", () => {
  expect(buttonProps({}, 0).className).toBe("jelly-button");
  expect(buttonProps({}, 1).className).toBe("jelly-button jelly-button--secondary");
  const props = buttonProps({ buttonStyle: "primary", buttonSize: "large", buttonHover: "lift", buttonColor: "#aa0000", buttonTextColor: "#ffffff", openInNewTab: true }, 3);
  expect(props).toMatchObject({ className: "jelly-button", target: "_blank", rel: "noopener noreferrer", "data-button-size": "large", "data-button-hover": "lift", style: { background: "#aa0000", borderColor: "#aa0000", color: "#ffffff" } });
  expect(buttonProps({ buttonColor: "red;}", buttonSize: "huge", buttonHover: "spin" })).toEqual({ className: "jelly-button" });
});

it("shows custom content blocks in order, in the editor and the live store", () => {
  const section: SectionNode = {
    id: "c1", type: "custom-content", enabled: true, settings: { contentAlignment: "left" },
    blocks: [
      { id: "h", type: "heading", enabled: true, settings: { text: "Our studio" } },
      { id: "i", type: "image", enabled: true, settings: { image: { url: "https://example.com/studio.jpg", alt: "The studio" }, aspectRatio: "square", link: "/about" } },
      { id: "v", type: "video", enabled: true, settings: { url: "https://vimeo.com/123456789" } },
      { id: "b", type: "button", enabled: true, settings: { label: "Visit us", href: "/contact", buttonStyle: "secondary" } },
      { id: "empty", type: "video", enabled: true, settings: {} },
    ],
  };
  const { unmount } = render(<RegistrySectionRenderer section={section} mode="published" commerce={{ getProducts: async () => [] }} storeSlug="demo" />);
  const wrapper = screen.getByTestId("section-custom-content");
  expect([...wrapper.querySelectorAll("h2, img, iframe, a.jelly-button")].map((node) => node.tagName)).toEqual(["H2", "IMG", "IFRAME", "A"]);
  expect(screen.getByRole("img", { name: "The studio" }).closest("a")).toHaveAttribute("href", "/demo/about");
  expect(screen.getByRole("link", { name: "Visit us" })).toHaveClass("jelly-button--secondary");
  expect(screen.queryByText("Add a video link")).not.toBeInTheDocument();
  unmount();
  render(<RegistrySectionRenderer section={section} mode="editor" commerce={{ getProducts: async () => [] }} storeSlug="demo" />);
  expect(screen.getByText("Add a video link")).toHaveAttribute("data-editor-block-id", "empty");
  expect(screen.getByRole("img", { name: "The studio" }).closest("a")).toBeNull();
});
