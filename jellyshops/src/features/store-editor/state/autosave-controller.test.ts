import { afterEach, describe, expect, it, vi } from "vitest";
import { createAutosaveController } from "./autosave-controller";

afterEach(() => vi.useRealTimers());

describe("autosave controller", () => {
  it("debounces edits for 700ms and flushes immediately", async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockResolvedValue(undefined);
    const controller = createAutosaveController({ save, onStatus: vi.fn(), delayMs: 700 });

    controller.changed();
    await vi.advanceTimersByTimeAsync(699);
    expect(save).not.toHaveBeenCalled();
    await controller.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("queues a changed document behind an active save", async () => {
    vi.useFakeTimers();
    let finishFirst!: () => void;
    const save = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; }))
      .mockResolvedValue(undefined);
    const controller = createAutosaveController({ save, onStatus: vi.fn(), delayMs: 700 });

    controller.changed();
    await vi.advanceTimersByTimeAsync(700);
    controller.changed();
    finishFirst();
    await vi.runAllTimersAsync();

    expect(save).toHaveBeenCalledTimes(2);
  });

  it("saves different workspace resources independently", async () => {
    vi.useFakeTimers();
    const saved: Array<string | undefined> = [];
    const controller = createAutosaveController({
      save: async (resourceKey) => { saved.push(resourceKey); },
      onStatus: vi.fn(),
      delayMs: 700,
    });

    controller.changed("template:product-featured");
    controller.changed("menu:main");
    await controller.flush();

    expect(saved).toEqual(["template:product-featured", "menu:main"]);
  });

  it("keeps an error retryable", async () => {
    vi.useFakeTimers();
    const statuses: string[] = [];
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const controller = createAutosaveController({ save, onStatus: (status) => statuses.push(status), delayMs: 700 });

    controller.changed();
    await vi.advanceTimersByTimeAsync(700);
    expect(statuses.at(-1)).toBe("error");
    await controller.retry();
    expect(statuses.at(-1)).toBe("saved");
  });
});
