import { describe, expect, it } from "vitest";
import {
  cardinalFromDeg,
  windCompactSummary,
  windFromFromDownwindArrow,
  windMultiPointSubtitle,
  windToFromWindFrom,
} from "@/lib/map/windFormat";

describe("cardinalFromDeg", () => {
  it("returns em-dash for null/NaN", () => {
    expect(cardinalFromDeg(null)).toBe("—");
    expect(cardinalFromDeg(Number.NaN)).toBe("—");
  });

  it("rounds to the nearest 16-point cardinal", () => {
    expect(cardinalFromDeg(0)).toBe("N");
    expect(cardinalFromDeg(90)).toBe("E");
    expect(cardinalFromDeg(180)).toBe("S");
    expect(cardinalFromDeg(270)).toBe("W");
    expect(cardinalFromDeg(45)).toBe("NE");
    expect(cardinalFromDeg(360)).toBe("N");
  });

  it("handles negative inputs by wrapping into [0, 360)", () => {
    expect(cardinalFromDeg(-90)).toBe("W");
  });
});

describe("windCompactSummary", () => {
  it("formats wind without a gust value", () => {
    expect(
      windCompactSummary({ speedMs: 6, gustMs: null, dirFromDeg: 90 }),
    ).toBe("6 m/s E (90°)");
  });

  it("formats wind with a gust value", () => {
    expect(
      windCompactSummary({ speedMs: 6, gustMs: 8, dirFromDeg: 45 }),
    ).toBe("6 (8) m/s NE (45°)");
  });

  it("handles missing speed and direction", () => {
    expect(
      windCompactSummary({ speedMs: null, gustMs: null, dirFromDeg: null }),
    ).toBe("— m/s —");
  });

  it("rounds m/s values to whole numbers", () => {
    expect(
      windCompactSummary({ speedMs: 6.4, gustMs: 7.6, dirFromDeg: 80 }),
    ).toBe("6 (8) m/s E (80°)");
  });
});

describe("windFromFromDownwindArrow", () => {
  it("inverts the downwind bearing into a wind-from bearing", () => {
    expect(windFromFromDownwindArrow(0, 0, 1, 0)).toBeCloseTo(270, 3);
    expect(windFromFromDownwindArrow(0, 0, 0, 1)).toBeCloseTo(180, 3);
  });
});

describe("windToFromWindFrom", () => {
  it("returns the opposite bearing", () => {
    expect(windToFromWindFrom(0)).toBe(180);
    expect(windToFromWindFrom(270)).toBe(90);
  });
});

describe("windMultiPointSubtitle", () => {
  it("returns null for single sample or missing multiPoint", () => {
    expect(windMultiPointSubtitle(null)).toBe(null);
    expect(
      windMultiPointSubtitle({
        speedMs: 5,
        gustMs: 7,
        dirFromDeg: 90,
        visibilityM: null,
        observedAt: "",
        multiPoint: { samples: 1, speedMinMs: 5, speedMaxMs: 5, speedMedianMs: 5, gustMaxMs: 7, dirSpreadDeg: 5 },
      }),
    ).toBe(null);
  });

  it("joins multi-spot summary when samples >= 2", () => {
    const s = windMultiPointSubtitle({
      speedMs: 5,
      gustMs: 7,
      dirFromDeg: 90,
      visibilityM: null,
      observedAt: "",
      multiPoint: {
        samples: 3,
        speedMinMs: 4,
        speedMaxMs: 8,
        speedMedianMs: 5,
        gustMaxMs: 9,
        dirSpreadDeg: 20,
      },
    });
    expect(s).toContain("4–8 m/s in area");
    expect(s).toContain("3 spots");
    expect(s).toContain("dir ±20°");
  });
});
