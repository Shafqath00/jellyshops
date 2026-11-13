"use client";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

export type ComboboxOption = { value: string; label: string; detail?: string };

/**
 * A dropdown you can type in to narrow the choices. Use it instead of a plain select once a list
 * is longer than about seven items (countries, time zones, product types, brands).
 * With `allowCustom`, whatever the merchant types is kept even when it is not in the list ("Add a new brand").
 * For choosing several items, or items that need a photo, use `Picker`.
 */
export function Combobox({ id, value, onChange, options, placeholder = "Search or choose", allowCustom = false, emptyText = "No matches", disabled = false, "aria-invalid": invalid, "aria-describedby": describedBy, "aria-required": required }: {
  id: string; value: string; onChange: (value: string) => void; options: ComboboxOption[];
  placeholder?: string; allowCustom?: boolean; emptyText?: string; disabled?: boolean;
  "aria-invalid"?: boolean; "aria-describedby"?: string; "aria-required"?: boolean;
}) {
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  /** What is being typed; null while the field just shows the current choice. */
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const selected = options.find((option) => option.value === value);
  const shown = query ?? selected?.label ?? value;
  const needle = (query ?? "").trim().toLowerCase();
  const matches = needle ? options.filter((option) => `${option.label} ${option.detail ?? ""}`.toLowerCase().includes(needle)) : options;
  const custom = allowCustom && needle && !options.some((option) => option.label.toLowerCase() === needle) ? (query ?? "").trim() : "";
  const rows = [...matches.map((option) => ({ key: option.value, option })), ...(custom ? [{ key: "\u0000custom", option: { value: custom, label: `Use "${custom}"` } }] : [])];
  const activeIndex = Math.min(active, Math.max(rows.length - 1, 0));

  function close() { setOpen(false); setQuery(null); setActive(0); }
  function choose(next: string) { onChange(next); close(); }
  function leave() {
    if (query !== null) {
      const typed = query.trim();
      const exact = options.find((option) => option.label.toLowerCase() === typed.toLowerCase());
      if (exact) onChange(exact.value);
      else if (!typed) onChange("");
      else if (allowCustom) onChange(typed);
    }
    close();
  }
  function keys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      if (rows.length) setActive((activeIndex + (event.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length);
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      const row = rows[activeIndex];
      if (row) choose(row.option.value);
    } else if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation();
      close();
    }
  }
  const optionId = (index: number) => `${listId}-option-${index}`;
  return <div className="jk-combobox">
    <input ref={input} id={id} className="jk-input" role="combobox" autoComplete="off" value={shown} placeholder={placeholder} disabled={disabled}
      aria-expanded={open && rows.length > 0} aria-controls={listId} aria-autocomplete="list" aria-invalid={invalid || undefined} aria-describedby={describedBy} aria-required={required || undefined}
      aria-activedescendant={open && rows.length ? optionId(activeIndex) : undefined}
      onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); }}
      onFocus={(event) => event.currentTarget.select()} onClick={() => setOpen(true)} onKeyDown={keys} onBlur={leave} />
    <ChevronDown size={16} aria-hidden="true" className="jk-combobox-arrow" />
    {open && !rows.length && <p className="jk-combobox-list jk-combobox-empty" role="status">{emptyText}</p>}
    <ul id={listId} role="listbox" className="jk-combobox-list" hidden={!open || !rows.length} aria-label={placeholder}>
      {rows.map((row, index) => <li key={row.key} id={optionId(index)} role="option" aria-selected={row.option.value === value} className={`jk-combobox-option ${index === activeIndex ? "is-active" : ""}`}
        onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => { choose(row.option.value); input.current?.focus(); }}>
        <span className="min-w-0 flex-1">{row.option.label}{row.option.detail && <span className="jk-cell-sub">{row.option.detail}</span>}</span>
        {row.option.value === value && <Check size={14} aria-hidden="true" />}
      </li>)}
    </ul>
  </div>;
}
