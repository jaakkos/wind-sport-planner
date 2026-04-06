import { describe, expect, it } from "vitest";
import {
  angularDiffDeg,
  destinationLngLat,
  directionFactorFromOptimalDiff,
  directionRankFactor,
  sectorsFromCenter,
  windFromInSectors,
} from "@/lib/heuristics/windDirection";

describe("angularDiffDeg", () => {
  it("returns 0 for same bearing", () => {
    expect(angularDiffDeg(90, 90)).toBe(0);
  });
  it("returns 90 for orthogonal", () => {
    expect(angularDiffDeg(0, 90)).toBe(90);
  });
  it("wraps across 0", () => {
    expect(angularDiffDeg(350, 10)).toBe(20);
  });
});

describe("sectorsFromCenter", () => {
  it("returns one range when within 0..360", () => {
    expect(sectorsFromCenter(90, 30)).toEqual([[60, 120]]);
  });
  it("splits when crossing 0", () => {
    expect(sectorsFromCenter(10, 45)).toEqual([
      [325, 360],
      [0, 55],
    ]);
  });
});

describe("windFromInSectors", () => {
  it("detects inside", () => {
    expect(windFromInSectors(100, [[60, 120]])).toBe(true);
  });
  it("detects outside", () => {
    expect(windFromInSectors(200, [[60, 120]])).toBe(false);
  });
});

describe("directionFactorFromOptimalDiff", () => {
  it("gives full factor within ± half width", () => {
    expect(directionFactorFromOptimalDiff(0, 30)).toBe(1);
    expect(directionFactorFromOptimalDiff(30, 30)).toBe(1);
    expect(directionFactorFromOptimalDiff(25, 40)).toBe(1);
  });
  it("falls to floor at 180° difference", () => {
    expect(directionFactorFromOptimalDiff(180, 30)).toBe(0.12);
  });
  it("widens plateau when half width is larger", () => {
    const diff = 50;
    const narrow = directionFactorFromOptimalDiff(diff, 30);
    const wide = directionFactorFromOptimalDiff(diff, 60);
    expect(wide).toBe(1);
    expect(narrow).toBeLessThan(1);
  });
});

describe("directionRankFactor", () => {
  it("returns 1 when no sectors and no area optimal (no direction penalty)", () => {
    expect(
      directionRankFactor({
        forecastWindFromDeg: 180,
        areaWindSectorsJson: null,
      }),
    ).toBe(1);
  });
  it("uses sectors when present", () => {
    expect(
      directionRankFactor({
        forecastWindFromDeg: 90,
        areaWindSectorsJson: [[60, 120]],
      }),
    ).toBe(1);
    expect(
      directionRankFactor({
        forecastWindFromDeg: 200,
        areaWindSectorsJson: [[60, 120]],
      }),
    ).toBe(0.22);
  });
  it("soft-matches area optimal when no sectors", () => {
    const same = directionRankFactor({
      forecastWindFromDeg: 270,
      areaWindSectorsJson: null,
      areaOptimalWindFromDeg: 270,
    });
    const opposite = directionRankFactor({
      forecastWindFromDeg: 90,
      areaWindSectorsJson: null,
      areaOptimalWindFromDeg: 270,
    });
    expect(same).toBeGreaterThan(opposite);
    expect(opposite).toBe(0.12);
  });

  it("respects optimalMatchHalfWidthDeg for area optimal", () => {
    expect(
      directionRankFactor({
        forecastWindFromDeg: 40,
        areaWindSectorsJson: null,
        areaOptimalWindFromDeg: 0,
        optimalMatchHalfWidthDeg: 60,
      }),
    ).toBe(1);
    expect(
      directionRankFactor({
        forecastWindFromDeg: 90,
        areaWindSectorsJson: null,
        areaOptimalWindFromDeg: 0,
        optimalMatchHalfWidthDeg: 30,
      }),
    ).toBeLessThan(1);
  });

  it("boosts inside sectors when area optimal aligns with forecast", () => {
    const aligned = directionRankFactor({
      forecastWindFromDeg: 90,
      areaWindSectorsJson: [[60, 120]],
      areaOptimalWindFromDeg: 90,
    });
    const noAreaOptimal = directionRankFactor({
      forecastWindFromDeg: 90,
      areaWindSectorsJson: [[60, 120]],
    });
    expect(aligned).toBe(1.2);
    expect(noAreaOptimal).toBe(1);
    const misaligned = directionRankFactor({
      forecastWindFromDeg: 110,
      areaWindSectorsJson: [[60, 120]],
      areaOptimalWindFromDeg: 90,
    });
    expect(misaligned).toBeLessThan(aligned);
    expect(misaligned).toBeGreaterThanOrEqual(1);
  });

  it("ignores direction when no sectors and no area optimal even if forecast varies", () => {
    const a = directionRankFactor({
      forecastWindFromDeg: 45,
      areaWindSectorsJson: null,
    });
    const b = directionRankFactor({
      forecastWindFromDeg: 225,
      areaWindSectorsJson: null,
    });
    expect(a).toBe(1);
    expect(b).toBe(1);
  });
});

describe("destinationLngLat", () => {
  it("moves roughly north from Helsinki", () => {
    const [lng, lat] = destinationLngLat(25, 60, 0, 50);
    expect(lat).toBeGreaterThan(60.4);
    expect(Math.abs(lng - 25)).toBeLessThan(0.01);
  });
});
