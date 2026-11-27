"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { validateStorePreferences, type PreferenceProblem, type StorePreferences } from "@jelly/storefront-schema";
import { useToast } from "@/components/admin";
import { PreferencesRequestError, useStorePreferencesApi, type StoredPreferences } from "./api";

export type ProblemMap = Record<string, string>;

/** Sets a value deep inside the preferences by a dotted path ("seo.homeTitle"), copying only what changes. */
export function setAt(preferences: StorePreferences, path: string, value: unknown): StorePreferences {
  const keys = path.split(".");
  const copy = structuredClone(preferences) as unknown as Record<string, unknown>;
  let target = copy;
  for (const key of keys.slice(0, -1)) target = target[key] as Record<string, unknown>;
  target[keys.at(-1)!] = value;
  return copy as unknown as StorePreferences;
}

export function problemMap(problems: PreferenceProblem[]): ProblemMap {
  const map: ProblemMap = {};
  for (const problem of problems) if (!map[problem.path]) map[problem.path] = problem.message;
  return map;
}

/**
 * The preferences page's state: what was loaded, the edited copy, problems, and save/discard. Problems show for
 * fields the owner has touched as they type; everything else waits for Save.
 */
export function usePreferencesForm(options: {
  /** Called with the first field that needs fixing before Save shows it (Site preferences opens that field's tab). */
  onProblem?: (path: string) => void;
} = {}) {
  const { onProblem } = options;
  const api = useStorePreferencesApi();
  const toast = useToast();
  const [stored, setStored] = useState<StoredPreferences | null>(null);
  const [draft, setDraft] = useState<StorePreferences | null>(null);
  const [loadError, setLoadError] = useState("");
  const [serverProblems, setServerProblems] = useState<ProblemMap>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);

  const apply = useCallback((result: StoredPreferences) => {
    setLoadError(""); setStored(result); setDraft(result.preferences); setTouched(new Set()); setShowAll(false); setServerProblems({}); setConflict(false);
  }, []);
  const failLoad = useCallback((error: unknown) => setLoadError(error instanceof Error ? error.message : "Could not load your preferences."), []);
  const { get, ready } = api;
  /** Loads again (Try again, Reload after a conflict). */
  const load = useCallback(() => get().then(apply, failLoad), [get, apply, failLoad]);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    get().then((result) => { if (live) apply(result); }, (error: unknown) => { if (live) failLoad(error); });
    return () => { live = false; };
  }, [ready, get, apply, failLoad]);

  const dirty = useMemo(() => Boolean(stored && draft && JSON.stringify(stored.preferences) !== JSON.stringify(draft)), [stored, draft]);

  const clientProblems = useMemo<ProblemMap>(() => {
    if (!draft) return {};
    const result = validateStorePreferences(draft);
    return result.ok ? {} : problemMap(result.problems);
  }, [draft]);

  /** The message to show for a field, or undefined. */
  const problem = useCallback((path: string): string | undefined => {
    if (serverProblems[path]) return serverProblems[path];
    if (showAll || touched.has(path)) return clientProblems[path];
    return undefined;
  }, [clientProblems, serverProblems, showAll, touched]);

  const set = useCallback((path: string, value: unknown) => {
    setDraft((current) => current ? setAt(current, path, value) : current);
    setTouched((current) => current.has(path) ? current : new Set(current).add(path));
    setServerProblems((current) => {
      if (!current[path]) return current;
      const next = { ...current }; delete next[path]; return next;
    });
  }, []);

  /** Replaces the whole edited copy (used by Import: the owner still has to press Save). */
  const replaceDraft = useCallback((next: StorePreferences) => {
    setDraft(next); setServerProblems({}); setShowAll(false);
  }, []);

  const discard = useCallback(() => {
    if (!stored) return;
    setDraft(stored.preferences); setTouched(new Set()); setShowAll(false); setServerProblems({});
  }, [stored]);

  const save = useCallback(async () => {
    if (!stored || !draft || saving) return;
    const checked = validateStorePreferences(draft);
    if (!checked.ok) {
      setShowAll(true);
      toast(checked.problems.length === 1 ? "One setting needs fixing before you can save." : `${checked.problems.length} settings need fixing before you can save.`, { tone: "critical" });
      const first = checked.problems[0].path;
      onProblem?.(first);
      // The field may be on another tab that is opening now: try again once it is on the page.
      const focus = (tries: number) => {
        const element = document.getElementById(`pref-${first.replaceAll(".", "-")}`) ?? document.querySelector<HTMLElement>(`[data-pref-path="${first}"] input, [data-pref-path="${first}"] select, [data-pref-path="${first}"] textarea`);
        if (element) element.focus(); else if (tries > 0) window.setTimeout(() => focus(tries - 1), 100);
      };
      focus(10);
      return;
    }
    setSaving(true);
    try {
      const saved = await api.save(stored.revision, draft);
      setStored(saved); setDraft(saved.preferences); setTouched(new Set()); setShowAll(false); setServerProblems({});
      toast("Preferences saved");
    } catch (error) {
      if (error instanceof PreferencesRequestError && error.code === "PREFERENCES_REVISION_CONFLICT") setConflict(true);
      if (error instanceof PreferencesRequestError && error.problems.length) { setServerProblems(problemMap(error.problems)); setShowAll(true); onProblem?.(error.problems[0].path); }
      toast(error instanceof Error ? error.message : "Could not save. Try again.", { tone: "critical" });
    } finally {
      setSaving(false);
    }
  }, [api, draft, saving, stored, toast, onProblem]);

  const problemCount = Object.keys({ ...clientProblems, ...serverProblems }).length;

  return { ready: api.ready, stored, draft, loadError, reload: load, dirty, saving, conflict, problem, problemCount, set, replaceDraft, save, discard, api };
}

export type PreferencesForm = ReturnType<typeof usePreferencesForm>;
