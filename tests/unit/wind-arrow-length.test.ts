import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import type { Feature, Polygon } from "geojson";
import { describe, expect, it } from "vitest";
import { destinationLngLat } from "@/lib/heuristics/windDirection";
import {
  clampArrowLengthInsidePolygon,
  maxVertexRadiusKm,
} from "@/lib/map/windArrowLength";

/** ~1 km square near Helsinki (outer ring closed). */
const smallSquare: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [24.9, 60.1],
      [24.915, 60.1],
      [24.915, 60.108],
      [24.9, 60.108],
      [24.9, 60.1],
    ],
  ],
};

describe("maxVertexRadiusKm", () => {
  it("is positive and bounded for a small polygon", () => {
    const cLng = 24.9075;
    const cLat = 60.104;
    const r = maxVertexRadiusKm(smallSquare, cLng, cLat);
    expect(r).toBeGreaterThan(0.05);
    expect(r).toBeLessThan(2);
  });
});

describe("clampArrowLengthInsidePolygon", () => {
  it("shortens a huge preferred length so the tip stays inside", () => {
    const cLng = 24.9075;
    const cLat = 60.104;
    const windToDeg = 90;
    const len = clampArrowLengthInsidePolygon(
      smallSquare,
      cLng,
      cLat,
      windToDeg,
      50,
    );
    const maxR = maxVertexRadiusKm(smallSquare, cLng, cLat);
    expect(len).toBeLessThanOrEqual(maxR * 0.55);
    const tip = destinationLngLat(cLng, cLat, windToDeg, len);
    const polyFeat = {
      type: "Feature",
      geometry: smallSquare,
      properties: {},
    } as Feature<Polygon>;
    expect(booleanPointInPolygon(turfPoint(tip), polyFeat, { ignoreBoundary: false })).toBe(
      true,
    );
  });

  it("keeps short preferred lengths when tip already inside", () => {
    const cLng = 24.9075;
    const cLat = 60.104;
    const windToDeg = 0;
    const preferred = 0.05;
    const len = clampArrowLengthInsidePolygon(
      smallSquare,
      cLng,
      cLat,
      windToDeg,
      preferred,
    );
    expect(len).toBeGreaterThanOrEqual(0.03);
    expect(len).toBeLessThanOrEqual(preferred * 1.01);
  });
});
