import { describe, expect, it } from "vitest";
import { gustPenalty, windFitScore } from "@/lib/heuristics/profiles";

describe("windFitScore", () => {
  it("returns 0 for null speed", () => {
    expect(windFitScore("kiteski", null)).toEqual({ score: 0, ok: false });
  });

  it("returns 100 for ideal kiteski band", () => {
    expect(windFitScore("kiteski", 8)).toEqual({ score: 100, ok: true });
  });

  it("returns 0 when out of band", () => {
    expect(windFitScore("kiteski", 25)).toEqual({ score: 0, ok: false });
  });
});

describe("gustPenalty", () => {
  it("returns 0 for calm ratio", () => {
    expect(gustPenalty(10, 8)).toBe(0);
  });

  it("returns 15 for moderate gust ratio", () => {
    expect(gustPenalty(15, 8)).toBe(15);
  });

  it("returns 35 for strong gust ratio", () => {
    expect(gustPenalty(24, 8)).toBe(35);
  });
});
