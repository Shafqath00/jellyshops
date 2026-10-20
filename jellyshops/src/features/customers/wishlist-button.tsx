"use client";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { customerRequest, useCustomer } from "./customer-provider";
import { readGuestWishlist, writeGuestWishlist } from "./wishlist";

export function WishlistButton({ storeId, productId }: { storeId: string; productId: string }) {
  const { session } = useCustomer();
  const [saved, setSaved] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    if (session) void customerRequest<{ items: { productId: string }[] }>(storeId, "/wishlist", session).then((data) => { if (active) setSaved(data.items.some((item) => item.productId === productId)); }).catch(() => { if (active) setError("Unable to load your wishlist."); });
    else queueMicrotask(() => { if (active) setSaved(readGuestWishlist(storeId).includes(productId)); });
    return () => { active = false; };
  }, [storeId, productId, session]);
  async function toggle() {
    setBusy(true); setError(undefined);
    try {
      if (session) await customerRequest(storeId, saved ? `/wishlist/${encodeURIComponent(productId)}` : "/wishlist/merge", session, saved ? "DELETE" : "POST", saved ? undefined : { productIds: [productId] });
      else { const ids = readGuestWishlist(storeId); writeGuestWishlist(storeId, saved ? ids.filter((id) => id !== productId) : [...ids, productId]); }
      setSaved(!saved);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update your wishlist."); }
    finally { setBusy(false); }
  }
  return <div><button className="signature-secondary" type="button" disabled={busy} aria-pressed={saved} onClick={() => void toggle()}><Heart size={18} fill={saved ? "currentColor" : "none"} />{saved ? "Saved to wishlist" : "Save to wishlist"}</button>{error && <p role="alert">{error}</p>}</div>;
}
