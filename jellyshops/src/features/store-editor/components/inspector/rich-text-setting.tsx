"use client";

import { useState } from "react";
import type { RichTextDocument } from "@jelly/storefront-schema";
import { formattedSetting } from "@jelly/storefront-renderer";
import { SettingTextEditor } from "./setting-text-editor";

/**
 * A text setting edited with formatting. The plain text stays under `key` (search,
 * custom-field bindings and inline editing read it) and the formatted copy goes
 * under `<key>Doc`; both are saved together. `inline` is for headings: one line
 * with bold, italic, underline, link, colour and size.
 */
export function RichTextSetting({ id, settingKey, label, maxLength, settings, inline = false, onPatch }: {
  id: string;
  settingKey: string;
  label: string;
  maxLength: number;
  settings: Record<string, unknown>;
  inline?: boolean;
  onPatch(patch: Record<string, unknown>): void;
}) {
  const text = typeof settings[settingKey] === "string" ? settings[settingKey] as string : "";
  const [length, setLength] = useState(text.length);
  const tooLong = length > maxLength;
  const change = (document: RichTextDocument | null, plainText: string) => {
    setLength(plainText.length);
    // Over the limit: keep typing allowed, but don't save text the store would refuse.
    if (plainText.length > maxLength) return;
    onPatch({ [settingKey]: plainText, [`${settingKey}Doc`]: document ?? undefined });
  };
  return <div>
    <span id={`${id}-label`} className="mb-1.5 block text-[11px] font-medium text-foreground">{label}</span>
    <SettingTextEditor id={id} label={label} inline={inline} value={formattedSetting(settings, settingKey)} fallbackText={text} onChange={change} />
    <p className={`mt-1 text-right text-[11px] ${tooLong ? "font-semibold text-red-700" : "text-muted-foreground"}`} role={tooLong ? "alert" : undefined}>
      {tooLong ? `Too long to save: ${length} of ${maxLength} characters. Shorten it to save.` : `${length} / ${maxLength}`}
    </p>
  </div>;
}
