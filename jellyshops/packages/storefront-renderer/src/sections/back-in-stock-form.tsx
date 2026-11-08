import { useId, useState, type FormEvent } from "react";

/** "Email me when it's back" for a sold-out product: one email when it can be bought again. */
export function BackInStockForm({ onSubmit }: { onSubmit(email: string, website?: string): Promise<{ ok: boolean; message?: string }> }) {
  const id = useId();
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter your email address."); return; }
    setState("sending");
    setError("");
    const result = await onSubmit(email, String(form.get("website") ?? "") || undefined).catch(() => ({ ok: false, message: undefined }));
    if (result.ok) setState("done");
    else { setState("idle"); setError(result.message ?? "That didn't work. Please try again."); }
  };
  if (state === "done") return <p className="jelly-back-in-stock-done" role="status">Thanks. We&apos;ll email you once when it&apos;s back.</p>;
  return <form className="jelly-back-in-stock" onSubmit={submit} noValidate aria-labelledby={`${id}-title`}>
    <p id={`${id}-title`} className="jelly-back-in-stock-title">Sold out. Want to know when it&apos;s back?</p>
    <div className="jelly-back-in-stock-row">
      <label className="jelly-visually-hidden" htmlFor={`${id}-email`}>Your email</label>
      <input id={`${id}-email`} name="email" type="email" autoComplete="email" placeholder="Your email" aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
      <button type="submit" className="jelly-button jelly-button--secondary" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Email me"}</button>
    </div>
    {/* Left empty by people; bots that fill every field are ignored by the shop. */}
    <label className="jelly-review-website" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    {error && <p className="jelly-back-in-stock-error" id={`${id}-error`} role="alert">{error}</p>}
    <p className="jelly-back-in-stock-note">We only use your email for this.</p>
  </form>;
}
