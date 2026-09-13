export type AutosaveStatus = "dirty" | "saving" | "saved" | "error";
export interface AutosaveController { changed(resourceKey?: string): void; flush(): Promise<void>; retry(): Promise<void>; dispose(): void }

interface Options {
  save(resourceKey?: string): Promise<void>;
  onStatus(status: AutosaveStatus): void;
  onError?(error: unknown): boolean;
  delayMs?: number;
}

const legacyDocumentKey = Symbol("legacy-document");
type DirtyKey = string | typeof legacyDocumentKey;

export function createAutosaveController({ save, onStatus, onError, delayMs = 700 }: Options): AutosaveController {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void> | null = null;
  const dirty = new Set<DirtyKey>();
  let failed = false;
  let disposed = false;

  const schedule = () => {
    if (disposed || timer || active || dirty.size === 0 || failed) return;
    timer = setTimeout(() => { timer = undefined; void run(); }, delayMs);
  };

  const run = async (): Promise<void> => {
    if (active) return active;
    if (dirty.size === 0 || disposed) return;

    const key = dirty.values().next().value as DirtyKey | undefined;
    if (key === undefined) return;
    dirty.delete(key);
    failed = false;
    onStatus("saving");

    active = save(key === legacyDocumentKey ? undefined : key).then(() => {
      onStatus(dirty.size > 0 ? "dirty" : "saved");
    }).catch((error) => {
      dirty.add(key);
      failed = true;
      if (!onError?.(error)) onStatus("error");
    }).finally(() => {
      active = null;
      if (dirty.size > 0 && !failed) schedule();
    });
    return active;
  };

  return {
    changed(resourceKey) {
      dirty.add(resourceKey ?? legacyDocumentKey);
      failed = false;
      onStatus("dirty");
      schedule();
    },
    async flush() {
      if (timer) { clearTimeout(timer); timer = undefined; }
      if (active) await active;
      while (dirty.size > 0 && !failed && !disposed) await run();
    },
    async retry() {
      failed = false;
      await run();
    },
    dispose() {
      disposed = true;
      dirty.clear();
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}
