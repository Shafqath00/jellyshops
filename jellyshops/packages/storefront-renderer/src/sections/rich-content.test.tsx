import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RichTextBlock } from "@jelly/storefront-schema";
import { renderBlocks, renderInline } from "./rich-text";

describe("page and post content on the storefront", () => {
  it("draws photos with alt text, caption, width and alignment", () => {
    const blocks: RichTextBlock[] = [{ type: "image", attrs: { src: "/media/bed.jpg", alt: "Oak bed", caption: "Our oak bed", width: 50, align: "right", href: "/products/oak" } }];
    const { container } = render(<div>{renderBlocks(blocks)}</div>);
    const figure = container.querySelector("figure.jelly-rich-image")!;
    expect(figure.getAttribute("data-align")).toBe("right");
    expect((figure as HTMLElement).style.width).toBe("50%");
    expect(screen.getByRole("img", { name: "Oak bed" }).getAttribute("src")).toBe("/media/bed.jpg");
    expect(screen.getByRole("link").getAttribute("href")).toBe("/products/oak");
    expect(screen.getByText("Our oak bed").tagName).toBe("FIGCAPTION");
  });

  it("draws videos from the provider and id, never a stored address", () => {
    const { container } = render(<div>{renderBlocks([{ type: "video", attrs: { provider: "youtube", id: "dQw4w9WgXcQ", title: "Showroom tour" } }])}</div>);
    const frame = container.querySelector("iframe")!;
    expect(frame.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(frame.getAttribute("title")).toBe("Showroom tour");
  });

  it("draws buttons, checklists, dividers and code", () => {
    const blocks: RichTextBlock[] = [
      { type: "button", attrs: { href: "/collections/beds", label: "Shop beds", style: "secondary", target: "_blank" } },
      { type: "taskList", content: [{ type: "taskItem", attrs: { checked: true }, content: [{ type: "paragraph", content: [{ type: "text", text: "Measure" }] }] }] },
      { type: "horizontalRule" },
      { type: "codeBlock", content: [{ type: "text", text: "let a = 1;" }] },
      { type: "heading", attrs: { level: 5 }, content: [{ type: "text", text: "Small" }] },
    ];
    const { container } = render(<div>{renderBlocks(blocks)}</div>);
    const button = screen.getByRole("link", { name: "Shop beds" });
    expect(button.className).toContain("jelly-button--secondary");
    expect(button.getAttribute("target")).toBe("_blank");
    expect(button.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("Done:")).toBeTruthy();
    expect(container.querySelector("hr.jelly-rich-divider")).not.toBeNull();
    expect(container.querySelector("pre code")?.textContent).toBe("let a = 1;");
    expect(screen.getByRole("heading", { level: 5, name: "Small" })).toBeTruthy();
  });

  it("draws strikethrough, code, highlight and new-tab links", () => {
    const { container } = render(<p>{renderInline([
      { type: "text", text: "old", marks: [{ type: "strike" }] },
      { type: "text", text: "x", marks: [{ type: "code" }] },
      { type: "text", text: "note", marks: [{ type: "highlight", attrs: { color: "#ffe066" } }] },
      { type: "text", text: "site", marks: [{ type: "link", attrs: { href: "https://example.com", target: "_blank" } }] },
    ])}</p>);
    expect(container.querySelector("s")?.textContent).toBe("old");
    expect(container.querySelector("code")?.textContent).toBe("x");
    expect((container.querySelector("mark") as HTMLElement).style.backgroundColor).toBe("rgb(255, 224, 102)");
    expect(container.querySelector("a")?.getAttribute("target")).toBe("_blank");
  });

  it("leaves out photos and buttons whose address is unsafe even if they reach the renderer", () => {
    const blocks = [
      { type: "image", attrs: { src: "javascript:alert(1)", alt: "x" } },
      { type: "button", attrs: { href: "javascript:alert(1)", label: "Bad" } },
    ] as RichTextBlock[];
    const { container } = render(<div>{renderBlocks(blocks)}</div>);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
  });
});
