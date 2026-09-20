"use client";

import { useCallback, useEffect, useState } from "react";

export function useAdminQuery<T>(key: string | null, loader: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(Boolean(key));
  useEffect(() => {
    const controller = new AbortController();
    if (!key) { setData(undefined); setError(undefined); setLoading(false); return () => controller.abort(); }
    setLoading(true); setError(undefined); setData(undefined);
    void loader(controller.signal).then((value) => { if (!controller.signal.aborted) setData(value); }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause : new Error("Unable to load admin data"));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [key, loader, attempt]);
  return { data, error, loading, retry: useCallback(() => setAttempt((value) => value + 1), []) };
}
