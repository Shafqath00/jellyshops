export type AutosaveStatus = "dirty" | "saving" | "saved" | "error";
export interface AutosaveController { changed(): void; flush(): Promise<void>; retry(): Promise<void>; dispose(): void }

interface Options {
  save(): Promise<void>;
  onStatus(status: AutosaveStatus): void;
  onError?(error: unknown): boolean;
  delayMs?: number;
}

export function createAutosaveController({ save, onStatus, onError, delayMs = 700 }: Options): AutosaveController {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void> | null = null;
  let dirty = false;
  let failed = false;
  let disposed = false;

  const schedule = () => {
    if (disposed || timer || active) return;
    timer = setTimeout(() => { timer = undefined; void run(); }, delayMs);
  };

  const run = async (): Promise<void> => {
    if (active) return active;
    if (!dirty || disposed) return;
    dirty = false;
    failed = false;
    onStatus("saving");
    active = save().then(() => {
      onStatus(dirty ? "dirty" : "saved");
    }).catch((error) => {
      dirty = true;
      failed = true;
      if (!onError?.(error)) onStatus("error");
    }).finally(() => {
      active = null;
      if (dirty && !failed) schedule();
    });
    return active;
  };

  return {
    changed() {
      dirty = true;
      failed = false;
      onStatus("dirty");
      schedule();
    },
    async flush() {
      if (timer) { clearTimeout(timer); timer = undefined; }
      if (active) await active;
      if (dirty) await run();
    },
    async retry() {
      failed = false;
      await run();
    },
    dispose() {
      disposed = true;
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}
