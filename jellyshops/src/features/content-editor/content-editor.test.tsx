import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RichTextDocument } from "@jelly/storefront-schema";
import { ContentEditor } from "./content-editor";

// jsdom has no layout; ProseMirror asks for these while placing menus and the cursor.
Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) });
Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
document.elementFromPoint = () => null;

const doc = (...content: unknown[]) => ({ type: "doc", content }) as RichTextDocument;
const p = (text: string, marks?: unknown[]) => ({ type: "paragraph", content: [{ type: "text", text, ...(marks ? { marks } : {}) }] });

async function setup(initial: RichTextDocument | null = doc(p("Hello world")), props: Partial<Parameters<typeof ContentEditor>[0]> = {}) {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<ContentEditor initialValue={initial} onChange={onChange} label="Page content" {...props} />);
  const box = await screen.findByRole("textbox", { name: "Page content" });
  return { onChange, user, box, last: () => onChange.mock.calls.at(-1)?.[0] as RichTextDocument };
}

describe("content editor", () => {
  it("shows the content with a toolbar, a word count and a / hint", async () => {
    const { box } = await setup(doc({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Delivery" }] }, p("We deliver fast")));
    expect(within(box).getByRole("heading", { level: 2, name: "Delivery" })).toBeTruthy();
    expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeTruthy();
    expect(screen.getByText("4 words · 1 min read")).toBeTruthy();
    expect(screen.getByText(/to add a heading, photo, table and more/)).toBeTruthy();
  });

  it("makes selected text bold and reports a clean document", async () => {
    const { user, box, last } = await setup();
    await user.click(box);
    await user.keyboard("{Control>}a{/Control}");
    await user.click(screen.getByRole("button", { name: "Bold" }));
    await waitFor(() => expect(last()).toEqual(doc(p("Hello world", [{ type: "bold" }]))));
  });

  it("changes the block style from the toolbar", async () => {
    const { user, box, last } = await setup();
    await user.click(box);
    await user.selectOptions(screen.getByLabelText("Text style"), "h3");
    await waitFor(() => expect(last()).toEqual(doc({ type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: "Hello world" }] })));
  });

  it("opens the / menu, filters it while typing and inserts the chosen block", async () => {
    const { user, box, last } = await setup(null);
    await user.click(box);
    await user.keyboard("/div");
    const menu = await screen.findByRole("listbox", { name: "Insert a block" });
    expect(within(menu).getAllByRole("option")[0]).toHaveTextContent("Divider");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(last().content.some((block) => block.type === "horizontalRule")).toBe(true));
    expect(screen.queryByRole("listbox", { name: "Insert a block" })).toBeNull();
    expect(JSON.stringify(last())).not.toContain("/div");
  });

  it("closes the / menu with Escape and keeps the typed text", async () => {
    const { user, box } = await setup(null);
    await user.click(box);
    await user.keyboard("/ta");
    await screen.findByRole("listbox", { name: "Insert a block" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox", { name: "Insert a block" })).toBeNull();
    expect(box).toHaveTextContent("/ta");
  });

  it("adds a link that opens in a new tab and refuses unsafe addresses", async () => {
    const { user, box, last } = await setup();
    await user.click(box);
    await user.keyboard("{Control>}a{/Control}");
    await user.click(screen.getByRole("button", { name: "Add link" }));
    const dialog = await screen.findByRole("dialog", { name: "Add link" });
    await user.type(within(dialog).getByLabelText("Link to"), "javascript:alert(1)");
    await user.click(within(dialog).getByRole("button", { name: "Add link" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Enter a web address");
    await user.clear(within(dialog).getByLabelText("Link to"));
    await user.type(within(dialog).getByLabelText("Link to"), "example.com");
    await user.click(within(dialog).getByLabelText("Open in a new tab"));
    await user.click(within(dialog).getByRole("button", { name: "Add link" }));
    await waitFor(() => expect(last()).toEqual(doc(p("Hello world", [{ type: "link", attrs: { href: "https://example.com", target: "_blank" } }]))));
  });

  it("adds a photo from the store's files, asking for alt text first", async () => {
    const media = { list: vi.fn(async () => [{ id: "m1", url: "/api/public/media/store-a/m1", name: "bed.jpg" }]) };
    const { user, box, last } = await setup(null, { media });
    await user.click(box);
    await user.click(screen.getByRole("button", { name: "Insert" }));
    await user.click(screen.getByRole("menuitem", { name: /Photo/ }));
    const dialog = await screen.findByRole("dialog", { name: "Add photo" });
    await user.click(await within(dialog).findByRole("option"));
    await user.click(within(dialog).getByRole("button", { name: "Add photo" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("alt text");
    await user.type(within(dialog).getByLabelText(/Alt text/), "Oak bed");
    await user.type(within(dialog).getByLabelText(/Caption/), "Our best seller");
    await user.click(within(dialog).getByRole("button", { name: "Add photo" }));
    await waitFor(() => expect(last().content).toContainEqual({ type: "image", attrs: { src: "/api/public/media/store-a/m1", alt: "Oak bed", caption: "Our best seller" } }));
  });

  it("adds a YouTube video from a pasted link", async () => {
    const { user, box, last } = await setup(null);
    await user.click(box);
    await user.click(screen.getByRole("button", { name: "Insert" }));
    await user.click(screen.getByRole("menuitem", { name: /Video/ }));
    const dialog = await screen.findByRole("dialog", { name: "Add video" });
    await user.type(within(dialog).getByLabelText(/YouTube or Vimeo link/), "https://youtu.be/dQw4w9WgXcQ");
    await user.click(within(dialog).getByRole("button", { name: "Add video" }));
    await waitFor(() => expect(last().content).toContainEqual({ type: "video", attrs: { provider: "youtube", id: "dQw4w9WgXcQ" } }));
  });

  it("edits HTML through the server import and comes back to the editor", async () => {
    const importHtml = vi.fn(async () => doc({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "From HTML" }] }));
    const { user, last } = await setup(doc(p("Hello")), { importHtml });
    await user.click(screen.getByRole("button", { name: "Edit HTML" }));
    const source = screen.getByLabelText(/^HTML/) as HTMLTextAreaElement;
    expect(source.value).toBe("<p>Hello</p>");
    await user.clear(source);
    await user.type(source, "<h2>From HTML</h2><script>x</script>");
    await user.click(screen.getByRole("button", { name: "Apply HTML" }));
    expect(importHtml).toHaveBeenCalledWith("<h2>From HTML</h2><script>x</script>");
    await waitFor(() => expect(last()).toEqual(doc({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "From HTML" }] })));
    expect(screen.getByRole("textbox", { name: "Page content" })).toBeTruthy();
  });

  it("undoes and redoes with the toolbar", async () => {
    const { user, box } = await setup(doc(p("A")));
    await user.click(box);
    await user.keyboard("{Control>}a{/Control}B");
    await waitFor(() => expect(box).toHaveTextContent(/^B$/));
    await act(async () => { await user.click(screen.getByRole("button", { name: "Undo" })); });
    await waitFor(() => expect(box).toHaveTextContent(/^A$/));
    await user.click(screen.getByRole("button", { name: "Redo" }));
    await waitFor(() => expect(box).toHaveTextContent(/^B$/));
  });
});
