"use client";

import { useMemo, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CornerDownRight, GripVertical, Plus, Trash2 } from "lucide-react";
import { MAX_MENU_DEPTH } from "@jelly/storefront-schema";
import { Button, Field } from "@/components/admin";
import type { MenuItem, MenuTarget } from "../api/client";
import { describeTarget, linkProblem, type LinkResource, type LinkResources } from "../link-check";
import {
  addMenuItem, flattenMenu, indentMenuItem, levelsOf, moveMenuItem, newMenuItemId, outdentMenuItem, projectedDepth, removeMenuItem, replaceMenuItem, shiftMenuItem,
} from "../menu-tree";
import { LinkPicker } from "./link-picker";
import { MenuPhotoField } from "./menu-link-form";

const INDENT = 28;

/** Problems with one link: no name, or a destination shoppers can't reach. */
export function itemProblem(item: MenuItem, resources: LinkResources): string | null {
  if (!item.label.trim()) return "Give this link a name.";
  return linkProblem(item.target, resources);
}

function Row({ item, depth, parentLabel, selected, problem, resources, onSelect, onAction, canAddInside, projected }: {
  item: MenuItem; depth: number; parentLabel: string | null; selected: boolean; problem: string | null; resources: LinkResources;
  onSelect: () => void; onAction: (action: "up" | "down" | "in" | "out" | "add" | "remove") => void; canAddInside: boolean; projected: number | null;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const shownDepth = projected ?? depth;
  return (
    <li ref={setNodeRef} className="jnav-row" data-selected={selected} data-dragging={isDragging}
      style={{ transform: CSS.Translate.toString(transform), transition, paddingLeft: 8 + shownDepth * INDENT }}
      aria-label={`${item.label || "Unnamed link"}${parentLabel ? `, inside ${parentLabel}` : ""}`}>
      <button type="button" className="jnav-grip" aria-label={`Drag to move ${item.label || "link"}. Use the arrow keys to move, then space to drop.`} {...attributes} {...listeners}>
        <GripVertical size={16} aria-hidden />
      </button>
      {depth > 0 && <CornerDownRight size={14} className="jnav-nest" aria-hidden />}
      <button type="button" className="jnav-row-main" onClick={onSelect} aria-pressed={selected}>
        <strong>{item.label || <em className="jnav-unnamed">Unnamed link</em>}</strong>
        <small>{describeTarget(item.target, resources)}{item.image?.url ? " · with photo" : ""}</small>
      </button>
      {problem && <span className="jnav-warning" title={problem}><AlertTriangle size={15} aria-hidden /><span className="jnav-sr">Problem: {problem}</span></span>}
      <span className="jnav-row-actions">
        <button type="button" className="jnav-icon" aria-label={`Move ${item.label || "link"} up`} title="Move up" onClick={() => onAction("up")}><ArrowUp size={15} aria-hidden /></button>
        <button type="button" className="jnav-icon" aria-label={`Move ${item.label || "link"} down`} title="Move down" onClick={() => onAction("down")}><ArrowDown size={15} aria-hidden /></button>
        <button type="button" className="jnav-icon" aria-label={`Move ${item.label || "link"} out one level`} title="Move out one level" disabled={depth === 0} onClick={() => onAction("out")}><ArrowLeft size={15} aria-hidden /></button>
        <button type="button" className="jnav-icon" aria-label={`Move ${item.label || "link"} into the link above`} title="Move into the link above" onClick={() => onAction("in")}><ArrowRight size={15} aria-hidden /></button>
        {canAddInside && <button type="button" className="jnav-icon" aria-label={`Add a link inside ${item.label || "this link"}`} title="Add a link inside" onClick={() => onAction("add")}><Plus size={15} aria-hidden /></button>}
        <button type="button" className="jnav-icon jnav-icon--danger" aria-label={`Remove ${item.label || "link"}`} title="Remove" onClick={() => onAction("remove")}><Trash2 size={15} aria-hidden /></button>
      </span>
    </li>
  );
}

function LinkSettings({ item, resources, searchProducts, uploadImage, onChange, onDone, onRemove }: {
  item: MenuItem; resources: LinkResources; searchProducts: (query: string) => Promise<LinkResource[]>; uploadImage?: (file: File) => Promise<string>;
  onChange: (item: MenuItem) => void; onDone: () => void; onRemove: () => void;
}) {
  const problem = linkProblem(item.target, resources);
  return (
    <section className="jnav-settings jk-card" aria-label={`Settings for ${item.label || "the new link"}`}>
      <div className="jk-stack-sm">
        <h2 className="jk-subheading">Link</h2>
        <Field id={`label-${item.id}`} label="Name" required help="What shoppers see in the menu." error={!item.label.trim() ? "Give this link a name." : undefined}>
          <input id={`label-${item.id}`} value={item.label} maxLength={120} autoFocus={!item.label}
            onChange={(event) => onChange({ ...item, label: event.target.value })} placeholder="e.g. Beds" />
        </Field>
        <Field id={`target-${item.id}`} label="Goes to" error={problem ?? undefined}>
          <LinkPicker id={`target-${item.id}`} value={item.target} resources={resources} searchProducts={searchProducts} invalid={Boolean(problem)}
            onChange={(target: MenuTarget, suggested) => onChange({ ...item, target, label: item.label.trim() ? item.label : suggested })} />
        </Field>
        {uploadImage && <MenuPhotoField id={`photo-${item.id}`} url={item.image?.url ?? ""} alt={item.image?.alt ?? ""} upload={uploadImage}
          onUrl={(url) => onChange({ ...item, ...(url ? { image: { url, alt: item.image?.alt ?? "" } } : { image: undefined }) })}
          onAlt={(alt) => item.image && onChange({ ...item, image: { ...item.image, alt } })} />}
        <div className="jk-row">
          <Button variant="primary" onClick={onDone}>Done</Button>
          <Button variant="destructive-quiet" icon={<Trash2 size={14} aria-hidden />} onClick={onRemove}>Remove link</Button>
        </div>
      </div>
    </section>
  );
}

/**
 * Builds one menu: links in order, nested up to three levels (dropdowns and large-menu columns). Drag a link by its
 * handle (sideways to nest it), or use the arrow buttons and the keyboard. Selecting a link opens its settings.
 */
export function MenuBuilder({ items, onChange, resources, searchProducts, uploadImage }: {
  items: MenuItem[]; onChange: (items: MenuItem[]) => void; resources: LinkResources;
  searchProducts: (query: string) => Promise<LinkResource[]>; uploadImage?: (file: File) => Promise<string>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ activeId: string; overId: string; offset: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const flat = useMemo(() => flattenMenu(items), [items]);
  const selected = flat.find((entry) => entry.id === selectedId)?.item ?? null;
  const labels = new Map(flat.map((entry) => [entry.id, entry.item.label || "Unnamed link"]));

  const change = (next: MenuItem[], message?: string) => { onChange(next); if (message) setAnnouncement(message); };

  function act(entryId: string, action: "up" | "down" | "in" | "out" | "add" | "remove") {
    const label = labels.get(entryId) ?? "Link";
    if (action === "up" || action === "down") change(shiftMenuItem(items, entryId, action === "up" ? -1 : 1), `${label} moved ${action}.`);
    else if (action === "in") {
      const next = indentMenuItem(items, entryId);
      if (next) change(next, `${label} moved into the link above.`);
      else setAnnouncement(`${label} can't go deeper: menus have at most ${MAX_MENU_DEPTH} levels, and it needs a link above it.`);
    } else if (action === "out") {
      const next = outdentMenuItem(items, entryId);
      if (next) change(next, `${label} moved out one level.`);
    } else if (action === "add") {
      const child: MenuItem = { id: newMenuItemId(), label: "", target: { kind: "home" }, children: [] };
      change(addMenuItem(items, child, entryId), `New link added inside ${label}.`);
      setSelectedId(child.id);
    } else {
      change(removeMenuItem(items, entryId), `${label} removed.${flat.find((entry) => entry.id === entryId)?.item.children.length ? " Its links moved up a level." : ""}`);
      if (selectedId === entryId) setSelectedId(null);
    }
  }

  function addTopLevel() {
    const item: MenuItem = { id: newMenuItemId(), label: "", target: { kind: "home" }, children: [] };
    change(addMenuItem(items, item), "New link added at the end.");
    setSelectedId(item.id);
  }

  const onDragStart = (event: DragStartEvent) => setDrag({ activeId: String(event.active.id), overId: String(event.active.id), offset: 0 });
  const onDragMove = (event: DragMoveEvent) => setDrag((current) => current ? { ...current, overId: String(event.over?.id ?? current.overId), offset: event.delta.x } : current);
  const onDragEnd = (event: DragEndEvent) => {
    const current = drag;
    setDrag(null);
    if (!current || !event.over) return;
    const activeId = String(event.active.id);
    const overId = String(event.over.id);
    const wanted = projectedDepth(items, activeId, overId, event.delta.x, INDENT);
    const next = moveMenuItem(items, activeId, overId, wanted);
    if (JSON.stringify(next) !== JSON.stringify(items)) change(next, `${labels.get(activeId) ?? "Link"} moved.`);
  };

  const projectedFor = (entryId: string): number | null => {
    if (!drag || drag.activeId !== entryId) return null;
    const entry = flat.find((other) => other.id === entryId)!;
    return Math.max(0, Math.min(entry.depth + Math.round(drag.offset / INDENT), MAX_MENU_DEPTH - levelsOf(entry.item)));
  };

  return (
    <div className="jnav-builder">
      <div className="jnav-tree-wrap">
        {flat.length === 0 ? (
          <div className="jnav-empty">
            <p><strong>This menu has no links yet.</strong></p>
            <p className="jk-muted">Add links to collections, pages or products. Put links inside a link to make a dropdown.</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={() => setDrag(null)}
            accessibility={{ announcements: {
              onDragStart: ({ active }) => `Picked up ${labels.get(String(active.id))}.`,
              onDragOver: ({ active, over }) => over ? `${labels.get(String(active.id))} is over ${labels.get(String(over.id))}.` : "",
              onDragEnd: ({ active, over }) => over ? `${labels.get(String(active.id))} dropped.` : "Move cancelled.",
              onDragCancel: ({ active }) => `Moving ${labels.get(String(active.id))} cancelled.`,
            } }}>
            <SortableContext items={flat.map((entry) => entry.id)} strategy={verticalListSortingStrategy}>
              <ol className="jnav-tree" aria-label="Links in this menu">
                {flat.map((entry) => [
                  <Row key={entry.id} item={entry.item} depth={entry.depth} parentLabel={entry.parentId ? labels.get(entry.parentId) ?? null : null}
                    selected={entry.id === selectedId} problem={itemProblem(entry.item, resources)} resources={resources}
                    canAddInside={entry.depth < MAX_MENU_DEPTH - 1}
                    projected={projectedFor(entry.id)}
                    onSelect={() => setSelectedId(entry.id === selectedId ? null : entry.id)}
                    onAction={(action) => act(entry.id, action)} />,
                  // Settings open right under the link they belong to, so they are always in view.
                  entry.id === selectedId && selected ? (
                    <li key={`${entry.id}-settings`} className="jnav-inline-settings" style={{ marginLeft: entry.depth * INDENT }}>
                      <LinkSettings item={selected} resources={resources} searchProducts={searchProducts} uploadImage={uploadImage}
                        onChange={(item) => onChange(replaceMenuItem(items, item))}
                        onDone={() => setSelectedId(null)}
                        onRemove={() => act(selected.id, "remove")} />
                    </li>
                  ) : null,
                ])}
              </ol>
            </SortableContext>
          </DndContext>
        )}
        <Button icon={<Plus size={15} aria-hidden />} onClick={addTopLevel}>Add link</Button>
        <p className="jnav-hint">Drag a link by <GripVertical size={13} aria-hidden /> to reorder; drag it to the right to put it inside the link above. Up to {MAX_MENU_DEPTH} levels.</p>
        <p className="jnav-sr" role="status" aria-live="polite">{announcement}</p>
      </div>
    </div>
  );
}
