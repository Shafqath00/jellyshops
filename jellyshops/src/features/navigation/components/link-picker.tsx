"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { BookOpen, FileText, Globe, Hash, Home, Layers, Newspaper, Package, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MenuTarget } from "../api/client";
import { describeTarget, linkProblem, type LinkResource, type LinkResources } from "../link-check";

interface Option {
  key: string;
  group: string;
  label: string;
  detail: string;
  icon: LucideIcon;
  target: MenuTarget;
  /** The name to give the link when it has none yet. */
  suggestedLabel: string;
  warning?: string;
}

const STATE_NOTE: Record<LinkResource["state"], string> = { live: "", draft: "Draft", scheduled: "Scheduled", archived: "Archived" };

function resourceOptions(list: LinkResource[], kind: "page" | "article" | "blog" | "collection" | "product", group: string, icon: LucideIcon, query: string): Option[] {
  const words = query.toLowerCase();
  return list
    .filter((entry) => !words || entry.title.toLowerCase().includes(words) || entry.path.includes(words))
    .slice(0, 8)
    .map((entry) => ({
      key: `${kind}:${entry.id}`, group, label: entry.title, detail: entry.path, icon,
      target: { kind, resourceId: entry.id } as MenuTarget, suggestedLabel: entry.title,
      ...(entry.state !== "live" ? { warning: STATE_NOTE[entry.state] } : {}),
    }));
}

/** What a typed text could mean as a destination: a web address, a store path or a section anchor. */
export function typedTarget(text: string): MenuTarget | null {
  const value = text.trim();
  if (!value) return null;
  if (value.startsWith("#") && value.length > 1) return { kind: "anchor", anchor: value.slice(1) };
  if (value.startsWith("/") || /^(https?:|mailto:|tel:)/i.test(value)) return { kind: "external", url: value };
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(value)) return { kind: "external", url: `https://${value}` };
  return null;
}

/**
 * Choose where a menu link goes by typing: pages, blog posts, blogs, collections and products are searched as you
 * type, and a typed web address or /store-path can be used as it is. Arrow keys and Enter work; Escape closes.
 */
export function LinkPicker({ id, value, resources, searchProducts, onChange, invalid }: {
  id: string;
  value: MenuTarget | null;
  resources: LinkResources;
  searchProducts: (query: string) => Promise<LinkResource[]>;
  onChange: (target: MenuTarget, suggestedLabel: string) => void;
  invalid?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [products, setProducts] = useState<LinkResource[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Products are searched on the server after a pause in typing.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const timer = setTimeout(() => { searchProducts(query).then((found) => { if (alive) setProducts(found); }).catch(() => undefined); }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [open, query, searchProducts]);

  const options = useMemo<Option[]>(() => {
    const words = query.trim().toLowerCase();
    const fixed = ([
      { key: "home", group: "Your store", label: "Home page", detail: "/", icon: Home, target: { kind: "home" } as MenuTarget, suggestedLabel: "Home" },
      { key: "search", group: "Your store", label: "Search page", detail: "/search", icon: Search, target: { kind: "search" } as MenuTarget, suggestedLabel: "Search" },
    ] satisfies Option[]).filter((option) => !words || option.label.toLowerCase().includes(words));
    const typed = typedTarget(query);
    const typedOption: Option[] = typed ? [{
      key: "typed", group: "Use what you typed", label: typed.kind === "anchor" ? `Section #${typed.anchor}` : typed.kind === "external" ? typed.url : "",
      detail: typed.kind === "anchor" ? "A place on the same page" : typed.kind === "external" && typed.url.startsWith("/") ? "A page in your store" : "A web address",
      icon: typed.kind === "anchor" ? Hash : Globe, target: typed, suggestedLabel: "",
      ...(linkProblem(typed, resources) ? { warning: "Not valid" } : {}),
    }] : [];
    return [
      ...typedOption,
      ...fixed,
      ...resourceOptions(resources.collections, "collection", "Collections", Layers, words),
      ...resourceOptions(products, "product", "Products", Package, ""),
      ...resourceOptions(resources.pages, "page", "Pages", FileText, words),
      ...resourceOptions(resources.blogs, "blog", "Blogs", BookOpen, words),
      ...resourceOptions(resources.posts, "article", "Blog posts", Newspaper, words),
    ];
  }, [products, query, resources]);

  const choose = (option: Option) => {
    onChange(option.target, option.suggestedLabel);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive((index) => Math.min(index + 1, options.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
    else if (event.key === "Enter" && open && options[active]) { event.preventDefault(); choose(options[active]!); }
    else if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); }
  };

  const current = value ? describeTarget(value, resources) : "";
  let lastGroup = "";
  return (
    <div className="jnav-picker">
      {value && <p className="jnav-picker-current" aria-live="polite">Links to: <strong>{current}</strong></p>}
      <input ref={inputRef} id={id} type="text" role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" autoComplete="off"
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined} aria-invalid={invalid || undefined}
        placeholder={value ? "Search to change: pages, collections, products, or paste a web address" : "Search pages, collections, products, or paste a web address"}
        value={query}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown} />
      {open && (
        <ul id={listId} role="listbox" className="jnav-picker-list" aria-label="Destinations">
          {options.length === 0 && <li className="jnav-picker-empty">Nothing matches. Paste a full web address (https://…) or a store path (/pages/faq).</li>}
          {options.map((option, index) => {
            const heading = option.group !== lastGroup ? option.group : null;
            lastGroup = option.group;
            return [
              heading ? <li key={`${option.key}-group`} role="presentation" className="jnav-picker-group">{heading}</li> : null,
              <li key={option.key} id={`${listId}-${index}`} role="option" aria-selected={index === active} className="jnav-picker-option"
                onMouseDown={(event) => { event.preventDefault(); choose(option); }} onMouseEnter={() => setActive(index)}>
                <option.icon size={16} aria-hidden />
                <span><strong>{option.label}</strong><small>{option.detail}</small></span>
                {option.warning && <em className="jnav-picker-warning">{option.warning}</em>}
              </li>,
            ];
          })}
        </ul>
      )}
    </div>
  );
}
