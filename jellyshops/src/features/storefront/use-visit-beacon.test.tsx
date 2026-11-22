import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { VisitBeacon } from "./use-visit-beacon";

const beacon = vi.fn(() => true);
beforeEach(() => { vi.useFakeTimers(); window.localStorage.clear(); Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true }); beacon.mockClear(); });
afterEach(() => vi.useRealTimers());

it("says the store had a visit once a day, a few seconds after the page loads", () => {
  render(<VisitBeacon storeId="store-1" />);
  expect(beacon).not.toHaveBeenCalled();
  act(() => { vi.advanceTimersByTime(3000); });
  expect(beacon).toHaveBeenCalledWith(expect.stringMatching(/\/api\/public\/stores\/store-1\/visit$/));
  render(<VisitBeacon storeId="store-1" />);
  act(() => { vi.advanceTimersByTime(3000); });
  expect(beacon).toHaveBeenCalledTimes(1);
});
