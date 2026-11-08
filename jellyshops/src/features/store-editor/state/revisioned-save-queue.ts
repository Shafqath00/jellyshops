export type SaveState = "saved" | "saving" | "error";

interface SaveOptions<T> {
  persist(value: T): Promise<T>;
  onSaved(value: T, newerDraftPending: boolean): void;
}

interface PendingSave {
  revision: number;
  run(revision: number): Promise<number>;
  settle(ok: boolean): void;
}

/** Coalesces typing, serializes workspace writes, and retains failed drafts. */
export function createRevisionedSaveQueue({ onStatus, onError, delayMs = 350 }: {
  onStatus(status: SaveState): void;
  onError(error: unknown): void;
  delayMs?: number;
}) {
  const pending = new Map<string, PendingSave>();
  const revisions = new Map<string, number>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void> | undefined;
  let failed = false;
  let disposed = false;

  const drain = async () => {
    if (active) return active;
    active = (async () => {
      while (pending.size && !failed && !disposed) {
        const [key, entry] = pending.entries().next().value!;
        pending.delete(key);
        try {
          const revision = await entry.run(Math.max(revisions.get(key) ?? 0, entry.revision));
          revisions.set(key, revision);
          entry.settle(true);
        } catch (error) {
          // Keep the most recent local version, even if typing continued during the request.
          if (!pending.has(key)) pending.set(key, entry);
          entry.settle(false);
          failed = true;
          if (!disposed) { onError(error); onStatus("error"); }
        }
      }
      if (!disposed && !failed) onStatus("saved");
    })();
    try { await active; } finally { active = undefined; }
  };

  const flush = async () => {
    if (timer) { clearTimeout(timer); timer = undefined; }
    await drain();
    return !failed && !disposed && pending.size === 0;
  };

  return {
    save<T extends { revision: number }>(key: string, value: T, options: SaveOptions<T>): Promise<boolean> {
      if (disposed) return Promise.resolve(false);
      pending.get(key)?.settle(true);
      const promise = new Promise<boolean>((settle) => {
        pending.set(key, {
          revision: value.revision,
          async run(revision) {
            const saved = await options.persist({ ...value, revision });
            if (!disposed) options.onSaved(saved, pending.has(key));
            return saved.revision;
          },
          settle,
        });
      });
      if (!failed) {
        onStatus("saving");
        if (!active && !timer) timer = setTimeout(() => { timer = undefined; void drain(); }, delayMs);
      }
      return promise;
    },
    flush,
    async retry() { failed = false; onStatus("saving"); return flush(); },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      pending.forEach((entry) => entry.settle(false));
      pending.clear();
    },
  };
}
