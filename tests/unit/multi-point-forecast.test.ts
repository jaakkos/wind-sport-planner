import { describe, expect, it } from "vitest";
import {
  aggregateMultiPointWinds,
  effectiveSamplePointCount,
  maxDirectionalSpreadDeg,
  meanWindFromDeg,
  multiPointDirectionMultiplier,
  MULTI_POINT_DIAMETER_KM_TRIGGER,
  MULTI_POINT_ELEV_RANGE_M_TRIGGER,
} from "@/lib/heuristics/multiPointForecast";
import { resolveMultiPointForecastPrefs } from "@/lib/heuristics/ranking/multiPointPrefs";
import type { NormalizedWind } from "@/lib/weather/types";

function w(
  speed: number,
  gust: number,
  dir: number,
): NormalizedWind {
  return {
    windSpeedMs: speed,
    gustMs: gust,
    windDirDeg: dir,
    temperatureC: null,
    visibilityM: null,
    observedAt: new Date("2026-01-01T12:00:00Z"),
  };
}

describe("effectiveSamplePointCount", () => {
  it("returns 1 when mode is off", () => {
    expect(
      effectiveSamplePointCount({
        mode: "off",
        maxSamples: 5,
        bboxDiagonalKm: 99,
        elevRangeM: 999,
        availablePoints: 9,
      }),
    ).toBe(1);
  });

  it("returns capped count when mode is on", () => {
    expect(
      effectiveSamplePointCount({
        mode: "on",
        maxSamples: 5,
        bboxDiagonalKm: 0.1,
        elevRangeM: 0,
        availablePoints: 9,
      }),
    ).toBe(5);
  });

  it("auto uses 1 when area is small and flat", () => {
    expect(
      effectiveSamplePointCount({
        mode: "auto",
        maxSamples: 5,
        bboxDiagonalKm: MULTI_POINT_DIAMETER_KM_TRIGGER - 0.5,
        elevRangeM: MULTI_POINT_ELEV_RANGE_M_TRIGGER - 1,
        availablePoints: 9,
      }),
    ).toBe(1);
  });

  it("auto activates for wide bbox", () => {
    expect(
      effectiveSamplePointCount({
        mode: "auto",
        maxSamples: 5,
        bboxDiagonalKm: MULTI_POINT_DIAMETER_KM_TRIGGER + 1,
        elevRangeM: 0,
        availablePoints: 9,
      }),
    ).toBe(5);
  });
});

describe("meanWindFromDeg & spread", () => {
  it("averages northerly winds toward N", () => {
    const m = meanWindFromDeg([350, 10, 5]);
    expect(m).not.toBeNull();
    expect(Math.abs(m! - 0)).toBeLessThan(15);
  });

  it("computes spread from mean", () => {
    const mean = meanWindFromDeg([0, 90])!;
    const s = maxDirectionalSpreadDeg([0, 90], mean);
    expect(s).toBeGreaterThan(40);
  });
});

describe("aggregateMultiPointWinds", () => {
  it("conservative uses min speed for fit", () => {
    const agg = aggregateMultiPointWinds(
      [w(8, 10, 40), w(4, 12, 50), w(6, 9, 45)],
      "conservative",
    );
    expect(agg?.fitSpeedMs).toBe(4);
    expect(agg?.display.windSpeedMs).toBe(6);
    expect(agg?.gustPenaltyGustMs).toBe(12);
  });

  it("representative uses median speed for fit", () => {
    const agg = aggregateMultiPointWinds(
      [w(4, 8, 0), w(6, 9, 10), w(8, 10, 20)],
      "representative",
    );
    expect(agg?.fitSpeedMs).toBe(6);
  });

  it("uses null display direction when no sample has direction", () => {
    const base = {
      gustMs: 8 as number,
      temperatureC: null as number | null,
      visibilityM: null as number | null,
      observedAt: new Date("2026-01-01T12:00:00Z"),
    };
    const agg = aggregateMultiPointWinds(
      [
        { ...base, windSpeedMs: 5, windDirDeg: null },
        { ...base, windSpeedMs: 6, windDirDeg: null },
      ],
      "representative",
    );
    expect(agg?.display.windDirDeg).toBeNull();
  });
});

describe("multiPointDirectionMultiplier", () => {
  it("takes minimum when conservative", () => {
    expect(multiPointDirectionMultiplier("conservative", [0.5, 1, 0.8], 1)).toBe(0.5);
  });

  it("uses mean factor when representative", () => {
    expect(multiPointDirectionMultiplier("representative", [0.5, 1], 0.9)).toBe(0.9);
  });
});

describe("resolveMultiPointForecastPrefs", () => {
  it("guests get capped auto mode", () => {
    const g = resolveMultiPointForecastPrefs(null, false);
    expect(g.mode).toBe("auto");
    expect(g.maxSamples).toBe(4);
  });

  it("respects saved prefs for authed", () => {
    const r = resolveMultiPointForecastPrefs(
      { mode: "on", maxSamples: 7, scoringPolicy: "representative" },
      true,
    );
    expect(r.mode).toBe("on");
    expect(r.maxSamples).toBe(7);
    expect(r.scoringPolicy).toBe("representative");
  });
});
