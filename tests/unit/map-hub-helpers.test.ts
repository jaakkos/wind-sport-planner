import { describe, expect, it } from "vitest";
import { terrainPopoverScreenPosition } from "@/lib/map/mapHubHelpers";

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
