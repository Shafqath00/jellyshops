import { describe, expect, it } from "vitest";
import { sliderStops } from "./slider";

describe("sliderStops", () => {
  it("gives one stop per slide start, capped at the end of the track, without repeats", () => {
    // Four 300px slides with 20px gaps in a 640px track: the last two starts both end at the track's end.
    expect(sliderStops([0, 320, 640, 960], 640)).toEqual([0, 320, 640]);
    expect(sliderStops([0, 320, 640, 960], 0)).toEqual([0]);
    expect(sliderStops([], 0)).toEqual([0]);
  });
});
