"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";

export function useAdminQuery<T>(key: string | null, loader: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; attempt: number; data?: T; error?: Error }>();
  const load = useEffectEvent((signal: AbortSignal) => loader(signal));
  useEffect(() => {
    const controller = new AbortController();
    if (!key) return () => controller.abort();
    void load(controller.signal).then((data) => { if (!controller.signal.aborted) setResult({ key, attempt, data }); }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setResult({ key, attempt, error: cause instanceof Error ? cause : new Error("Unable to load admin data") });
    });
    return () => controller.abort();
  }, [key, attempt]);
  const current = result?.key === key && result.attempt === attempt ? result : undefined;
  return { data: current?.data, error: current?.error, loading: Boolean(key) && !current, retry: useCallback(() => setAttempt((value) => value + 1), []) };
}
