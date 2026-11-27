"use client";

import { useEffect, useState } from "react";
import type { SeoHealthReport } from "../api";
import type { PreferencesForm } from "../use-preferences-form";

/**
 * Loads the SEO health report for the saved preferences. It runs again after each save and by hand; a failure only
 * affects this card (the rest of the page keeps working).
 */
export function useSeoHealth(form: PreferencesForm) {
  const revision = form.stored?.revision ?? -1;
  const available = form.stored?.available ?? false;
  const { seoHealth } = form.api;
  const [state, setState] = useState<{ key: string; report: SeoHealthReport | null; error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${revision}:${attempt}`;
  useEffect(() => {
    if (revision < 0 || !available) return;
    let live = true;
    seoHealth().then(
      (report) => { if (live) setState({ key, report, error: "" }); },
      (failure: unknown) => { if (live) setState({ key, report: null, error: failure instanceof Error ? failure.message : "Could not run the check." }); },
    );
    return () => { live = false; };
  }, [revision, available, seoHealth, key]);
  return { report: state?.report ?? null, error: state?.error ?? "", loading: available && state?.key !== key, rerun: () => setAttempt((value) => value + 1) };
}
