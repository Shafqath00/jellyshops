"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { ImagePlus, UploadCloud } from "lucide-react";
import { AdminPage, Banner, Button, Card, EmptyState, StatusBadge, buttonClass, type StatusTone } from "@/components/admin";
import type { PhotoMatch, ProductBulkApi } from "./api";

export const MAX_BULK_PHOTOS = 300;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
type State = "waiting" | "uploading" | "added" | "already" | "failed";
interface Item { id: number; file: File; preview: string; match?: PhotoMatch; state: State; message?: string }
const STATE: Record<State, { label: string; tone: StatusTone }> = {
  waiting: { label: "Ready", tone: "neutral" }, uploading: { label: "Uploading", tone: "info" }, added: { label: "Added", tone: "success" },
  already: { label: "Already on the product", tone: "neutral" }, failed: { label: "Not added", tone: "critical" },
};
const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString("en-GB")} ${count === 1 ? one : many}`;
const byName = (a: Item, b: Item) => a.file.name.localeCompare(b.file.name, undefined, { numeric: true, sensitivity: "base" });

/**
 * Products > Add photos in bulk. The merchant drops many photo files; each is matched to a product by
 * its file name (an item's SKU, or the product's web address ending), shown in a preview, and only
 * then uploaded. Photos are added after the ones a product already has.
 */
export function BulkPhotos({ api }: { api: ProductBulkApi | null }) {
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [matching, setMatching] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [finished, setFinished] = useState(false);
  const [dragging, setDragging] = useState(false);
  const serial = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const previews = useRef<string[]>([]);
  useEffect(() => () => { for (const url of previews.current) URL.revokeObjectURL(url); }, []);

  async function add(list: FileList | File[] | null | undefined) {
    if (!api || !list?.length) return;
    setError(""); setFinished(false);
    const chosen = Array.from(list);
    const images = chosen.filter((file) => file.type.startsWith("image/") && file.size <= MAX_PHOTO_BYTES);
    const room = MAX_BULK_PHOTOS - items.length;
    const notes: string[] = [];
    if (chosen.some((file) => !file.type.startsWith("image/"))) notes.push("Files that are not photos were left out.");
    if (chosen.some((file) => file.type.startsWith("image/") && file.size > MAX_PHOTO_BYTES)) notes.push("Photos larger than 10 MB were left out.");
    if (images.length > room) notes.push(`Only ${MAX_BULK_PHOTOS} photos can be added at a time; the rest were left out.`);
    const fresh = images.slice(0, Math.max(0, room)).map((file): Item => { const preview = URL.createObjectURL(file); previews.current.push(preview); return { id: ++serial.current, file, preview, state: "waiting" }; });
    if (notes.length) setError(notes.join(" "));
    if (!fresh.length) return;
    setItems((current) => [...current, ...fresh].sort(byName));
    setMatching(true);
    try {
      const matches = await api.matchPhotos(fresh.map((item) => item.file.name));
      setItems((current) => current.map((item) => { const index = fresh.findIndex((entry) => entry.id === item.id); return index >= 0 ? { ...item, match: matches[index] } : item; }));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "We could not look up your products. Try again."); }
    finally { setMatching(false); if (input.current) input.current.value = ""; }
  }
  function drop(event: DragEvent<HTMLElement>) { event.preventDefault(); setDragging(false); void add(event.dataTransfer.files); }

  const ready = useMemo(() => items.filter((item) => item.match?.product && item.state === "waiting"), [items]);
  const unmatched = items.filter((item) => item.match && !item.match.product);
  const busy = progress !== null;
  const tally = (state: State) => items.filter((item) => item.state === state).length;

  async function upload() {
    if (!api || !ready.length) return;
    setError(""); setProgress({ done: 0, total: ready.length });
    const set = (id: number, change: Partial<Item>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...change } : item));
    // One at a time and in name order, so photos land on each product in the order of their file names.
    for (const [index, item] of ready.entries()) {
      set(item.id, { state: "uploading" });
      try {
        const result = await api.addPhoto(item.match!.product!.id, item.file);
        set(item.id, { state: result.added ? "added" : "already" });
      } catch (failure) {
        set(item.id, { state: "failed", message: failure instanceof Error ? failure.message : "The photo could not be uploaded." });
      }
      setProgress({ done: index + 1, total: ready.length });
    }
    setProgress(null); setFinished(true);
  }
  function clear() { setItems([]); setError(""); setFinished(false); }

  return <AdminPage title="Add photos in bulk" width="detail" back={{ href: "/admin/products", label: "Products" }} description="Drop in many photos at once. Each one goes to the product its file name points to, and you see the matches before anything is uploaded.">
    {error && <Banner tone="warning" onDismiss={() => setError("")}>{error}</Banner>}
    {!api && <Banner tone="warning">Sign in and choose a store to add photos.</Banner>}
    <Card>
      <div className={`jk-dropzone ${dragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
        <UploadCloud size={28} aria-hidden="true" />
        <p className="jk-strong">Drag photos here, or choose them</p>
        <p className="jk-muted">JPEG, PNG, WebP, GIF or AVIF. Up to {MAX_BULK_PHOTOS} photos at a time, 10 MB each.</p>
        <label className={`${buttonClass("primary")} ${busy || !api ? "is-disabled" : ""}`} aria-disabled={busy || !api}>Choose photos
          <input ref={input} type="file" className="sr-only" accept="image/*" multiple disabled={busy || !api} aria-label="Choose photos" onChange={(event) => void add(event.target.files)} />
        </label>
      </div>
    </Card>
    <Card title="How to name your files" description="A photo finds its product by its file name.">
      <ul className="jk-bullets">
        <li>Use the item&apos;s stock code (SKU): <code className="jk-code">OAK-BED-DBL.jpg</code></li>
        <li>Or the product&apos;s web address ending: <code className="jk-code">oak-bed-frame.jpg</code></li>
        <li>For several photos of one product add a number: <code className="jk-code">oak-bed-frame-1.jpg</code>, <code className="jk-code">oak-bed-frame-2.jpg</code>. They are added in that order.</li>
        <li>Capital letters do not matter. Photos are added after the ones the product already has; nothing is removed.</li>
      </ul>
    </Card>

    {items.length === 0 ? <Card flush><EmptyState icon={ImagePlus} title="No photos chosen yet" description="Choose your photos to see which product each one will go to." /></Card> : <Card title={`${plural(items.length, "photo")} chosen`} flush
      actions={<div className="jk-row">{!busy && <Button size="small" variant="quiet" onClick={clear}>Clear all</Button>}</div>}>
      <div className="jk-pad jk-stack-sm">
        {matching ? <p className="jk-muted" role="status">Finding the product for each photo…</p> : <p className="jk-strong" role="status">
          {finished ? `${plural(tally("added"), "photo")} added${tally("already") ? `, ${tally("already")} already there` : ""}${tally("failed") ? `, ${tally("failed")} not added` : ""}.`
            : `${plural(ready.length, "photo")} matched to a product${unmatched.length ? `, ${unmatched.length} not matched` : ""}.`}
        </p>}
        {unmatched.length > 0 && !finished && <Banner tone="warning" title={`${plural(unmatched.length, "photo")} did not match a product`}>They will not be uploaded. Rename them to a product&apos;s SKU or web address ending and add them again.</Banner>}
        {finished && tally("failed") === 0 && tally("added") > 0 && <Banner tone="success">Your photos are on their products. Open a product to change their order or describe them.</Banner>}
        {busy && <div className="jk-progress-block"><progress className="jk-progress" max={progress.total} value={progress.done} aria-label="Upload progress" /><span role="status" aria-live="polite">Uploading {progress.done} of {progress.total}…</span></div>}
      </div>
      <div className="jk-table-scroll jk-preview-table"><table className="jk-table" aria-label="Photos and their products">
        <thead><tr><th scope="col">Photo</th><th scope="col">Goes to</th><th scope="col">Status</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id}>
          <td data-mobile="primary"><span className="jk-photo-name"><img src={item.preview} alt="" className="jk-thumb" /><span className="min-w-0"><span className="jk-strong">{item.file.name}</span><span className="jk-cell-sub">{(item.file.size / 1024 / 1024).toFixed(1)} MB</span></span></span></td>
          <td data-label="Goes to">{!item.match ? <span className="jk-muted">Looking…</span> : item.match.product
            ? <><Link href={`/admin/products/${item.match.product.id}`} className="jk-link">{item.match.product.title}</Link><span className="jk-cell-sub">Matched by {item.match.matchedBy === "sku" ? "SKU" : "web address ending"} · has {plural(item.match.product.photoCount, "photo")}</span></>
            : <span className="jk-muted">No product with this name</span>}</td>
          <td data-label="Status">{item.match && !item.match.product ? <StatusBadge tone="warning">Not matched</StatusBadge> : <StatusBadge tone={STATE[item.state].tone}>{STATE[item.state].label}</StatusBadge>}{item.message && <span className="jk-cell-sub">{item.message}</span>}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="jk-pad jk-row is-between">
        <Link href="/admin/products" className={buttonClass("secondary")}>Back to products</Link>
        {finished && ready.length === 0 ? <Button variant="primary" onClick={clear}>Add more photos</Button>
          : <Button variant="primary" loading={busy} loadingLabel="Uploading…" disabled={matching || ready.length === 0} onClick={() => void upload()}>{ready.length ? `Upload ${plural(ready.length, "photo")}` : "Nothing to upload"}</Button>}
      </div>
    </Card>}
  </AdminPage>;
}
