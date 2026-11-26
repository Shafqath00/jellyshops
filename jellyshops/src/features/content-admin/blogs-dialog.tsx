"use client";

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Trash2 } from "lucide-react";
import { Button, Field, useToast } from "@/components/admin";
import type { BlogResource } from "@/features/content/api/client";
import { problem, useContentApi } from "./shared";

/** Add, rename and delete blogs. Most shops need one; a renamed address keeps its old links working. */
export function BlogsDialog({ open, onOpenChange, blogs, onChanged }: { open: boolean; onOpenChange: (open: boolean) => void; blogs: BlogResource[]; onChanged: () => void }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="jk-overlay" />
        <DialogPrimitive.Content className="jk-dialog jk-dialog-wide" aria-describedby={undefined}>
          <DialogPrimitive.Title className="jk-dialog-title">Blogs</DialogPrimitive.Title>
          <div className="jk-dialog-body">
            <p className="jk-muted">Each blog has its own page listing its posts, at /blogs/its-address. Most shops need just one.</p>
            <ul className="jk-rows" aria-label="Your blogs">
              {blogs.map((blog) => <BlogRow key={`${blog.id}:${blog.title}:${blog.handle}`} blog={blog} onChanged={onChanged} />)}
              {!blogs.length && <li className="jk-muted">No blogs yet. Add one below to start writing posts.</li>}
            </ul>
            <AddBlog onChanged={onChanged} />
          </div>
          <div className="jk-dialog-footer">
            <DialogPrimitive.Close asChild><button type="button" className="jk-button">Done</button></DialogPrimitive.Close>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function BlogRow({ blog, onChanged }: { blog: BlogResource; onChanged: () => void }) {
  const { api, storeId } = useContentApi();
  const toast = useToast();
  const [title, setTitle] = useState(blog.title);
  const [handle, setHandle] = useState(blog.handle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const changed = title.trim() !== blog.title || handle.trim() !== blog.handle;

  async function save() {
    if (!api) return;
    setBusy(true); setError("");
    try {
      await api.updateBlog(storeId, blog.id, { title: title.trim(), handle: handle.trim() });
      toast(handle.trim() !== blog.handle ? "Blog saved. Its old address now leads to the new one." : "Blog saved");
      onChanged();
    } catch (reason) {
      setError(problem(reason));
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!api) return;
    setBusy(true); setError("");
    try {
      await api.deleteBlog(storeId, blog.id);
      toast("Blog deleted");
      onChanged();
    } catch (reason) {
      setError(problem(reason)); setConfirming(false);
    } finally { setBusy(false); }
  }

  return (
    <li className="jk-rows-item jca-blog-row">
      <div className="jca-form-row">
        <Field id={`blog-title-${blog.id}`} label="Name"><input id={`blog-title-${blog.id}`} value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
        <Field id={`blog-handle-${blog.id}`} label="Web address">
          <span className="jk-prefixed"><span className="jk-prefixed-text">/blogs/</span><input id={`blog-handle-${blog.id}`} value={handle} onChange={(event) => setHandle(event.target.value.toLowerCase())} /></span>
        </Field>
      </div>
      {error && <p className="jk-field-error" role="alert">{error}</p>}
      <div className="jk-row">
        <Button size="small" variant="primary" disabled={!changed || !title.trim()} loading={busy && !confirming} onClick={() => void save()}>Save</Button>
        {confirming
          ? <><span className="jk-muted">Delete “{blog.title}”? Only an empty blog can be deleted.</span>
            <Button size="small" variant="destructive" loading={busy} onClick={() => void remove()}>Delete blog</Button>
            <Button size="small" variant="quiet" onClick={() => setConfirming(false)}>Keep it</Button></>
          : <Button size="small" variant="destructive-quiet" icon={<Trash2 size={14} aria-hidden />} onClick={() => setConfirming(true)}>Delete</Button>}
      </div>
    </li>
  );
}

function AddBlog({ onChanged }: { onChanged: () => void }) {
  const { api, storeId } = useContentApi();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function add() {
    if (!api || !title.trim()) return;
    setBusy(true); setError("");
    try {
      const blog = await api.createBlog(storeId, { title: title.trim() });
      toast(`Blog “${blog.title}” added at /blogs/${blog.handle}`);
      setTitle("");
      onChanged();
    } catch (reason) {
      setError(problem(reason));
    } finally { setBusy(false); }
  }
  return (
    <form className="jk-stack-sm" onSubmit={(event) => { event.preventDefault(); void add(); }}>
      <Field id="new-blog-title" label="Add a blog" help="For example News, Journal or Sleep guides. The web address is made from the name.">
        <input id="new-blog-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="News" />
      </Field>
      {error && <p className="jk-field-error" role="alert">{error}</p>}
      <div><Button type="submit" disabled={!title.trim()} loading={busy}>Add blog</Button></div>
    </form>
  );
}
