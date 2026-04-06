import { describe, expect, it } from "vitest";
import { windLogRequestSchema } from "@/lib/windlog/schema";

describe("windLogRequestSchema", () => {
  it("accepts valid kiteski payload", () => {
    const r = windLogRequestSchema.safeParse({
      activityId: "act_1",
      sport: "kiteski",
      sessionOutcome: "good",
      sessionSuitability: "suitable",
      feltWindStrength: "medium",
      feltWindDirection: "N",
      gustiness: "steady",
      visibility: "ok",
      hazardFlags: ["none"],
      snowSurface: "packed",
    });
    expect(r.success).toBe(true);
  });

  it("rejects kiteski without snowSurface", () => {
    const r = windLogRequestSchema.safeParse({
      activityId: "act_1",
      sport: "kiteski",
      sessionOutcome: "good",
      sessionSuitability: "suitable",
      feltWindStrength: "medium",
      feltWindDirection: "N",
      gustiness: "steady",
      visibility: "ok",
      hazardFlags: [],
    });
    expect(r.success).toBe(false);
  });

  it("accepts valid kitesurf payload", () => {
    const r = windLogRequestSchema.safeParse({
      activityId: "act_1",
      sport: "kitesurf",
      sessionOutcome: "excellent",
      sessionSuitability: "ideal",
      feltWindStrength: "high",
      feltWindDirection: "SW",
      gustiness: "moderate_gusts",
      visibility: "good",
      hazardFlags: ["none"],
      waterConditions: "chop",
      waveHeightBand: "waist",
    });
    expect(r.success).toBe(true);
  });
});
