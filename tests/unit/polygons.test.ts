import { describe, expect, it } from "vitest";
import {
  areaFeatureId,
  bearingDeg,
  closePolygonCoordinates,
  haversineKm,
  kmToScreenPx,
  outerRingOpenCoords,
  sampleWindFieldGridCandidates,
  selectSpatiallyDispersedLngLat,
  stratifyLngLatByElevationRank,
} from "@/lib/map/polygons";

describe("closePolygonCoordinates", () => {
  it("returns null for fewer than 3 points", () => {
    expect(closePolygonCoordinates([])).toBeNull();
    expect(closePolygonCoordinates([[0, 0]])).toBeNull();
    expect(
      closePolygonCoordinates([
        [0, 0],
        [1, 0],
      ]),
    ).toBeNull();
  });

  it("appends a closing vertex when ring is open", () => {
    const out = closePolygonCoordinates([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
    expect(out?.type).toBe("Polygon");
    const ring = out?.coordinates[0];
    expect(ring).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ]);
  });

  it("leaves an already-closed ring unchanged in length", () => {
    const out = closePolygonCoordinates([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ]);
    expect(out?.coordinates[0]).toHaveLength(4);
  });
});

describe("outerRingOpenCoords", () => {
  it("strips the duplicate closing vertex", () => {
    expect(
      outerRingOpenCoords({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      }),
    ).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
  });

  it("returns the ring as-is when not explicitly closed", () => {
    expect(
      outerRingOpenCoords({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
          ],
        ],
      }),
    ).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
  });

  it("returns [] for an empty polygon", () => {
    expect(outerRingOpenCoords({ type: "Polygon", coordinates: [[]] })).toEqual([]);
  });
});

describe("areaFeatureId", () => {
  it("prefers feature.id", () => {
    expect(
      areaFeatureId({
        type: "Feature",
        id: "abc",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: { id: "ignored" },
      }),
    ).toBe("abc");
  });

  it("falls back to properties.id", () => {
    expect(
      areaFeatureId({
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: { id: "from-props" },
      }),
    ).toBe("from-props");
  });

  it("returns empty string when neither is set", () => {
    expect(
      areaFeatureId({
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: {},
      }),
    ).toBe("");
  });
});

describe("haversineKm", () => {
  it("is zero for identical points", () => {
    expect(haversineKm(10, 60, 10, 60)).toBe(0);
  });

  it("approximates 1° latitude as ~111 km", () => {
    const km = haversineKm(0, 0, 0, 1);
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112);
  });

  it("is symmetric", () => {
    const a = haversineKm(10, 60, 11, 61);
    const b = haversineKm(11, 61, 10, 60);
    expect(a).toBeCloseTo(b, 9);
  });
});

describe("bearingDeg", () => {
  it("is ~0° going due north", () => {
    expect(bearingDeg(10, 60, 10, 61)).toBeCloseTo(0, 3);
  });

  it("is ~180° going due south", () => {
    expect(bearingDeg(10, 60, 10, 59)).toBeCloseTo(180, 3);
  });

  it("is ~90° going due east at the equator", () => {
    expect(bearingDeg(0, 0, 1, 0)).toBeCloseTo(90, 3);
  });

  it("returns a value in [0, 360)", () => {
    const b = bearingDeg(10, 60, 9, 60);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

describe("kmToScreenPx", () => {
  it("scales proportionally to distance", () => {
    const a = kmToScreenPx(1, 60, 10);
    const b = kmToScreenPx(2, 60, 10);
    expect(b).toBeCloseTo(a * 2, 5);
  });

  it("doubles when zoom increases by one", () => {
    const a = kmToScreenPx(1, 60, 10);
    const b = kmToScreenPx(1, 60, 11);
    expect(b).toBeCloseTo(a * 2, 3);
  });
});

describe("sampleWindFieldGridCandidates", () => {
  it("returns multiple candidates inside a unit square", () => {
    const square: GeoJSON.Polygon = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    };
    const out = sampleWindFieldGridCandidates(square, 0.5, 0.5, 50);
    expect(out.length).toBeGreaterThan(10);
    for (const [lng, lat] of out) {
      expect(lng).toBeGreaterThanOrEqual(0);
      expect(lng).toBeLessThanOrEqual(1);
      expect(lat).toBeGreaterThanOrEqual(0);
      expect(lat).toBeLessThanOrEqual(1);
    }
  });
});

describe("selectSpatiallyDispersedLngLat", () => {
  it("returns the input as-is when count >= candidates", () => {
    const cands: [number, number][] = [
      [0, 0],
      [1, 1],
    ];
    expect(selectSpatiallyDispersedLngLat(cands, 5, 0, 0)).toEqual(cands);
  });

  it("picks well-spread points when count < candidates", () => {
    const cands: [number, number][] = [
      [0, 0],
      [0.1, 0.1],
      [0.2, 0.2],
      [10, 10],
      [-10, -10],
    ];
    const picked = selectSpatiallyDispersedLngLat(cands, 3, 0, 0);
    expect(picked).toHaveLength(3);
    expect(picked).toContainEqual([0, 0]);
    expect(picked).toContainEqual([10, 10]);
    expect(picked).toContainEqual([-10, -10]);
  });
});

describe("stratifyLngLatByElevationRank", () => {
  it("returns [] for empty input", () => {
    expect(stratifyLngLatByElevationRank([], 5)).toEqual([]);
  });

  it("returns all points when k >= length, sorted high to low elevation", () => {
    const out = stratifyLngLatByElevationRank(
      [
        { lng: 1, lat: 1, elevM: 100 },
        { lng: 2, lat: 2, elevM: 500 },
        { lng: 3, lat: 3, elevM: 250 },
      ],
      5,
    );
    expect(out).toEqual([
      [2, 2],
      [3, 3],
      [1, 1],
    ]);
  });

  it("samples k roughly evenly along the rank when k < length", () => {
    const pts = [
      { lng: 0, lat: 0, elevM: 1000 },
      { lng: 1, lat: 1, elevM: 800 },
      { lng: 2, lat: 2, elevM: 600 },
      { lng: 3, lat: 3, elevM: 400 },
      { lng: 4, lat: 4, elevM: 200 },
    ];
    const out = stratifyLngLatByElevationRank(pts, 3);
    expect(out).toEqual([
      [0, 0],
      [2, 2],
      [4, 4],
    ]);
  });

  it("treats null elevations as lower than any finite elevation", () => {
    const out = stratifyLngLatByElevationRank(
      [
        { lng: 0, lat: 0, elevM: null },
        { lng: 1, lat: 1, elevM: 50 },
      ],
      2,
    );
    expect(out[0]).toEqual([1, 1]);
    expect(out[1]).toEqual([0, 0]);
  });
});
