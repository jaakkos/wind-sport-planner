import { describe, expect, it } from "vitest";
import { centroidLngLatFromGeojson } from "@/lib/practiceArea/centroid";

describe("centroidLngLatFromGeojson", () => {
  it("returns null for invalid input", () => {
    expect(centroidLngLatFromGeojson(null)).toBeNull();
    expect(centroidLngLatFromGeojson({ type: "Garbage" })).toBeNull();
  });

  it("returns the centroid of a unit square at (0.5, 0.5)", () => {
    const result = centroidLngLatFromGeojson({
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
    });
    expect(result).not.toBeNull();
    expect(result!.lng).toBeCloseTo(0.5, 6);
    expect(result!.lat).toBeCloseTo(0.5, 6);
  });

  it("returns the centroid of a triangle at the average of its vertices", () => {
    const result = centroidLngLatFromGeojson({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [3, 0],
          [0, 3],
          [0, 0],
        ],
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.lng).toBeCloseTo(1, 6);
    expect(result!.lat).toBeCloseTo(1, 6);
  });
});
