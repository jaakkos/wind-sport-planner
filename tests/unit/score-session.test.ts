import { describe, expect, it } from "vitest";
import type { WindLog } from "@/generated/prisma";
import { scoreSession } from "@/lib/heuristics/scoreSession";

const baseLog = {
  id: "wl1",
  activityId: "a1",
  sport: "kiteski" as const,
  feltWindStrength: "medium" as const,
  feltWindDirection: "N" as const,
  gustiness: "steady" as const,
  visibility: "good" as const,
  hazardFlags: [] as string[],
  snowSurface: "packed" as const,
  waterConditions: null,
  waveHeightBand: null,
};

describe("scoreSession", () => {
  it("scores weather-only session", () => {
    const { total, breakdown } = scoreSession({
      sport: "kiteski",
      weather: { windSpeedMs: 8, gustMs: 10, windDirDeg: 180 },
      windLog: null,
    });
    expect(breakdown.windOk).toBe(true);
    expect(total).toBeGreaterThan(0);
  });

  it("applies suitability multiplier", () => {
    const log = {
      ...baseLog,
      sessionSuitability: "unsuitable" as const,
      sessionOutcome: "good" as const,
    } as unknown as WindLog;

    const low = scoreSession({
      sport: "kiteski",
      weather: { windSpeedMs: 8, gustMs: 9, windDirDeg: null },
      windLog: log,
    });

    const high = scoreSession({
      sport: "kiteski",
      weather: { windSpeedMs: 8, gustMs: 9, windDirDeg: null },
      windLog: {
        ...baseLog,
        sessionSuitability: "ideal",
        sessionOutcome: "good",
      } as unknown as WindLog,
    });

    expect(high.total).toBeGreaterThan(low.total);
  });

  it("clamps total to 0..100", () => {
    const { total } = scoreSession({
      sport: "kiteski",
      weather: null,
      windLog: null,
    });
    expect(total).toBe(0);
  });
});
