"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Autosave with draft recovery, for the page and post editors.
 *
 * - Every change is written to this browser at once (localStorage, `key`), so a closed tab, a crash or a failed save
 *   never loses work.
 * - After `delay` ms without typing the value is sent with `save`. Saves never overlap; a change made while one is
 *   running is sent straight after it. After a failure nothing is retried until the next change or `flush`.
 * - The browser copy is removed once the server has the same value.
 * - `recovered` is a browser copy left from an earlier visit that differs from what the server sent; the page offers
 *   it with Restore / Discard. It is read when the hook first runs: give the editor a React `key` per item.
 */
export type AutosaveStatus = "saved" | "unsaved" | "saving" | "error";

export interface AutosaveOptions<T> {
  /** localStorage key; null turns the browser copy off (e.g. before the item exists). */
  key: string | null;
  /** What the server has now (the starting point, and the comparison for recovery). */
  saved: T;
  save: (value: T) => Promise<void>;
  delay?: number;
  /** False keeps changes in the browser only (e.g. while a dialog decides where the item goes). */
  enabled?: boolean;
  now?: () => number;
}

export interface AutosaveState<T> {
  status: AutosaveStatus;
  error: string | null;
  lastSavedAt: number | null;
  recovered: { value: T; savedAt: number } | null;
  /** Records a change (call on every edit). */
  change: (value: T) => void;
  /** Saves now (Ctrl/Cmd+S, Publish, leaving the page); resolves once the server has it or the save failed. */
  flush: () => Promise<boolean>;
  /** Forgets the recovered copy (after Restore has applied it, or Discard). */
  dismissRecovered: () => void;
  /** Changes the starting point without saving (after a publish returns new data). */
  reset: (value: T) => void;
}

interface StoredDraft<T> { value: T; savedAt: number }

export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function readDraft<T>(key: string | null): StoredDraft<T> | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    return parsed && typeof parsed.savedAt === "number" && "value" in parsed ? parsed : null;
  } catch {
    return null;
  }
}

function writeDraft<T>(key: string | null, draft: StoredDraft<T> | null): void {
  if (!key || typeof window === "undefined") return;
  try {
    if (draft) window.localStorage.setItem(key, JSON.stringify(draft));
    else window.localStorage.removeItem(key);
  } catch {
    // Private windows and full storage: the server save still runs.
  }
}

export function useAutosave<T>({ key, saved, save, delay = 1500, enabled = true, now = Date.now }: AutosaveOptions<T>): AutosaveState<T> {
  const [status, setStatus] = useState<AutosaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [recovered, setRecovered] = useState<StoredDraft<T> | null>(() => {
    const draft = readDraft<T>(key);
    return draft && !sameValue(draft.value, saved) ? draft : null;
  });
  const serverValue = useRef(saved);
  const pending = useRef<{ value: T } | null>(null);
  const running = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  const nowRef = useRef(now);
  useEffect(() => { saveRef.current = save; nowRef.current = now; });

  // A browser copy that matches the server is stale: forget it.
  useEffect(() => {
    const draft = readDraft<T>(key);
    if (draft && sameValue(draft.value, serverValue.current)) writeDraft(key, null);
  }, [key]);

  /** Sends whatever is waiting, one save at a time, until nothing is left or a save fails. */
  const drain = useCallback(async (): Promise<boolean> => {
    while (pending.current) {
      const { value } = pending.current;
      pending.current = null;
      if (sameValue(value, serverValue.current)) continue;
      setStatus("saving");
      try {
        await saveRef.current(value);
        serverValue.current = value;
        setError(null);
        setLastSavedAt(nowRef.current());
      } catch (reason) {
        if (!pending.current) pending.current = { value };
        setStatus("error");
        setError(reason instanceof Error ? reason.message : "Your changes could not be saved. They are kept on this device.");
        return false;
      }
    }
    setStatus("saved");
    writeDraft(key, null);
    return true;
  }, [key]);

  const run = useCallback(async (): Promise<boolean> => {
    while (running.current) await running.current;
    const attempt = drain();
    running.current = attempt;
    try {
      return await attempt;
    } finally {
      running.current = null;
    }
  }, [drain]);

  const change = useCallback((value: T) => {
    pending.current = { value };
    writeDraft(key, { value, savedAt: nowRef.current() });
    setStatus("unsaved");
    if (timer.current) clearTimeout(timer.current);
    if (!enabled) return;
    timer.current = setTimeout(() => { void run(); }, delay);
  }, [delay, enabled, key, run]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    return run();
  }, [run]);

  const reset = useCallback((value: T) => {
    serverValue.current = value;
    pending.current = null;
    if (timer.current) clearTimeout(timer.current);
    writeDraft(key, null);
    setStatus("saved");
  }, [key]);

  const dismissRecovered = useCallback(() => setRecovered(null), []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Warn before leaving with changes the server does not have (the browser copy is still kept).
  useEffect(() => {
    if (status === "saved") return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  return { status, error, lastSavedAt, recovered, change, flush, dismissRecovered, reset };
}
