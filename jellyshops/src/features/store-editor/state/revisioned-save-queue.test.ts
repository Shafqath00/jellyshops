import { afterEach, expect, it, vi } from "vitest";
import { createRevisionedSaveQueue } from "./revisioned-save-queue";

afterEach(() => vi.useRealTimers());

it("coalesces typing and saves later edits with the confirmed revision without overwriting the newer draft", async () => {
  vi.useFakeTimers();
  let finish: (value: { revision: number; text: string }) => void = () => {};
  const writes: Array<{ revision: number; text: string }> = [];
  const saved: Array<{ text: string; pending: boolean }> = [];
  const persist = async (value: { revision: number; text: string }) => {
    writes.push(value);
    if (writes.length === 1) return new Promise<{ revision: number; text: string }>((resolve) => { finish = resolve; });
    return { ...value, revision: value.revision + 1 };
  };
  const queue = createRevisionedSaveQueue({ onStatus: vi.fn(), onError: vi.fn(), delayMs: 100 });
  const options = { persist, onSaved: (value: { revision: number; text: string }, pending: boolean) => saved.push({ text: value.text, pending }) };
  void queue.save("home", { revision: 3, text: "H" }, options);
  void queue.save("home", { revision: 3, text: "Hello" }, options);
  await vi.advanceTimersByTimeAsync(100);
  expect(writes).toEqual([{ revision: 3, text: "Hello" }]);
  void queue.save("home", { revision: 3, text: "Hello world" }, options);
  finish({ revision: 4, text: "Hello" });
  await queue.flush();
  expect(writes[1]).toEqual({ revision: 4, text: "Hello world" });
  expect(saved).toEqual([{ text: "Hello", pending: true }, { text: "Hello world", pending: false }]);
  queue.dispose();
});

it("keeps a failed draft for an explicit retry and blocks further writes until retried", async () => {
  const onStatus = vi.fn();
  let unavailable = true;
  const persist = async (value: { revision: number; text: string }) => {
    if (unavailable) throw new Error("Network unavailable");
    return { ...value, revision: value.revision + 1 };
  };
  const saved: string[] = [];
  const queue = createRevisionedSaveQueue({ onStatus, onError: vi.fn() });
  void queue.save("home", { revision: 2, text: "Keep my edits" }, { persist, onSaved: (value) => saved.push(value.text) });
  expect(await queue.flush()).toBe(false);
  expect(onStatus).toHaveBeenLastCalledWith("error");
  unavailable = false;
  expect(await queue.retry()).toBe(true);
  expect(saved).toEqual(["Keep my edits"]);
  expect(onStatus).toHaveBeenLastCalledWith("saved");
  queue.dispose();
});
