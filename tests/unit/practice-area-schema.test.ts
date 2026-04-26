import { describe, expect, it } from "vitest";
import {
  AREA_NAME_MAX,
  normalizeWindFromDeg,
  polygonSchema,
  sportEnum,
  windSectorsSchema,
} from "@/lib/practiceArea/schema";

describe("normalizeWindFromDeg", () => {
  it("returns the value as-is when already in [0, 360)", () => {
    expect(normalizeWindFromDeg(0)).toBe(0);
    expect(normalizeWindFromDeg(180)).toBe(180);
    expect(normalizeWindFromDeg(359)).toBe(359);
  });

  it("wraps positive over-rotations", () => {
    expect(normalizeWindFromDeg(360)).toBe(0);
    expect(normalizeWindFromDeg(450)).toBe(90);
    expect(normalizeWindFromDeg(720)).toBe(0);
  });

  it("wraps negative values into [0, 360)", () => {
    expect(normalizeWindFromDeg(-1)).toBe(359);
    expect(normalizeWindFromDeg(-90)).toBe(270);
    expect(normalizeWindFromDeg(-360)).toBe(0);
  });
});

describe("polygonSchema", () => {
  it("accepts a valid polygon ring", () => {
    expect(
      polygonSchema.safeParse({
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects non-Polygon types", () => {
    expect(
      polygonSchema.safeParse({
        type: "MultiPolygon",
        coordinates: [],
      }).success,
    ).toBe(false);
  });

  it("rejects coordinates with non-tuple points", () => {
    expect(
      polygonSchema.safeParse({
        type: "Polygon",
        coordinates: [[[0, 0, 0]]],
      }).success,
    ).toBe(false);
  });
});

describe("sportEnum", () => {
  it("accepts known sports", () => {
    expect(sportEnum.parse("kiteski")).toBe("kiteski");
    expect(sportEnum.parse("kitesurf")).toBe("kitesurf");
  });

  it("rejects unknown sports", () => {
    expect(sportEnum.safeParse("snowboard").success).toBe(false);
  });
});

describe("windSectorsSchema", () => {
  it("accepts a list of [from, to] tuples", () => {
    expect(
      windSectorsSchema.safeParse([
        [0, 90],
        [180, 270],
      ]).success,
    ).toBe(true);
  });

  it("accepts null", () => {
    expect(windSectorsSchema.safeParse(null).success).toBe(true);
  });

  it("rejects non-tuple entries", () => {
    expect(windSectorsSchema.safeParse([[0]]).success).toBe(false);
  });
});

describe("AREA_NAME_MAX", () => {
  it("is a positive integer", () => {
    expect(AREA_NAME_MAX).toBeGreaterThan(0);
    expect(Number.isInteger(AREA_NAME_MAX)).toBe(true);
  });
});
