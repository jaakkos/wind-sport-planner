import { describe, expect, it } from "vitest";
import { terrainPopoverScreenPosition, windMultiPointSubtitle } from "@/lib/map/mapHubHelpers";

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

describe("terrainPopoverScreenPosition", () => {
  it("offsets from anchor and clamps to viewport", () => {
    const p = terrainPopoverScreenPosition(100, 200, 1200, 800);
    expect(p.left).toBe(108);
    expect(p.top).toBe(208);
  });

  it("does not push the card past the right or bottom edge", () => {
    const p = terrainPopoverScreenPosition(1100, 700, 1200, 800);
    expect(p.left).toBeLessThanOrEqual(1200 - 320 - 8);
    expect(p.top).toBeLessThanOrEqual(800 - 280 - 8);
  });
});
