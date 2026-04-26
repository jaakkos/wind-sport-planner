import { describe, expect, it } from "vitest";

import {
  buildDrawPreview,
  buildWindPickPreview,
  optimalWindMarkerLengthPx,
  windPickArrowLengthPx,
} from "@/lib/map/interactionLayers";

describe("buildWindPickPreview", () => {
  it("returns null when not in pickWind mode or before the first click", () => {
    expect(
      buildWindPickPreview({
        mapMode: "browse",
        windPickStart: [10, 60],
        windPickHover: [10, 60],
      }),
    ).toBeNull();
    expect(
      buildWindPickPreview({
        mapMode: "pickWind",
        windPickStart: null,
        windPickHover: null,
      }),
    ).toBeNull();
  });

  it("emits a dot when the cursor has barely moved", () => {
    const out = buildWindPickPreview({
      mapMode: "pickWind",
      windPickStart: [10, 60],
      windPickHover: [10.0000001, 60.0000001],
    });
    expect(out).toEqual({ kind: "dot", lng: 10, lat: 60 });
  });

  it("emits an arrow with heading and distance once the cursor has moved", () => {
    const out = buildWindPickPreview({
      mapMode: "pickWind",
      windPickStart: [10, 60],
      windPickHover: [10.5, 60],
    });
    expect(out).not.toBeNull();
    if (!out || out.kind !== "arrow") throw new Error("expected arrow");
    expect(out.tailLng).toBe(10);
    expect(out.tailLat).toBe(60);
    expect(out.distKm).toBeGreaterThan(0);
    expect(out.windToDeg).toBeGreaterThanOrEqual(0);
    expect(out.windToDeg).toBeLessThanOrEqual(360);
  });
});

describe("optimalWindMarkerLengthPx", () => {
  it("returns 0 when there is no marker", () => {
    expect(optimalWindMarkerLengthPx(null, 12)).toBe(0);
  });

  it("clamps the px length between 28 and 160", () => {
    expect(optimalWindMarkerLengthPx({ lat: 60, lenKm: 0.001 }, 12)).toBe(28);
    expect(optimalWindMarkerLengthPx({ lat: 60, lenKm: 100 }, 12)).toBe(160);
  });
});

describe("windPickArrowLengthPx", () => {
  it("is zero in the dot phase", () => {
    expect(
      windPickArrowLengthPx({ kind: "dot", lng: 10, lat: 60 }, 12),
    ).toBe(0);
  });

  it("clamps the arrow length between 12 and 420", () => {
    expect(
      windPickArrowLengthPx(
        {
          kind: "arrow",
          tailLng: 10,
          tailLat: 60,
          windToDeg: 0,
          distKm: 0.0001,
        },
        12,
      ),
    ).toBe(12);
    expect(
      windPickArrowLengthPx(
        {
          kind: "arrow",
          tailLng: 10,
          tailLat: 60,
          windToDeg: 0,
          distKm: 9999,
        },
        12,
      ),
    ).toBe(420);
  });
});

describe("buildDrawPreview", () => {
  it("returns null when the ring is empty", () => {
    expect(buildDrawPreview([])).toBeNull();
  });

  it("emits only a vertices feature for a single click", () => {
    const out = buildDrawPreview([[10, 60]]);
    expect(out!.features).toHaveLength(1);
    expect(out!.features[0]!.properties).toEqual({ kind: "vertices" });
  });

  it("emits vertices, path and a closing segment for multi-vertex rings", () => {
    const out = buildDrawPreview([
      [10, 60],
      [11, 60],
      [11, 61],
    ]);
    expect(out!.features).toHaveLength(3);
    const kinds = out!.features.map((f) => (f.properties as { kind: string }).kind);
    expect(kinds).toEqual(["vertices", "path", "close"]);
    const close = out!.features[2]!;
    expect(close.geometry).toMatchObject({
      type: "LineString",
      coordinates: [
        [11, 61],
        [10, 60],
      ],
    });
  });
});
