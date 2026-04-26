import { describe, expect, it } from "vitest";
import {
  defaultRankingPreferencesResponse,
  parseRankingPreferencesDoc,
} from "@/lib/heuristics/rankingPreferences";
import { resolveSportRankingOptions } from "@/lib/heuristics/ranking/sportPrefs";
import {
  MULTI_POINT_DEFAULTS,
  resolveMultiPointForecastPrefs,
} from "@/lib/heuristics/ranking/multiPointPrefs";
import { WIND_BANDS } from "@/lib/heuristics/profiles";

describe("parseRankingPreferencesDoc", () => {
  it("returns null for null/undefined input", () => {
    expect(parseRankingPreferencesDoc(null)).toBeNull();
    expect(parseRankingPreferencesDoc(undefined)).toBeNull();
  });

  it("returns null for an unrelated object", () => {
    expect(parseRankingPreferencesDoc({ unknown: 42 })).toBeNull();
  });

  it("parses a valid doc with partial sport overrides", () => {
    const doc = parseRankingPreferencesDoc({
      kiteski: { minWindMs: 4, maxWindMs: 20 },
      multiPointForecast: { mode: "on", maxSamples: 7 },
    });
    expect(doc).not.toBeNull();
    expect(doc?.kiteski?.minWindMs).toBe(4);
    expect(doc?.multiPointForecast?.mode).toBe("on");
  });

  it("rejects out-of-range values", () => {
    expect(
      parseRankingPreferencesDoc({ kiteski: { minWindMs: 0.1 } }),
    ).toBeNull();
  });
});

describe("defaultRankingPreferencesResponse", () => {
  it("returns sport defaults that match WIND_BANDS", () => {
    const r = defaultRankingPreferencesResponse();
    for (const sport of ["kiteski", "kitesurf"] as const) {
      const b = WIND_BANDS[sport];
      const d = r.defaults[sport];
      expect(d.bands).toEqual(b);
      expect(d.minWindMs).toBe(b.minMs);
      expect(d.maxWindMs).toBe(b.maxMs);
      expect(d.idealMinMs).toBe(b.idealMin);
      expect(d.idealMaxMs).toBe(b.idealMax);
      expect(d.windFitScale).toBe(1);
      expect(d.gustPenaltyScale).toBe(1);
      expect(d.directionEmphasis).toBe(1);
    }
  });

  it("returns the canonical multi-point defaults", () => {
    expect(defaultRankingPreferencesResponse().multiPointForecast).toEqual(
      MULTI_POINT_DEFAULTS,
    );
  });
});

describe("resolveSportRankingOptions", () => {
  it("returns built-in bands when prefs are missing", () => {
    const opts = resolveSportRankingOptions("kiteski", undefined);
    expect(opts.bands).toEqual(WIND_BANDS.kiteski);
    expect(opts.windFitScale).toBe(1);
    expect(opts.gustPenaltyScale).toBe(1);
    expect(opts.directionEmphasis).toBe(1);
  });

  it("respects valid overrides", () => {
    const opts = resolveSportRankingOptions("kiteski", {
      minWindMs: 4,
      maxWindMs: 20,
      idealMinMs: 6,
      idealMaxMs: 14,
      windFitScale: 1.5,
      gustPenaltyScale: 0.5,
      directionEmphasis: 0.25,
    });
    expect(opts.bands).toEqual({ minMs: 4, maxMs: 20, idealMin: 6, idealMax: 14 });
    expect(opts.windFitScale).toBe(1.5);
    expect(opts.gustPenaltyScale).toBe(0.5);
    expect(opts.directionEmphasis).toBe(0.25);
  });

  it("falls back to defaults when min >= max", () => {
    const opts = resolveSportRankingOptions("kiteski", {
      minWindMs: 10,
      maxWindMs: 8,
    });
    expect(opts.bands.minMs).toBe(WIND_BANDS.kiteski.minMs);
    expect(opts.bands.maxMs).toBe(WIND_BANDS.kiteski.maxMs);
  });

  it("clamps ideal min/max into the resolved band", () => {
    const opts = resolveSportRankingOptions("kiteski", {
      minWindMs: 5,
      maxWindMs: 15,
      idealMinMs: 1,
      idealMaxMs: 30,
    });
    expect(opts.bands.idealMin).toBe(5);
    expect(opts.bands.idealMax).toBe(15);
  });

  it("recovers when the resolved ideals invert", () => {
    const opts = resolveSportRankingOptions("kiteski", {
      minWindMs: 4,
      maxWindMs: 20,
      idealMinMs: 18,
      idealMaxMs: 6,
    });
    expect(opts.bands.idealMin).toBeLessThanOrEqual(opts.bands.idealMax);
  });
});

describe("resolveMultiPointForecastPrefs", () => {
  it("returns the guest preset when not authed", () => {
    const r = resolveMultiPointForecastPrefs(
      { mode: "on", maxSamples: 9, scoringPolicy: "representative" },
      false,
    );
    expect(r.mode).toBe("auto");
    expect(r.maxSamples).toBe(4);
    expect(r.scoringPolicy).toBe("conservative");
  });

  it("returns canonical defaults when authed but prefs are missing", () => {
    expect(resolveMultiPointForecastPrefs(null, true)).toEqual(
      MULTI_POINT_DEFAULTS,
    );
  });

  it("respects authed overrides", () => {
    const r = resolveMultiPointForecastPrefs(
      { mode: "on", maxSamples: 9, scoringPolicy: "representative" },
      true,
    );
    expect(r.mode).toBe("on");
    expect(r.maxSamples).toBe(9);
    expect(r.scoringPolicy).toBe("representative");
  });

  it("clamps maxSamples into [3, 9]", () => {
    expect(
      resolveMultiPointForecastPrefs({ maxSamples: 1 }, true).maxSamples,
    ).toBe(3);
    expect(
      resolveMultiPointForecastPrefs({ maxSamples: 99 }, true).maxSamples,
    ).toBe(9);
  });
});
