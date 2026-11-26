import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutosave } from "./use-autosave";

const KEY = "jelly-content-draft:test";

describe("autosave", () => {
  beforeEach(() => { vi.useFakeTimers(); window.localStorage.clear(); });
  afterEach(() => { vi.useRealTimers(); });

  it("keeps every change on this device at once and saves after a pause", async () => {
    const save = vi.fn(async () => undefined);
    const { result } = renderHook(() => useAutosave({ key: KEY, saved: "a", save, delay: 1000, now: () => 5 }));
    act(() => result.current.change("ab"));
    expect(result.current.status).toBe("unsaved");
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({ value: "ab", savedAt: 5 });
    act(() => result.current.change("abc"));
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("abc");
    expect(result.current.status).toBe("saved");
    expect(result.current.lastSavedAt).toBe(5);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("keeps the change and says so when saving fails, then saves it on the next try", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("Network down")).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave({ key: KEY, saved: "a", save, delay: 500 }));
    act(() => result.current.change("b"));
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Network down");
    expect(window.localStorage.getItem(KEY)).not.toBeNull();
    let ok = false;
    await act(async () => { ok = await result.current.flush(); });
    expect(ok).toBe(true);
    expect(save).toHaveBeenLastCalledWith("b");
    expect(result.current.status).toBe("saved");
  });

  it("does not send a value the server already has", async () => {
    const save = vi.fn(async () => undefined);
    const { result } = renderHook(() => useAutosave({ key: KEY, saved: { title: "A" }, save, delay: 100 }));
    act(() => result.current.change({ title: "A" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(save).not.toHaveBeenCalled();
    expect(result.current.status).toBe("saved");
  });

  it("never overlaps saves: a change made while saving goes straight after", async () => {
    let release: () => void = () => undefined;
    const save = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { release = resolve; })).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutosave({ key: KEY, saved: "a", save, delay: 100 }));
    act(() => result.current.change("b"));
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(result.current.status).toBe("saving");
    act(() => result.current.change("c"));
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => { release(); await vi.advanceTimersByTimeAsync(0); });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith("c");
  });

  it("offers a browser copy from an earlier visit that the server doesn't have, and forgets a stale one", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ value: "unsaved words", savedAt: 42 }));
    const { result } = renderHook(() => useAutosave({ key: KEY, saved: "server words", save: vi.fn() }));
    expect(result.current.recovered).toEqual({ value: "unsaved words", savedAt: 42 });
    act(() => result.current.dismissRecovered());
    expect(result.current.recovered).toBeNull();

    window.localStorage.setItem(KEY, JSON.stringify({ value: "same", savedAt: 1 }));
    const second = renderHook(() => useAutosave({ key: KEY, saved: "same", save: vi.fn() }));
    expect(second.result.current.recovered).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
});
