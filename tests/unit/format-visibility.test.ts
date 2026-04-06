import { describe, expect, it } from "vitest";
import { formatVisibilityM } from "@/lib/weather/formatVisibility";

describe("formatVisibilityM", () => {
  it("returns em dash for missing or invalid", () => {
    expect(formatVisibilityM(null)).toBe("—");
    expect(formatVisibilityM(undefined)).toBe("—");
    expect(formatVisibilityM(Number.NaN)).toBe("—");
    expect(formatVisibilityM(-1)).toBe("—");
  });

  it("formats metres below 1 km", () => {
    expect(formatVisibilityM(200)).toBe("200 m");
    expect(formatVisibilityM(999)).toBe("999 m");
  });

  it("formats km with one decimal under 10 km", () => {
    expect(formatVisibilityM(1500)).toBe("1.5 km");
    expect(formatVisibilityM(9999)).toBe("10.0 km");
  });

  it("rounds whole km from 10 km", () => {
    expect(formatVisibilityM(12_340)).toBe("12 km");
    expect(formatVisibilityM(24_000)).toBe("24 km");
  });
});
