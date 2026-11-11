"use client";
import { useEffect, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { TableSkeleton } from "./feedback";

export type PickerItem = { id: string; label: string; detail?: string; media?: ReactNode };

/** Searchable modal to pick products, collections, customers or files. `load` is called as the merchant types. */
export function Picker({ open, onOpenChange, title, searchLabel, load, multiple = true, initialSelection = [], onDone, doneLabel = "Done", className = "", overlayClassName = "", onCloseAutoFocus }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; searchLabel: string;
  load: (query: string) => Promise<PickerItem[]>; multiple?: boolean; initialSelection?: string[];
  onDone: (items: PickerItem[]) => void; doneLabel?: string;
  className?: string; overlayClassName?: string; onCloseAutoFocus?: React.ComponentProps<typeof DialogPrimitive.Content>["onCloseAutoFocus"];
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PickerItem[] | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Map<string, PickerItem>>(new Map());
  // Each time the picker opens it starts from the caller's selection and an empty search.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) { setSelected(new Map(initialSelection.map((id) => [id, { id, label: id }]))); setQuery(""); }
  }
  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setItems(null);
      load(query.trim()).then((found) => { if (active) { setItems(found); setError(""); } })
        .catch((failure: unknown) => { if (active) { setItems([]); setError(failure instanceof Error ? failure.message : "Could not load the list."); } });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [open, query, load]);
  function toggle(item: PickerItem) {
    setSelected((current) => {
      const next = new Map(multiple ? current : []);
      if (current.has(item.id)) next.delete(item.id); else next.set(item.id, item);
      return next;
    });
  }
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={`jk-overlay ${overlayClassName}`} />
      <DialogPrimitive.Content className={`jk-dialog jk-dialog-wide ${className}`} onCloseAutoFocus={onCloseAutoFocus} aria-describedby={undefined}>
        <DialogPrimitive.Title className="jk-dialog-title">{title}</DialogPrimitive.Title>
        <label className="jk-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={(event) => setQuery(event.target.value)} autoFocus /></label>
        <div className="jk-picker-list">
          {error && <p className="jk-field-error" role="alert">{error}</p>}
          {items === null ? <TableSkeleton rows={4} columns={2} label="Loading list" /> : !items.length ? <p className="jk-muted jk-pad">{query ? "Nothing matches your search." : "Nothing to choose yet."}</p> :
            items.map((item) => <label key={item.id} className="jk-picker-row">
              <input type={multiple ? "checkbox" : "radio"} name="jk-picker" checked={selected.has(item.id)} onChange={() => toggle({ ...item })} />
              {item.media}<span className="min-w-0"><span className="jk-strong">{item.label}</span>{item.detail && <span className="jk-muted block">{item.detail}</span>}</span>
            </label>)}
        </div>
        <div className="jk-dialog-footer">
          <span className="jk-muted mr-auto">{selected.size} selected</span>
          <DialogPrimitive.Close asChild><button type="button" className="jk-button">Cancel</button></DialogPrimitive.Close>
          <button type="button" className="jk-button jk-button-primary" onClick={() => { onDone([...selected.values()]); onOpenChange(false); }}>{doneLabel}</button>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}
