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
  // The Vimeo video shows its play button; the player loads only when pressed.
  expect([...wrapper.querySelectorAll("h2, img, .jelly-video-cover, iframe, a.jelly-button")].map((node) => node.tagName)).toEqual(["H2", "IMG", "BUTTON", "A"]);
  expect(screen.getByRole("img", { name: "The studio" }).closest("a")).toHaveAttribute("href", "/demo/about");
  expect(screen.getByRole("link", { name: "Visit us" })).toHaveClass("jelly-button--secondary");
  expect(screen.queryByText("Add a video link")).not.toBeInTheDocument();
  unmount();
  render(<RegistrySectionRenderer section={section} mode="editor" commerce={{ getProducts: async () => [] }} storeSlug="demo" />);
  expect(screen.getByText("Add a video link")).toHaveAttribute("data-editor-block-id", "empty");
  expect(screen.getByRole("img", { name: "The studio" }).closest("a")).toBeNull();
});

it("lets the editor select heading, text and button blocks in content sections, but not on the live store", () => {
  const section: SectionNode = {
    id: "it", type: "image-with-text", enabled: true, settings: {},
    blocks: [
      { id: "h", type: "heading", enabled: true, settings: { text: "Made here" } },
      { id: "t", type: "text", enabled: true, settings: { text: "By hand." } },
      { id: "b", type: "button", enabled: true, settings: { label: "Read more", href: "/about" } },
    ],
  };
  const { unmount } = render(<RegistrySectionRenderer section={section} mode="editor" commerce={{ getProducts: async () => [] }} />);
  expect(screen.getByRole("heading", { name: "Made here" })).toHaveAttribute("data-editor-block-id", "h");
  expect(screen.getByText("By hand.")).toHaveAttribute("data-editor-block-id", "t");
  expect(screen.getByRole("link", { name: "Read more" })).toHaveAttribute("data-editor-block-id", "b");
  unmount();
  render(<RegistrySectionRenderer section={section} mode="published" commerce={{ getProducts: async () => [] }} />);
  expect(screen.getByRole("heading", { name: "Made here" })).not.toHaveAttribute("data-editor-block-id");
});

it("lays out a group's blocks in a row and lets the editor select blocks inside it", () => {
  const section: SectionNode = {
    id: "c2", type: "custom-content", enabled: true, settings: {},
    blocks: [
      { id: "h", type: "heading", enabled: true, settings: { text: "Visit us" } },
      { id: "g", type: "group", enabled: true, settings: { groupDirection: "horizontal", groupAlign: "between", groupGap: 24, blockBackground: true, blockBackgroundColor: "#eeeeee" }, blocks: [
        { id: "b1", type: "button", enabled: true, settings: { label: "Book a visit", href: "/contact" } },
        { id: "b2", type: "button", enabled: true, settings: { label: "Call us", href: "/call" } },
        { id: "off", type: "text", enabled: false, settings: { text: "Hidden text" } },
      ] },
      { id: "empty", type: "group", enabled: true, settings: {}, blocks: [] },
      { id: "fill", type: "group", enabled: true, settings: { blockWidth: "fill" }, blocks: [{ id: "f1", type: "heading", enabled: true, settings: { text: "Full width" } }] },
    ],
  };
  const { unmount } = render(<RegistrySectionRenderer section={section} mode="published" commerce={{ getProducts: async () => [] }} storeSlug="demo" />);
  const group = screen.getByRole("link", { name: "Book a visit" }).parentElement!;
  expect(group).toHaveClass("jelly-block-group");
  expect(group).toHaveAttribute("data-direction", "horizontal");
  expect(group).toHaveAttribute("data-align", "between");
  expect(group.style.getPropertyValue("--group-gap")).toBe("24px");
  expect(group.style.background).toBe("rgb(238, 238, 238)");
  // Each group numbers its own buttons: the first is filled, the next outlined.
  expect(screen.getByRole("link", { name: "Book a visit" })).toHaveClass("jelly-button");
  expect(screen.getByRole("link", { name: "Call us" })).toHaveClass("jelly-button--secondary");
  expect(screen.queryByText("Hidden text")).not.toBeInTheDocument();
  expect(screen.queryByText("Add blocks to this group")).not.toBeInTheDocument();
  expect(group).not.toHaveAttribute("data-editor-block-id");
  // Width "Fill" stretches a group but keeps it a flex layout.
  expect(screen.getByRole("heading", { name: "Full width" }).parentElement!.style.display).toBe("");
  expect(screen.getByRole("heading", { name: "Full width" }).parentElement!.style.width).toBe("100%");
  unmount();
  render(<RegistrySectionRenderer section={section} mode="editor" commerce={{ getProducts: async () => [] }} storeSlug="demo" />);
  expect(screen.getByRole("link", { name: "Call us" })).toHaveAttribute("data-editor-block-id", "b2");
  expect(screen.getByRole("link", { name: "Call us" }).parentElement).toHaveAttribute("data-editor-block-id", "g");
  expect(screen.getByText("Add blocks to this group").parentElement).toHaveAttribute("data-editor-block-id", "empty");
});
