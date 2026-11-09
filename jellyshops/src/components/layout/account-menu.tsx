"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, LogOut, Settings } from "lucide-react";

export function storeInitial(name: string) {
  return name.trim().charAt(0) || "J";
}

/** Store button at the right of the top bar: store name, view store, settings and sign out. */
export function AccountMenu({ storeName, storeSlug, email, onSignOut }: { storeName: string; storeSlug: string; email?: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("pointerdown", close); };
  }, [open]);
  return <div className="admin-account" ref={ref}>
    <button type="button" className="admin-topbar-button" aria-expanded={open} aria-controls={id} aria-label={`Account and store: ${storeName}`} onClick={() => setOpen((value) => !value)}>
      <span className="admin-avatar" aria-hidden="true">{storeInitial(storeName)}</span><span className="admin-account-name">{storeName}</span>
    </button>
    {open && <div className="admin-account-menu" id={id}>
      <div className="admin-account-head"><span className="admin-avatar" aria-hidden="true">{storeInitial(storeName)}</span>
        <div className="min-w-0"><strong>{storeName}</strong>{email && <span>{email}</span>}</div></div>
      <Link href={`/${storeSlug}`} className="admin-account-item" onClick={() => setOpen(false)}><ExternalLink size={16} aria-hidden="true" />View your store</Link>
      <Link href="/admin/settings" className="admin-account-item" onClick={() => setOpen(false)}><Settings size={16} aria-hidden="true" />Settings</Link>
      <button type="button" className="admin-account-item" onClick={() => { setOpen(false); onSignOut(); }}><LogOut size={16} aria-hidden="true" />Sign out</button>
    </div>}
  </div>;
}
