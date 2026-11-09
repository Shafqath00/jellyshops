"use client";



import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";



import { useLayoutEffect, useRef, useState } from "react";

import { suggestAssignmentsFromFilenames, type ProductMediaLike } from "@jelly/storefront-schema";

import type { ProductOption } from "@/lib/domain";

import type { MediaRecord } from "@/features/store-editor/api/types";

import { inputClass } from "@/features/commerce/components/product-form-styles";

import { Section } from "./section-parts";



type Props = {

  media: ProductMediaLike[];

  options: ProductOption[];

  taggingEnabled: boolean;

  onChange: (media: ProductMediaLike[]) => void;

  onUpload?: (file: File, progress: (percent: number) => void) => Promise<MediaRecord>;

  onList?: () => Promise<MediaRecord[]>;

  onDelete?: (mediaId: string) => Promise<void>;

  onBusy?: (busy: boolean) => void;

};

type Upload = { id: number; file: File; progress: number; error?: string; done?: boolean; replaceId?: string; assignment?: Record<string, string[]> };

const button = "inline-flex min-h-10 items-center justify-center rounded-lg border border-border bg-card px-3.5 py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 disabled:opacity-40";



export function PhotosSection({ media, options, taggingEnabled, onChange, onUpload, onList, onDelete, onBusy }: Props) {

  const drawerTrigger = useRef<HTMLElement | null>(null);
  const current = useRef(media);
  useLayoutEffect(() => { current.current = media; }, [media]);

  const [queue, setQueue] = useState<Upload[]>([]);

  const serial = useRef(0);

  const pending = useRef(0);

  const reserved = useRef(0);

  const [selected, setSelected] = useState<string[]>([]);

  const [library, setLibrary] = useState<MediaRecord[] | null>(null);

  const [libraryError, setLibraryError] = useState("");

  const [unusedOnly, setUnusedOnly] = useState(false);
  const [unusedCutoff, setUnusedCutoff] = useState(0);

  const [libraryLoading, setLibraryLoading] = useState(false);

  const [pickerAssignment, setPickerAssignment] = useState<Record<string, string[]> | undefined>();

  const [error, setError] = useState("");

  const [drag, setDrag] = useState<string>();

  const [editingPhoto, setEditingPhoto] = useState<string>();

  const [undo, setUndo] = useState<Array<{ id: string; appliesTo: ProductMediaLike["appliesTo"] }> | null>(null);

  const assignable = options.filter((option) => option.values.length);

  const suggestions = taggingEnabled ? suggestAssignmentsFromFilenames(media, options) : [];

  const commit = (next: ProductMediaLike[]) => { const positioned = next.map((photo, position) => ({ ...photo, position })); current.current = positioned; onChange(positioned); };

  const patchQueue = (id: number, patch: Partial<Upload>) => setQueue((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));

  async function run(item: Upload) {

    if (!onUpload) return;

    pending.current++; onBusy?.(true); patchQueue(item.id, { error: undefined, progress: 0 });

    try {

      const record = await onUpload(item.file, (progress) => patchQueue(item.id, { progress }));

      const existing = current.current.find((photo) => photo.id === record.id);

      if (item.replaceId) {

        const replaced = current.current.find((photo) => photo.id === item.replaceId);

        if (replaced) commit(current.current.filter((photo) => photo.id !== record.id || photo.id === item.replaceId).map((photo) => photo.id === item.replaceId ? { ...record, appliesTo: replaced.appliesTo, altText: replaced.altText } : photo));

      } else if (existing) {

        if (item.assignment) commit(current.current.map((photo) => photo.id === record.id ? { ...photo, appliesTo: { ...photo.appliesTo, ...item.assignment } } : photo));

      } else if (current.current.length < 30) commit([...current.current, { ...record, appliesTo: item.assignment ?? {} }]);

      else throw new Error("Gallery is full. The uploaded photo remains in your library.");

      patchQueue(item.id, { done: true, progress: 100 });

    } catch (caught) { patchQueue(item.id, { error: caught instanceof Error ? caught.message : "Upload failed." }); }

    finally { pending.current--; onBusy?.(pending.current > 0 || reserved.current > 0); }

  }

  function upload(files: FileList | null, replaceId?: string, assignment?: Record<string, string[]>) {

    if (!files) return;

    const available = replaceId ? 1 : Math.max(0, 30 - current.current.length - reserved.current);

    if (files.length > available) setError("Only 30 photos can be linked. Extra files were not uploaded.");

    const items = Array.from(files).slice(0, available).map((file) => ({ id: ++serial.current, file, progress: 0, replaceId, assignment }));

    reserved.current += items.length;

    if (items.length) onBusy?.(true);

    setQueue((all) => [...all, ...items]);

    // Sequential starts keep selection order stable while each file retains its own retry state.

    void (async () => { for (const item of items) { await run(item); reserved.current--; } onBusy?.(reserved.current > 0 || pending.current > 0); })();

  }

  async function openLibrary(assignment?: Record<string, string[]>) {

    setPickerAssignment(assignment); setLibrary([]); setLibraryError(""); setLibraryLoading(true);

    try { setLibrary(await onList?.() ?? []); }

    catch (caught) { setLibraryError(caught instanceof Error ? caught.message : "Could not load photos."); }

    finally { setLibraryLoading(false); }

  }

  function link(record: MediaRecord) {

    const existing = current.current.find((photo) => photo.id === record.id);

    if (existing) { if (pickerAssignment) commit(current.current.map((photo) => photo.id === record.id ? { ...photo, appliesTo: { ...photo.appliesTo, ...pickerAssignment } } : photo)); }

    else if (current.current.length < 30) commit([...current.current, { ...record, appliesTo: pickerAssignment ?? {} }]);

    else setError("A product can have at most 30 photos.");

  }

  function move(id: string, destination: number) {

    const list = [...current.current]; const index = list.findIndex((photo) => photo.id === id);

    if (index < 0 || destination < 0 || destination >= list.length) return;

    list.splice(destination, 0, list.splice(index, 1)[0]); commit(list);

  }

  function toggleTag(optionId: string, valueId: string, checked: boolean, ids: string[]) {

    commit(current.current.map((photo) => {

      if (!ids.includes(photo.id)) return photo;

      const appliesTo = { ...photo.appliesTo };

      const values = new Set(appliesTo[optionId] ?? []);

      if (checked) values.add(valueId); else values.delete(valueId);

      if (values.size) appliesTo[optionId] = [...values]; else delete appliesTo[optionId];

      return { ...photo, appliesTo };

    }));

  }

  const tags = (ids: string[]) => <div className="space-y-2">{assignable.map((option) => <fieldset key={option.id}><legend className="font-bold">{option.name}</legend><div className="flex flex-wrap gap-2">{option.values.map((value) => <label key={value.id} className="flex items-center gap-1"><input type="checkbox" checked={ids.every((id) => media.find((photo) => photo.id === id)?.appliesTo?.[option.id]?.includes(value.id))} onChange={(event) => toggleTag(option.id, value.id, event.target.checked, ids)} />{value.label}</label>)}</div></fieldset>)}</div>;

  return (

    <Section title="Photos" hint={`${media.length} of 30 · The first photo is your cover. You can reorder photos any time.`}>

      <div className={media.length ? "flex flex-wrap gap-2" : "flex flex-wrap justify-center gap-2 rounded-lg border border-dashed border-border p-6"}>

        {media.length === 0 && <p className="w-full text-center text-sm">Add your first product photo</p>}

        {onUpload && <label className={`${button} cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90`}>Add photos<input className="sr-only" aria-label="Add product photos" type="file" accept="image/*" multiple onChange={(event) => { upload(event.target.files); event.target.value = ""; }} /></label>}

        {onList && <button type="button" className={button} onClick={event => { drawerTrigger.current = event.currentTarget; void openLibrary(); }}>Choose from library</button>}

      </div>

      {error && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3.5 py-2.5 text-[12px] text-destructive">{error}</p>}

      {queue.filter((item) => !item.done).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/25 px-3.5 py-3 text-[12px]" aria-live="polite"><span className="min-w-0 truncate font-medium text-foreground">{item.file.name} · {item.error ?? `${item.progress}%`}</span>{item.error ? <button type="button" className={button} onClick={() => void run(item)}>Retry {item.file.name}</button> : <progress className="h-2 w-40 accent-primary" value={item.progress} max={100} aria-label={`Uploading ${item.file.name}`} />}</div>)}

      {selected.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/30 p-3 text-[12px]"><p className="font-semibold">{selected.length} selected</p><button type="button" className={button} onClick={() => { commit(media.filter((photo) => !selected.includes(photo.id))); setSelected([]); }}>Remove selected from product</button>{taggingEnabled && <details><summary className="cursor-pointer font-semibold">Show selected for…</summary>{tags(selected)}<button type="button" className={button} onClick={() => commit(media.map((photo) => selected.includes(photo.id) ? { ...photo, appliesTo: {} } : photo))}>Show for everything</button></details>}</div>}

      <div className="admin-photo-grid">

        {media.map((photo, index) => (

          <article key={photo.id} aria-label={index === 0 ? "Cover photo" : `Product photo ${index + 1}`} draggable onDragStart={() => setDrag(photo.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (drag) move(drag, index); setDrag(undefined); }} className="admin-photo-tile">

            <label className="flex min-h-8 items-center gap-2 px-2 text-[13px] font-medium text-foreground"><input type="checkbox" checked={selected.includes(photo.id)} onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, photo.id] : ids.filter((id) => id !== photo.id))} /><span className={index === 0 ? "rounded-md bg-accent px-2 py-1 text-[13px]" : "text-[13px] text-muted-foreground"}>{index === 0 ? "Cover photo" : `Photo ${index + 1}`}</span></label>

            <button type="button" aria-label={`Edit photo ${index + 1}`} onClick={event => { drawerTrigger.current = event.currentTarget; setEditingPhoto(photo.id); }}>

              {/* eslint-disable-next-line @next/next/no-img-element */}

              <img src={photo.url} alt={photo.altText ?? ""} className="aspect-square w-full object-cover" />

            </button>

            {editingPhoto === photo.id && <Sheet open onOpenChange={(open) => { if (!open) setEditingPhoto(undefined); }}><SheetContent onCloseAutoFocus={event => { event.preventDefault(); if (drawerTrigger.current?.isConnected) drawerTrigger.current.focus(); }} className="jk-sheet overflow-y-auto">

              <SheetTitle>{index === 0 ? "Cover photo" : `Photo ${index + 1}`}</SheetTitle><SheetDescription>Edit this photo’s description and where it appears.</SheetDescription>

              <img src={photo.url} alt={photo.altText ?? ""} className="my-4 max-h-64 w-full rounded-lg object-contain" />

              {index > 0 && <button type="button" className={button} onClick={() => move(photo.id, 0)}>Make cover photo</button>}

            {photo.width && photo.height && Math.min(photo.width, photo.height) < 800 ? <p className="mt-2 rounded-md bg-accent/25 px-2.5 py-2 text-[13px] leading-4 text-foreground">Small photo ({photo.width} × {photo.height}). A larger image will look sharper.</p> : null}

            <label className="mt-2.5 block text-[13px] font-semibold text-muted-foreground">Describe this photo<input aria-label={`Alt text for photo ${index + 1}`} className={`${inputClass} !mt-1.5 h-10 bg-background text-[12px]`} value={photo.altText ?? ""} onChange={(event) => commit(media.map((item) => item.id === photo.id ? { ...item, altText: event.target.value } : item))} /></label>

            <div className="mt-2.5 flex flex-wrap gap-1.5"><button type="button" className={`${button} !min-h-9 !px-2.5`} disabled={index === 0} aria-label={`Move photo ${index + 1} up`} onClick={() => move(photo.id, index - 1)}>↑</button><button type="button" className={`${button} !min-h-9 !px-2.5`} disabled={index === media.length - 1} aria-label={`Move photo ${index + 1} down`} onClick={() => move(photo.id, index + 1)}>↓</button>{onUpload && <label className={`${button} !min-h-9 cursor-pointer !px-2.5`}>Replace<input type="file" accept="image/*" className="sr-only" aria-label={`Replace photo ${index + 1}`} onChange={(event) => { upload(event.target.files, photo.id); event.target.value = ""; }} /></label>}<button type="button" className={`${button} !min-h-9 !px-2.5`} onClick={() => commit(media.filter((item) => item.id !== photo.id))}>Remove photo {index + 1}</button></div>

            {taggingEnabled && <details className="mt-3 border-t border-border/70 pt-2.5"><summary className="cursor-pointer text-[13px] font-semibold text-muted-foreground">{Object.keys(photo.appliesTo ?? {}).length ? Object.entries(photo.appliesTo ?? {}).flatMap(([optionId, values]) => values.map((id) => options.find((option) => option.id === optionId)?.values.find((value) => value.id === id)?.label)).filter(Boolean).join(" · ") : "All shoppers"} · Show for…</summary>{tags([photo.id])}</details>}

            </SheetContent></Sheet>}

          </article>

        ))}

      </div>

      {suggestions.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/70 bg-accent/15 px-3.5 py-3 text-[12px]"><p className="text-foreground">Some filenames may match your choices.</p><button type="button" className={button} onClick={() => { setUndo(media.map(({ id, appliesTo }) => ({ id, appliesTo }))); commit(media.map((photo) => { const suggested = suggestions.find((suggestion) => suggestion.mediaId === photo.id); return suggested ? { ...photo, appliesTo: suggested.appliesTo } : photo; })); }}>Apply suggested tags</button></div>}

      {undo && <button type="button" className={button} onClick={() => { commit(media.map((photo) => { const before = undo.find((item) => item.id === photo.id); return before ? { ...photo, appliesTo: before.appliesTo } : photo; })); setUndo(null); }}>Undo suggested tags</button>}

      {taggingEnabled && assignable.map((option) => <details key={option.id} open={option.display === "color" || /colou?r|finish|style|pattern|material/i.test(option.name)} className="rounded-xl border border-border bg-muted/20 p-3 text-[12px]"><summary className="cursor-pointer font-semibold">Photos change with {option.name}</summary>{option.values.map((value) => <div key={value.id} className="mt-3"><p className="font-semibold">{value.label}</p><div className="my-2 flex gap-2">{media.filter((photo) => photo.appliesTo?.[option.id]?.includes(value.id)).map((photo) => <span key={photo.id}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={photo.url} alt={photo.altText ?? value.label} className="size-12 rounded-md object-cover" /><button type="button" aria-label={`Unassign ${value.label} photo`} onClick={() => toggleTag(option.id, value.id, false, [photo.id])}>×</button></span>)}</div>{!media.some((photo) => photo.appliesTo?.[option.id]?.includes(value.id)) && <p className="mb-2 text-muted-foreground">No assigned photos. Shoppers see shared photos.</p>}{onList && <button type="button" className={button} onClick={() => void openLibrary({ [option.id]: [value.id] })}>Choose photos for {value.label}</button>}{onUpload && <label className={`${button} cursor-pointer`}>Upload for {value.label}<input className="sr-only" aria-label={`Upload photos for ${value.label}`} type="file" multiple accept="image/*" onChange={(event) => { upload(event.target.files, undefined, { [option.id]: [value.id] }); event.target.value = ""; }} /></label>}</div>)}</details>)}

      {library !== null && <Sheet open onOpenChange={(open) => { if (!open) setLibrary(null); }}><SheetContent onCloseAutoFocus={event => { event.preventDefault(); if (drawerTrigger.current?.isConnected) drawerTrigger.current.focus(); }} className="jk-sheet overflow-y-auto p-6"><SheetTitle>Photo library</SheetTitle><SheetDescription>Choose photos to reuse in this product. Removing from a product keeps the original here.</SheetDescription><label className="my-3 flex gap-2 text-xs"><input type="checkbox" checked={unusedOnly} onChange={(event) => { setUnusedOnly(event.target.checked); if (event.target.checked) setUnusedCutoff(Date.now() - 30 * 86400000); }} />Unused for over 30 days</label><button type="button" className={button} autoFocus onClick={() => setLibrary(null)}>Done choosing photos</button>{libraryLoading && <p role="status">Loading photos…</p>}{libraryError && <p role="alert">{libraryError}</p>}<div className="mt-4 grid grid-cols-3 gap-3">{library.filter((record) => !unusedOnly || (!record.referenced && Date.parse(record.createdAt) < unusedCutoff)).map((record) => <div key={record.id}><button type="button" key={record.id} className="rounded-xl border p-2 text-xs" onClick={() => link(record)}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={record.url} alt={record.originalName} className="aspect-square w-full object-cover" />{record.originalName}<span className="block">{media.some((photo) => photo.id === record.id) ? "In product" : "Add photo"}</span></button>{unusedOnly && onDelete && !media.some((photo) => photo.id === record.id) && <button type="button" className={button} onClick={async () => { if (!window.confirm("Permanently delete this unused library photo?")) return; try { await onDelete(record.id); setLibrary((items) => items?.filter((item) => item.id !== record.id) ?? null); } catch (caught) { setLibraryError(caught instanceof Error ? caught.message : "Could not delete photo."); } }}>Delete unused photo</button>}</div>)}</div></SheetContent></Sheet>}

    </Section>

  );

}

