import { describe, expect, it } from "vitest";
import { metNoPreferredRegion } from "@/lib/weather/providers/metNo";

describe("metNoPreferredRegion", () => {
  it("includes Bergen and Helsinki", () => {
    expect(metNoPreferredRegion(60.39, 5.32)).toBe(true);
    expect(metNoPreferredRegion(60.17, 24.94)).toBe(true);
  });

  it("includes Alps (approx)", () => {
    expect(metNoPreferredRegion(46.02, 7.75)).toBe(true);
  });

  it("excludes US east coast", () => {
    expect(metNoPreferredRegion(40.71, -74.01)).toBe(false);
  });

  it("excludes Japan", () => {
    expect(metNoPreferredRegion(35.68, 139.76)).toBe(false);
  });
});
