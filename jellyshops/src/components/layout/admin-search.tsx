"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { adminDestinations } from "./admin-nav";

/**
 * Top-bar search for admin pages (it finds pages, not records). Ctrl/Cmd+K focuses it;
 * arrow keys move through the matches, Enter opens one, Escape clears and closes.
 */
export function AdminSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const destinations = useMemo(() => adminDestinations(), []);
  const term = query.trim().toLowerCase();
  const matches = term ? destinations.filter((item) => `${item.label} ${item.group}`.toLowerCase().includes(term)).slice(0, 8) : [];
  const showList = open && term.length > 0;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); inputRef.current?.focus(); setOpen(true); }
    };
    const onPointer = (event: PointerEvent) => { if (!boxRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); };
  }, []);

  const go = (href: string) => { setQuery(""); setOpen(false); inputRef.current?.blur(); router.push(href); };

  return <div className="admin-finder" ref={boxRef}>
    <label className="admin-finder-field">
      <Search size={16} aria-hidden="true" />
      <input ref={inputRef} type="search" role="combobox" aria-label="Search pages" placeholder="Search pages" autoComplete="off"
        aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={showList && matches[active] ? `${listId}-${active}` : undefined}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") { setQuery(""); setOpen(false); }
          else if (event.key === "ArrowDown" && matches.length) { event.preventDefault(); setActive((value) => (value + 1) % matches.length); }
          else if (event.key === "ArrowUp" && matches.length) { event.preventDefault(); setActive((value) => (value - 1 + matches.length) % matches.length); }
          else if (event.key === "Enter" && matches[active]) { event.preventDefault(); go(matches[active].href); }
        }} />
      <kbd className="admin-finder-kbd" aria-hidden="true">Ctrl K</kbd>
    </label>
    {showList && <div className="admin-finder-results">
      {matches.length ? <ul role="listbox" id={listId} aria-label="Pages">
        {matches.map((item, index) => <li key={item.href} id={`${listId}-${index}`} role="option" aria-selected={index === active} className="admin-finder-option"
          onPointerMove={() => setActive(index)} onPointerDown={(event) => { event.preventDefault(); go(item.href); }}>
          <item.icon size={16} aria-hidden="true" />{item.label}{item.group && <small>{item.group}</small>}
        </li>)}
      </ul> : <p className="admin-finder-empty" id={listId} role="status">No pages match “{query.trim()}”.</p>}
    </div>}
  </div>;
}
