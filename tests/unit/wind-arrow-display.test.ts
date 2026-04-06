import { describe, expect, it } from "vitest";
import {
  cssRotateEastBaseToWindTo,
  windToDegFromDirFrom,
} from "@/lib/map/windArrowDisplay";

describe("windToDegFromDirFrom", () => {
  it("flips wind-from to downwind (opposite bearing)", () => {
    expect(windToDegFromDirFrom(0)).toBe(180);
    expect(windToDegFromDirFrom(90)).toBe(270);
    expect(windToDegFromDirFrom(40)).toBe(220);
    expect(windToDegFromDirFrom(220)).toBe(40);
  });

  it("normalizes negatives", () => {
    expect(windToDegFromDirFrom(-10)).toBe(170);
  });
});

describe("cssRotateEastBaseToWindTo", () => {
  it("points east base toward wind-to", () => {
    expect(cssRotateEastBaseToWindTo(90)).toBe(0);
    expect(cssRotateEastBaseToWindTo(0)).toBe(-90);
    expect(cssRotateEastBaseToWindTo(220)).toBe(130);
  });
});

describe("field vs label consistency (NE 40° wind from)", () => {
  it("downwind is SW-ish (~220°) and rotation matches optimal-arrow basis", () => {
    const from = 40;
    const to = windToDegFromDirFrom(from);
    expect(to).toBe(220);
    expect(cssRotateEastBaseToWindTo(to)).toBe(130);
  });
});
