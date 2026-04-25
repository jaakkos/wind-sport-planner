import { describe, expect, it } from "vitest";
import {
  selectSpatiallyDispersedLngLat,
  stratifyLngLatByElevationRank,
} from "@/lib/map/polygons";
import {
  createElevationCache,
  latLngElevationKey,
  resolveWindForecastSamplePoints,
} from "@/lib/heuristics/windSamplePoints";

describe("stratifyLngLatByElevationRank", () => {
  it("spreads picks from high to low elevation", () => {
    const pts = [
      { lng: 0, lat: 0, elevM: 100 },
      { lng: 1, lat: 0, elevM: 500 },
      { lng: 2, lat: 0, elevM: 300 },
      { lng: 3, lat: 0, elevM: 400 },
      { lng: 4, lat: 0, elevM: 200 },
    ];
    const out = stratifyLngLatByElevationRank(pts, 3);
    expect(out).toEqual([
      [1, 0],
      [2, 0],
      [0, 0],
    ]);
  });

  it("treats null elevation as low", () => {
    const pts = [
      { lng: 0, lat: 0, elevM: null },
      { lng: 1, lat: 0, elevM: 200 },
    ];
    const out = stratifyLngLatByElevationRank(pts, 2);
    expect(out).toEqual([
      [1, 0],
      [0, 0],
    ]);
  });
});

describe("selectSpatiallyDispersedLngLat", () => {
  it("starts near seed and spreads outward", () => {
    const candidates: [number, number][] = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];
    const out = selectSpatiallyDispersedLngLat(candidates, 3, 0.05, 0.05);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual([0, 0]);
    const set = new Set(out.map(([a, b]) => `${a},${b}`));
    expect(set.size).toBe(3);
  });
});

describe("latLngElevationKey", () => {
  it("uses four decimal places", () => {
    expect(latLngElevationKey(1.23456, 2)).toBe("1.2346,2.0000");
  });
});

describe("createElevationCache", () => {
  it("dedupes lookups for the same key", async () => {
    let calls = 0;
    const cached = createElevationCache(async () => {
      calls += 1;
      return 100;
    });
    expect(await cached(60.1, 24.6)).toBe(100);
    expect(await cached(60.1, 24.6)).toBe(100);
    expect(calls).toBe(1);
  });
});

describe("resolveWindForecastSamplePoints", () => {
  it("returns centroid when k <= 1", async () => {
    const poly = {
      type: "Polygon" as const,
      coordinates: [
        [
          [0, 0],
          [0.02, 0],
          [0.02, 0.02],
          [0, 0.02],
          [0, 0],
        ],
      ],
    };
    const r = await resolveWindForecastSamplePoints({
      poly,
      centroidLng: 0.01,
      centroidLat: 0.01,
      k: 1,
      maxSamplesSetting: 5,
      elevationFor: async () => 0,
    });
    expect(r).toEqual([[0.01, 0.01]]);
  });
});
