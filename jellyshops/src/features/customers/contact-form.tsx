"use client";
import { useState, type FormEvent } from "react";
import { customerApiOrigin } from "./customer-provider";

export function ContactForm({ storeId }: { storeId: string }) {
  const [status, setStatus] = useState<"idle" | "pending" | "sent">("idle");
  const [error, setError] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "pending") return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setStatus("pending"); setError(undefined);
    try {
      const response = await fetch(`${customerApiOrigin()}/api/public/stores/${encodeURIComponent(storeId)}/engagement/contact`, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const result = await response.json().catch(() => ({})) as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "We couldn’t send your message. Please try again.");
      form.reset(); setStatus("sent");
    } catch (caught) { setStatus("idle"); setError(caught instanceof Error ? caught.message : "We couldn’t send your message. Please try again."); }
  }
  return <section className="signature-panel"><h2>Send us a message</h2><form onSubmit={(event) => void submit(event)}><label>Your name<input name="name" required maxLength={120} autoComplete="name" /></label><label>Email<input name="email" required type="email" maxLength={254} autoComplete="email" /></label><label>Message<textarea name="message" required maxLength={5000} /></label><button className="signature-primary" disabled={status === "pending"}>{status === "pending" ? "Sending…" : "Send message"}</button>{status === "sent" && <p role="status">Your message has been received.</p>}{error && <p role="alert">{error}</p>}</form></section>;
}
