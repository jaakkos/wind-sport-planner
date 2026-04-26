import { describe, expect, it } from "vitest";
import type { Feature, FeatureCollection, Polygon } from "geojson";

import {
  buildAreaNameLabels,
  buildAreasColored,
  buildWindLabels,
  buildYrForecastPoints,
  selectedAreaOptimalWindMarker,
} from "@/lib/map/areaLayers";
import type { RankedPracticeArea } from "@/lib/heuristics/rankAreaTypes";

const square: Feature<Polygon> = {
  type: "Feature",
  id: "area-1",
  properties: { id: "area-1", name: "  Pasture  " },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [10, 60],
        [11, 60],
        [11, 61],
        [10, 61],
        [10, 60],
      ],
    ],
  },
};

const sharedSquare: Feature<Polygon> = {
  ...square,
  id: "area-2",
  properties: { id: "area-2", isCommunity: 1 },
};

const fc = (features: Feature[]): FeatureCollection => ({
  type: "FeatureCollection",
  features,
});

const ranked = (
  overrides: Partial<RankedPracticeArea> & { id: string },
): RankedPracticeArea =>
  ({
    areaId: overrides.id,
    score: overrides.score ?? 0.5,
    centroid: overrides.centroid ?? { lng: 10.5, lat: 60.5 },
    wind: overrides.wind ?? null,
    ...overrides,
  }) as RankedPracticeArea;

describe("buildAreasColored", () => {
  it("returns null when there are no practice areas", () => {
    expect(buildAreasColored(null, [], null)).toBeNull();
  });

  it("decorates features with rank score, color and selection flags", () => {
    const out = buildAreasColored(
      fc([square, sharedSquare]),
      [ranked({ id: "area-1", score: 0.9 })],
      "area-2",
    );
    expect(out).not.toBeNull();
    const [a, b] = out!.features as Feature<Polygon>[];
    expect(a.properties).toMatchObject({
      rankScore: 0.9,
      selectedPractice: 0,
      isCommunity: 0,
      hasMapSelection: 1,
    });
    expect(typeof a.properties!.rankColor).toBe("string");
    expect(b.properties).toMatchObject({
      rankScore: 0,
      selectedPractice: 1,
      isCommunity: 1,
      hasMapSelection: 1,
    });
  });
});

describe("buildAreaNameLabels", () => {
  it("returns null when no labels can be built", () => {
    expect(buildAreaNameLabels(null)).toBeNull();
    expect(buildAreaNameLabels(fc([]))).toBeNull();
  });

  it("trims names and marks community areas as shared", () => {
    const out = buildAreaNameLabels(fc([square, sharedSquare]));
    expect(out).not.toBeNull();
    const labels = out!.features.map((f) => (f.properties as { areaName: string }).areaName);
    expect(labels[0]).toBe("Pasture");
    expect(labels[1]).toMatch(/ · shared$/);
  });
});

describe("buildWindLabels", () => {
  it("renders one centroid feature per ranked area", () => {
    const out = buildWindLabels([
      ranked({ id: "a", centroid: { lng: 1, lat: 2 } }),
      ranked({ id: "b", centroid: { lng: 3, lat: 4 } }),
    ]);
    expect(out.features).toHaveLength(2);
    expect(out.features[0]!.geometry).toMatchObject({
      type: "Point",
      coordinates: [1, 2],
    });
  });
});

describe("buildYrForecastPoints", () => {
  it("emits area ids on each centroid feature", () => {
    const out = buildYrForecastPoints([ranked({ id: "abc" })]);
    expect(out.features[0]!.properties).toEqual({ areaId: "abc" });
  });
});

describe("selectedAreaOptimalWindMarker", () => {
  it("returns null when no area is selected", () => {
    expect(selectedAreaOptimalWindMarker(fc([square]), null)).toBeNull();
  });

  it("returns null when the selected area has no optimalWindFromDeg", () => {
    expect(selectedAreaOptimalWindMarker(fc([square]), "area-1")).toBeNull();
  });

  it("returns a downwind marker with a clamped length when configured", () => {
    const withOptimal: Feature<Polygon> = {
      ...square,
      properties: { ...square.properties, optimalWindFromDeg: 270 },
    };
    const m = selectedAreaOptimalWindMarker(fc([withOptimal]), "area-1");
    expect(m).not.toBeNull();
    expect(m!.lenKm).toBeGreaterThan(0);
  });
});
