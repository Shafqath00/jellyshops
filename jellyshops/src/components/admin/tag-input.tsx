"use client";
import { useId, useState } from "react";
import { X } from "lucide-react";

/** Tags as removable chips. Type a tag and press Enter or a comma to add it; suggestions come from `known`. */
export function TagInput({ label, value, onChange, known = [], help }: { label: string; value: string[]; onChange: (tags: string[]) => void; known?: string[]; help?: string }) {
  const [text, setText] = useState("");
  const id = useId();
  const add = (raw: string) => {
    const tags = raw.split(",").map((tag) => tag.trim()).filter(Boolean);
    if (!tags.length) return;
    onChange([...new Set([...value, ...tags])].slice(0, 50));
    setText("");
  };
  return <div className="jk-field">
    <label htmlFor={id}>{label}</label>
    <input id={id} list={`${id}-known`} value={text} placeholder="Type a tag and press Enter" aria-describedby={help ? `${id}-help` : undefined}
      onChange={(event) => { if (event.target.value.endsWith(",")) add(event.target.value); else setText(event.target.value); }}
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(text); } }}
      onBlur={() => add(text)} />
    <datalist id={`${id}-known`}>{known.filter((tag) => !value.includes(tag)).map((tag) => <option key={tag} value={tag} />)}</datalist>
    {help && <small id={`${id}-help`} className="jk-muted">{help}</small>}
    {value.length > 0 && <ul className="jk-tags" aria-label={`${label} added`}>{value.map((tag) => <li key={tag} className="jk-tag">{tag}
      <button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter((item) => item !== tag))}><X size={12} aria-hidden="true" /></button></li>)}</ul>}
  </div>;
}
