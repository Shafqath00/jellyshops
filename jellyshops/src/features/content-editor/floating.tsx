"use client";

import { useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { AlignCenter, AlignLeft, AlignRight, Bold, Code, Italic, Link2, Maximize2, Pencil, Strikethrough, Trash2, Underline } from "lucide-react";
import { ToolButton } from "./toolbar";

const MEDIA = ["image", "video", "button"] as const;

/** Formatting for selected text: appears above the selection. */
export function TextBubble({ editor, onLink }: { editor: Editor; onLink: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"), italic: current.isActive("italic"), underline: current.isActive("underline"),
      strike: current.isActive("strike"), code: current.isActive("code"), link: current.isActive("link"),
    }),
  });
  return (
    <BubbleMenu editor={editor} pluginKey="jce-text-bubble" className="jce-bubble" role="toolbar" aria-label="Format selected text"
      shouldShow={({ editor: current, from, to }) => from !== to && !MEDIA.some((type) => current.isActive(type)) && !current.isActive("codeBlock")}>
      <ToolButton label="Bold" shortcut="Ctrl+B" pressed={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={15} aria-hidden /></ToolButton>
      <ToolButton label="Italic" shortcut="Ctrl+I" pressed={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={15} aria-hidden /></ToolButton>
      <ToolButton label="Underline" shortcut="Ctrl+U" pressed={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline size={15} aria-hidden /></ToolButton>
      <ToolButton label="Strikethrough" shortcut="Ctrl+Shift+S" pressed={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={15} aria-hidden /></ToolButton>
      <ToolButton label="Inline code" shortcut="Ctrl+E" pressed={state.code} onClick={() => editor.chain().focus().toggleCode().run()}><Code size={15} aria-hidden /></ToolButton>
      <ToolButton label={state.link ? "Edit link" : "Add link"} shortcut="Ctrl+K" pressed={state.link} onClick={onLink}><Link2 size={15} aria-hidden /></ToolButton>
    </BubbleMenu>
  );
}

type ImageAttrs = { src: string; alt: string; caption: string | null; width: number | null; align: string | null; href: string | null };

/** Settings for a selected photo, video or button, right where it sits. */
export function MediaBubble({ editor, onEditButton }: { editor: Editor; onEditButton: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      type: MEDIA.find((type) => current.isActive(type)) ?? null,
      attrs: MEDIA.map((type) => current.getAttributes(type)).find((attrs) => Object.keys(attrs).length) ?? {},
    }),
  });
  const attrs = state.attrs as Partial<ImageAttrs> & { title?: string | null; label?: string; style?: string | null; provider?: string; id?: string };
  const update = (patch: Record<string, unknown>) => { if (state.type) editor.chain().updateAttributes(state.type, patch).run(); };
  const remove = () => editor.chain().focus().deleteSelection().run();
  const align = (value: string | null) => update({ align: value });

  return (
    <BubbleMenu editor={editor} pluginKey="jce-media-bubble" className="jce-bubble jce-bubble--media" aria-label="Selected block settings"
      shouldShow={({ editor: current }) => MEDIA.some((type) => current.isActive(type))}
      options={{ placement: "bottom" }}>
      {state.type === "image" ? <ImageSettings key={attrs.src ?? ""} attrs={attrs} update={update} remove={remove} /> : null}
      {state.type === "video" ? <VideoSettings key={`${attrs.provider ?? ""}:${attrs.id ?? ""}`} title={attrs.title ?? ""} update={update} remove={remove} /> : null}
      {state.type === "button" ? (
        <div className="jce-media-row">
          <ToolButton label="Edit button" onClick={onEditButton}><Pencil size={15} aria-hidden /></ToolButton>
          <ToolButton label="Align left" pressed={!attrs.align} onClick={() => align(null)}><AlignLeft size={15} aria-hidden /></ToolButton>
          <ToolButton label="Align centre" pressed={attrs.align === "center"} onClick={() => align("center")}><AlignCenter size={15} aria-hidden /></ToolButton>
          <ToolButton label="Align right" pressed={attrs.align === "right"} onClick={() => align("right")}><AlignRight size={15} aria-hidden /></ToolButton>
          <ToolButton label="Remove button" onClick={remove}><Trash2 size={15} aria-hidden /></ToolButton>
        </div>
      ) : null}
    </BubbleMenu>
  );
}

type Update = (patch: Record<string, unknown>) => void;

/** Alt text, caption, size and placement of the selected photo. Keyed by the photo, so it starts from its values. */
function ImageSettings({ attrs, update, remove }: { attrs: Partial<ImageAttrs>; update: Update; remove: () => void }) {
  const [alt, setAlt] = useState(attrs.alt ?? "");
  const [caption, setCaption] = useState(attrs.caption ?? "");
  const align = (value: string | null) => update({ align: value });
  return (
    <div className="jce-media-settings">
      <label className="jce-mini-field"><span>Alt text</span>
        <input value={alt} maxLength={300} placeholder="What the photo shows" onChange={(event) => setAlt(event.target.value)} onBlur={() => update({ alt: alt.trim() })}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); update({ alt: alt.trim() }); } }} aria-invalid={!alt.trim()} />
      </label>
      <label className="jce-mini-field"><span>Caption</span>
        <input value={caption} maxLength={500} placeholder="Optional" onChange={(event) => setCaption(event.target.value)} onBlur={() => update({ caption: caption.trim() || null })}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); update({ caption: caption.trim() || null }); } }} />
      </label>
      <div className="jce-media-row">
        <label className="jce-mini-field jce-mini-field--inline"><span>Size</span>
          <select value={attrs.width ?? 100} onChange={(event) => update({ width: Number(event.target.value) >= 100 ? null : Number(event.target.value) })}>
            {[25, 35, 50, 65, 75, 100].map((value) => <option key={value} value={value}>{value === 100 ? "Full width" : `${value}%`}</option>)}
          </select>
        </label>
        <ToolButton label="Left, text beside it" pressed={attrs.align === "left"} onClick={() => align("left")}><AlignLeft size={15} aria-hidden /></ToolButton>
        <ToolButton label="Centred" pressed={!attrs.align || attrs.align === "center"} onClick={() => align(null)}><AlignCenter size={15} aria-hidden /></ToolButton>
        <ToolButton label="Right, text beside it" pressed={attrs.align === "right"} onClick={() => align("right")}><AlignRight size={15} aria-hidden /></ToolButton>
        <ToolButton label="Full width of the text column" pressed={attrs.align === "full"} onClick={() => update({ align: "full", width: null })}><Maximize2 size={15} aria-hidden /></ToolButton>
        <ToolButton label="Remove photo" onClick={remove}><Trash2 size={15} aria-hidden /></ToolButton>
      </div>
      {!alt.trim() ? <p className="jce-warning" role="status">Add alt text so everyone knows what the photo shows.</p> : null}
    </div>
  );
}

function VideoSettings({ title: initial, update, remove }: { title: string; update: Update; remove: () => void }) {
  const [title, setTitle] = useState(initial);
  return (
    <div className="jce-media-settings">
      <label className="jce-mini-field"><span>Title</span>
        <input value={title} maxLength={300} placeholder="Read aloud by screen readers" onChange={(event) => setTitle(event.target.value)} onBlur={() => update({ title: title.trim() || null })} />
      </label>
      <div className="jce-media-row"><ToolButton label="Remove video" onClick={remove}><Trash2 size={15} aria-hidden /></ToolButton></div>
    </div>
  );
}
